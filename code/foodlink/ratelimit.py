"""Request-rate limiting for the authentication endpoints and donation creation.

`POST /api/auth/login` and `POST /api/auth/register` are the two routes an
anonymous caller can drive as hard as the server will answer them, and bcrypt's
cost is not a rate limit: it prices one attempt, not ten thousand of them. This
module prices the attempts.

`POST /api/donations` is limited too (DQ-4, D-59), because every post both lands
in every kitchen's pool and probes the 8 km matching gate. That caller is
authenticated, so it is counted per donor account as well as per address — see
`check_donation_creation`.

Four things are decided here:

* **The counter lives in this process**, in a dict, because the deployment this
  project actually has is one worker — SQLite has one writer, and migrations run
  in the app's own startup (`ARCHITECTURE.md` → Architectural constraints). Two
  workers would each keep their own count and the effective limit would double;
  two hosts would multiply it again. A shared counter means Redis, which is a
  larger decision than this control needs. See `DECISIONS.md` D-27.
* **For login and register the key is the caller's address, not the submitted
  email.** Keying on the account would let anyone lock a person out of their own
  account by failing logins on their behalf, and it would leak: a limited
  response for one address and an ordinary one for another answers "does this
  account exist?", which is exactly what the single login error message
  withholds (D-18). Neither objection reaches donation creation, where only the
  holder of a donor's token can spend that donor's budget.
* **Every request counts, not only the failures.** The limiter runs before the
  handler and never learns the outcome, so authentication behaviour below the
  threshold is byte-for-byte what it was.
* **A refused request is not itself counted.** Otherwise a client that keeps
  retrying extends its own lockout indefinitely and `Retry-After` becomes a lie.
"""

from __future__ import annotations

import math
import threading
import time
from collections import deque
from collections.abc import Callable

from fastapi import HTTPException, Request, status

from .config import get_settings
from .models import User, UserRole

settings = get_settings()

#: The 429 body. It names the network rather than the account deliberately: the
#: response has to read the same whether or not the email exists.
RATE_LIMITED_DETAIL = "Too many attempts from this network. Please wait and try again."

#: The 429 body when a donor's own account is over its donation budget. It names
#: the account because that is what is limited, and says "attempts" because a
#: post that fails validation counts too.
DONATION_ACCOUNT_RATE_LIMITED_DETAIL = (
    "Too many donation attempts from this account. Please wait and try again."
)

#: Key used when the ASGI server reports no peer address — a direct in-process
#: call, or a transport without one. Such callers share a single budget rather
#: than escaping the limit.
UNKNOWN_CLIENT = "unknown"

#: How many distinct keys may accumulate before expired ones are swept. The
#: sweep is what keeps a flood of one-request addresses from growing the dict
#: without bound.
_SWEEP_THRESHOLD = 4096


