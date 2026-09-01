# Accounts, Login and Administration

How FoodLink decides who someone is, and what that lets them do.

## The shape of the system

Authentication is **stateless bearer-token**. There is no server-side session
table and no cookie:

1. A client posts credentials to `POST /api/auth/login`.
2. The server checks the password against a bcrypt hash and returns a signed
   JSON Web Token (JWT).
3. Every subsequent request carries that token in an
   `Authorization: Bearer <token>` header.
4. The server verifies the signature, reads the user id out of the token, and
   **loads the account from the database on every request**.

Step 4 matters more than it looks. The token also carries a `role` claim, but
that claim is never trusted for authorisation — the role used is the one
currently stored on the row. A suspended or demoted account therefore loses its
powers on its very next request, rather than whenever its token expires.

Tokens are signed with HS256 using `FOODLINK_SECRET_KEY` and expire after
`ACCESS_TOKEN_MINUTES` (default 720, i.e. twelve hours). The default key is a
placeholder so a fresh clone runs; **any deployment must override it**, because
anyone holding the key can mint a token for any account, administrators
included.

## The four roles

| Role | Represents | Can |
| --- | --- | --- |
| `donor` | A mess, restaurant, banquet hall | Post donations, cancel their own |
| `ngo` | A kitchen, shelter, care home | Accept donations for **its own** organisation, post requirements, complete deliveries |
| `volunteer` | A courier | Claim an accepted pickup, mark it picked up and delivered |
| `admin` | Platform staff | Everything above, plus verify organisations, create and suspend accounts, run the expiry sweep |

Each non-admin role owns a record it acts through. Registering as a volunteer
creates a `volunteers` row; registering as an NGO creates a `recipients` row.
`GET /api/auth/me` returns `recipientId` / `volunteerId` so the client knows
which record the signed-in account speaks for.

## Signing up

`POST /api/auth/register` is open to the public, and accepts exactly three
roles: `donor`, `ngo`, `volunteer`. Passing `role: "admin"` is rejected with
**422** by the request schema, so `admin` is not even a documented value for
that field in the OpenAPI spec.

This is the whole point of the design. If registration accepted `admin`, then
"become an administrator of this platform" would be a single unauthenticated
`POST` that anybody on the internet could send.

An NGO signing up creates its organisation at the same time, **unverified**.

## Verification: what an administrator is actually for

An unverified organisation can sign in, complete its profile, and browse — but
it **cannot accept a donation** (403) and **does not appear in match rankings
at all**. It becomes a real participant only when an administrator vouches for
it:

```
POST   /api/admin/recipients/{id}/verify     # vouch
DELETE /api/admin/recipients/{id}/verify     # withdraw
```

Verification is a human judgement — somebody confirmed this kitchen exists and
is where it claims to be. Gating acceptance on it is what keeps that judgement
from being decorative: without the gate, an unvetted account could take custody
of food on day one.

An organisation cannot verify itself. `PATCH /api/recipients/me` lets it edit
its own name, address, coordinates and capacity, and deliberately has no
`isVerified` field.

## Who can sign in as an administrator

Only an account whose stored `role` is already `admin`. There are exactly two
ways for an account to reach that state, and both require an authority that
already exists:

### 1. From the command line — the first administrator

Run by whoever controls the server and its database. That is the only authority
that exists before any account does, so it is where the chain has to start.

```bash
cd code && python -m foodlink.cli create-admin --email you@example.com --name "Your Name"
```

The password is prompted for, not passed as an argument — an argument ends up
in shell history and in the process list, where other users of the machine can
read it. For scripted setup (CI, a container entrypoint), set
`FOODLINK_ADMIN_PASSWORD` in the environment instead.

Related commands:

```bash
python -m foodlink.cli promote --email someone@example.com   # raise an existing account
python -m foodlink.cli reset-password --email you@example.com  # recover a locked-out admin
python -m foodlink.cli list-admins                            # who currently holds the role
```

`reset-password` needs no old password, which sounds alarming until you note
that it needs database access — it grants nothing to anyone who did not already
have everything.

### 2. From an existing administrator — every subsequent one

```
POST /api/admin/users
{ "name": "...", "email": "...", "password": "...", "role": "admin" }
```

This is the only route in the API that may set `role` to `admin`, and reaching
it already requires an administrator's own bearer token. Accounts made this way
get their profile rows just like self-registered ones, and the new holder
should change the password through `POST /api/auth/password`, since somebody
else chose the first one.

## Not locking yourself out

Because promotion requires an existing administrator, a platform with zero
administrators cannot recover through the API. Two rules prevent reaching that
state by accident:

* You cannot suspend or demote **your own** administrator account.
* The **last active** administrator cannot be suspended or demoted.

Both return **409 Conflict** with an explanation. The real escape hatch remains
`python -m foodlink.cli promote`, which needs shell access.

## Suspension

`PATCH /api/admin/users/{id}` with `{"isActive": false}` disables an account.
A disabled account is refused at login with **403** and a message saying so
(rather than a misleading "wrong password"), and any token it already holds
stops working immediately, because every request re-reads the row.

## Endpoint reference

| Method | Path | Who |
| --- | --- | --- |
| `POST` | `/api/auth/register` | Anyone (donor / ngo / volunteer only) |
| `POST` | `/api/auth/login` | Anyone with credentials |
| `GET` | `/api/auth/me` | Any signed-in account |
| `PATCH` | `/api/auth/me` | Any signed-in account (own name / organisation / phone) |
| `POST` | `/api/auth/password` | Any signed-in account, proving the current password |
| `GET` `PATCH` | `/api/recipients/me` | `ngo` — its own organisation profile |
| `GET` `PATCH` | `/api/volunteers/me` | `volunteer` — its own courier profile |
| `GET` | `/api/volunteers` | `admin`, `ngo` — the full roster |
| `GET` | `/api/admin/users` | `admin` |
| `POST` | `/api/admin/users` | `admin` |
| `PATCH` | `/api/admin/users/{id}` | `admin` |
| `POST` `DELETE` | `/api/admin/recipients/{id}/verify` | `admin` |
| `POST` | `/api/admin/maintenance/expire` | `admin` |

## What an account may change about itself

`PATCH /api/auth/me` covers name, organisation and phone. Role, email and
active status are deliberately absent: they decide what an account can do and
who it is, so they belong to an administrator rather than to the holder.

Beyond that, each role owns one record and may edit it:

* `PATCH /api/recipients/me` — an organisation's address, coordinates and
  capacity, the three things the matcher actually scores. `isVerified` is not a
  field here, because an organisation does not vouch for itself.
* `PATCH /api/volunteers/me` — a courier's availability and base location.
  Delivery count and rating are absent: they are earned through completed runs
  and stay the server's to maintain.

## Demo accounts

`python -m foodlink.seed` populates a demo database in which every account uses
the password `foodlink123`:

| Role | Email |
| --- | --- |
| Donor | `aayushi@thapar.edu` |
| Recipient | `raj@helpinghands.org` |
| Courier | `aarav@thapar.edu` |
| Admin | `admin@foodlink.ai` |

These exist for demonstration only. A real deployment seeds nothing and starts
with `create-admin`.
