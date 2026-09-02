"""Request-rate limiting for the authentication endpoints.

`POST /api/auth/login` and `POST /api/auth/register` are the two routes an
anonymous caller can drive as hard as the server will answer them, and bcrypt's
cost is not a rate limit: it prices one attempt, not ten thousand of them. This
module prices the attempts.

Four things are decided here:

* **The counter lives in this process**, in a dict, because the deployment this
  project actually has is one worker — SQLite has one writer, and migrations run
  in the app's own startup (`ARCHITECTURE.md` → Architectural constraints). Two
  workers would each keep their own count and the effective limit would double;
  two hosts would multiply it again. A shared counter means Redis, which is a
  larger decision than this control needs. See `DECISIONS.md` D-27.
* **The key is the caller's address, not the submitted email.** Keying on the
  account would let anyone lock a person out of their own account by failing
  logins on their behalf, and it would leak: a limited response for one address
  and an ordinary one for another answers "does this account exist?", which is
  exactly what the single login error message withholds (D-18).
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

settings = get_settings()

#: The 429 body. It names the network rather than the account deliberately: the
#: response has to read the same whether or not the email exists.
RATE_LIMITED_DETAIL = "Too many attempts from this network. Please wait and try again."

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
        clock: Callable[[], float] = time.monotonic,
    ) -> None:
        self.name = name
        self.limit = limit
        self.window_seconds = window_seconds
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
            detail=RATE_LIMITED_DETAIL,
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


def reset_rate_limits() -> None:
    """Clear both counters."""
    login_limiter.reset()
    register_limiter.reset()
