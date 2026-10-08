# PostgreSQL migration verification

Date: 2026-10-08. Branch: `main`; starting HEAD: `f532083`.

## Implementation

- Replaced the application Mongoose dependency with `pg@8.23.1`. Added `@types/pg@8.23.1` and the development-only `@electric-sql/pglite@0.5.8` test engine. No broad dependency upgrades were performed.
- Added a lazy, cached PostgreSQL connection pool, certificate/hostname-verified TLS configuration for Aiven, and transactions using one checked-out connection.
- Added an explicit SQL migration command, migration ledger, and advisory lock. Schema migration reruns are tested.
- Migrated registration/login/profile, dashboard, match creation/read/update/delete, join/leave, start, score, record-ball, undo-ball, and leaderboard storage.
- Stored users, matches and role memberships in PostgreSQL tables with unique constraints and foreign keys. Nested scorecards use JSONB. New IDs are UUID strings; existing API `_id` keys and nested scorecard shapes are retained.
- Kept bcrypt hashing and the JWT/cookie formats. User/profile queries omit password hashes; only the login query selects a hash.
- Match saves atomically persist scorecards and memberships. Stale server snapshots fail version checks; affected API routes return HTTP 409.
- Replaced the leaderboard's MongoDB aggregation with SQL. The server-rendered page reads the same query directly, removing its build-time localhost self-fetch. Leaderboard API/page reads now occur at request time, replacing the previous one-hour caching behavior.
- Added `.env.example`, Aiven setup instructions, and a README setup link.

## Validation

- `npm.cmd test`: **16 tests passed in four suites**.
- Integration tests use PostgreSQL in an isolated in-memory PGlite instance, with real SQL, constraints, transaction code and route handlers. Only database transport and external telemetry/realtime delivery are substituted.
- Tests cover migration reruns, registration/login, password-hash privacy, match defaults/detail/list formats, memberships and deletion cascades, record/undo scoring, nested/dotted score persistence, stale-save conflicts including HTTP 409, foreign-key rollback, unique email, SQL parameterization, and empty/populated leaderboards.
- TLS configuration tests verify certificate checks remain enabled when the URI contains SSL options, remote TLS opt-out is rejected, and invalid configuration is rejected without echoing credentials.
- The test commands enable Node's VM module support for PGlite/Jest interoperability; Node emits an experimental VM Modules warning.
- Final lint: **passed, no warnings/errors**.
- Final standalone TypeScript check: **passed**.
- Final production build: **passed**, including lint/type validation, page generation and build traces. The leaderboard page and API are dynamic; no localhost leaderboard fetch error remained.
- The sandboxed build could not download the Google font (network EACCES); the network-enabled retry passed. Existing nonblocking metadata, browser-data freshness, edge-runtime, dependency URL parsing and webpack cache warnings remain.
- Migration CLI with DATABASE_URL deliberately unset: exited 1 with a generic configuration error and no credentials or database access.
- Git whitespace checks passed; `.env.local`, PEM certificates and logs are ignored, while `.env.example` is eligible for tracking.
- Application source has no remaining Mongoose imports, MongoDB connection variables, ObjectId conversions, or MongoDB query calls.
- Prior Phase 1/2 changes are preserved, including removing the committed logs and restoring lint/type checks.

## Limits and remaining setup

The local `.env.local` is configured and ignored by Git. A read-only Aiven connection check succeeded with certificate verification enabled using the inline CA certificate. A cryptographically random JWT secret was generated directly into the ignored environment file without displaying it.

At that check, the application tables were absent. The user subsequently reported running `npm.cmd run db:migrate` and `npm.cmd run dev`; schema creation and live application workflows have not been independently rechecked. No MongoDB source data was accessed or copied, and no deployment was changed during verification.

Build verification uses temporary process-only JWT/Pusher placeholders, with no database URL. These values are not saved. After supplying actual environment values, rebuild before starting or deploying so the public Pusher settings are correct.

Follow [postgresql-setup.md](postgresql-setup.md) to configure each deployment environment and apply the schema to its intended database, then check health and the app workflows. Local environment values are not included in the repository.

If historical users/matches must be retained, a separate export/validation/import step is required before production cutover. The current migration initializes schema only. Browser end-to-end flows, multiple Node.js processes and actual realtime event delivery were not verified by the isolated tests. Aiven TLS/networking was checked separately through the read-only connection described above.