class RateLimiter:
    """A sliding window of request timestamps, one deque per key.

    A sliding window rather than a fixed one because a fixed window lets twice
    the limit through around its boundary, and the whole point of the control is
    that the ceiling means what it says. The memory cost is `limit` floats per
    active key, which at these limits is nothing.
    """

    def __init__(
        self,
        *,
        name: str,
        limit: int,
        window_seconds: int,
        detail: str = RATE_LIMITED_DETAIL,
        clock: Callable[[], float] = time.monotonic,
    ) -> None:
        self.name = name
        self.limit = limit
        self.window_seconds = window_seconds
        # The sentence a refusal carries; it has to describe what is limited.
        self.detail = detail
        # Monotonic, so a clock adjustment cannot widen or collapse a window.
        # Injectable so tests can step time instead of sleeping through it.
        self._clock = clock
        self._hits: dict[str, deque[float]] = {}
        # Sync endpoints run in a threadpool, so two requests genuinely can be
        # inside `record` at once.
        self._lock = threading.Lock()

    def check(self, key: str) -> None:
        """Count one request against `key`, raising 429 when it is over."""
        retry_after = self.record(key)
        if retry_after is None:
            return
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=self.detail,
            headers={"Retry-After": str(retry_after)},
        )

    def record(self, key: str) -> int | None:
        """Count one request. Returns `None` if allowed, else `Retry-After`."""
        now = self._clock()
        cutoff = now - self.window_seconds

        with self._lock:
            if len(self._hits) >= _SWEEP_THRESHOLD:
                self._sweep(cutoff)

            hits = self._hits.setdefault(key, deque())
            while hits and hits[0] <= cutoff:
                hits.popleft()

            if len(hits) >= self.limit:
                # The oldest hit still in the window is the one that has to age
                # out before there is room again. Never less than a second, so
                # the header cannot read `Retry-After: 0`.
                return max(1, math.ceil(hits[0] + self.window_seconds - now))

            hits.append(now)
            return None

    def release(self, key: str) -> None:
        """Take back the newest request counted against `key`.

        For a request this limiter allowed and a second limiter then refused:
        a refused request is not counted, and that has to stay true when two
        budgets guard one route. Hits are interchangeable timestamps, so if a
        concurrent request landed in between, the one withdrawn is that slightly
        newer hit rather than the refused request's own; the count is the same.
        """
        with self._lock:
            hits = self._hits.get(key)
            if hits:
                hits.pop()

    def _sweep(self, cutoff: float) -> None:
        """Drop keys whose most recent request has left the window."""
        stale = [key for key, hits in self._hits.items() if not hits or hits[-1] <= cutoff]
        for key in stale:
            del self._hits[key]

    def reset(self) -> None:
        """Forget every counter. Used by the test fixtures, which need a clean
        limiter per test the same way they need a clean database."""
        with self._lock:
            self._hits.clear()


login_limiter = RateLimiter(
    name="login",
    limit=settings.login_rate_limit,
    window_seconds=settings.login_rate_window_seconds,
)

register_limiter = RateLimiter(
    name="register",
    limit=settings.register_rate_limit,
    window_seconds=settings.register_rate_window_seconds,
)

donation_account_limiter = RateLimiter(
    name="donation-account",
    limit=settings.donation_account_rate_limit,
    window_seconds=settings.donation_account_rate_window_seconds,
    detail=DONATION_ACCOUNT_RATE_LIMITED_DETAIL,
)

donation_ip_limiter = RateLimiter(
    name="donation-ip",
    limit=settings.donation_ip_rate_limit,
    window_seconds=settings.donation_ip_rate_window_seconds,
)


def client_key(request: Request) -> str:
    """The address a request is counted against.

    `X-Forwarded-For` is deliberately not read: any client can send it, so
    trusting it here would hand every caller a way to switch the limiter off.
    Behind a reverse proxy, run uvicorn with
    `--proxy-headers --forwarded-allow-ips=<the proxy>` so that the address ASGI
    reports is already the real client's — the trust decision then sits with the
    deployment, which is the only place that can make it correctly.
    """
    client = request.client
    if client is None or not client.host:
        return UNKNOWN_CLIENT
    return client.host


def _guard(limiter: RateLimiter) -> Callable[[Request], None]:
    """Build the route dependency for one limiter."""

    def dependency(request: Request) -> None:
        limiter.check(client_key(request))

    return dependency


#: Attach with `dependencies=[Depends(...)]` on the route, so the limit is part
#: of the route definition and cannot be missed by reading the handler body.
login_rate_limit = _guard(login_limiter)
register_rate_limit = _guard(register_limiter)


def check_donation_creation(request: Request, user: User) -> None:
    """Count a donor's `POST /api/donations` against their account and address.

    Called by the route's dependency once the role gate has resolved `user`, so
    a request without a valid donor or admin identity is answered 401/403
    before anything is counted. Administrators are not counted at all (DQ-4):
    their posts neither meet a limit nor spend a donor's network budget.

    The account is checked before the address, and a request either limiter
    refuses is counted by neither. So a donor retrying past their own ceiling
    does not use up the budget of other donors on their network, and a donor
    refused because their network is busy keeps their own budget intact.
    """
    if user.role is not UserRole.donor:
        return

    account = str(user.id)
    donation_account_limiter.check(account)
    try:
        donation_ip_limiter.check(client_key(request))
    except HTTPException:
        donation_account_limiter.release(account)
        raise


def reset_rate_limits() -> None:
    """Clear every counter."""
    login_limiter.reset()
    register_limiter.reset()
    donation_account_limiter.reset()
    donation_ip_limiter.reset()
