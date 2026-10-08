# Aiven PostgreSQL setup

The application now uses PostgreSQL through `pg`. `MONGODB_URI` and Mongoose are no longer used. This setup creates an empty PostgreSQL application schema; it does not transfer existing MongoDB records or change a running deployment.

## Configure Aiven

1. Create or select an Aiven for PostgreSQL service and database. Use the host, port, database, username and password from its connection information. Do not assume the port is 5432. Aiven's default database is commonly `defaultdb`; use the name shown for your service.
2. Download the project's CA certificate from the service overview. Save it as `certs/aiven-ca.pem` in this project, creating `certs` if needed. PEM files are ignored by Git.
3. Copy `.env.example` to `.env.local`. Set `DATABASE_URL` to the service's PostgreSQL URI, with credentials URL-encoded as needed. Set `DATABASE_CA_CERT_PATH` to the certificate path. For hosted environments without certificate files, use `DATABASE_CA_CERT` containing the PEM text; literal `\n` sequences are supported.
4. Leave `PGSSLMODE=verify-full`. The connection verifies the certificate and hostname. URI SSL parameters are normalized so an Aiven `sslmode=require` parameter cannot replace the application's verified TLS configuration. No `rejectUnauthorized: false` workaround is used.
5. Ensure the service accepts connections from your development/deployment network. The migration user needs schema/table/index creation permissions; the runtime user needs schema USAGE and SELECT/INSERT/UPDATE/DELETE on the application tables.
6. Fill in the existing JWT and Pusher settings for the full application. Generate a JWT secret locally, for example with `node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"`.

Keep `.env.local`, database passwords, and connection strings out of Git and screenshots. The database variables are server-only; never prefix them with `NEXT_PUBLIC_`.

Official references: [Aiven Node.js connection guide](https://aiven.io/docs/products/postgresql/howto/connect-node), [node-postgres TLS configuration](https://node-postgres.com/features/ssl).

## Install and initialize

From the project root:

```powershell
npm.cmd ci
npm.cmd run db:migrate
npm.cmd run dev
```

`db:migrate` loads Next.js environment files, applies ordered SQL files in `db/migrations`, and records them in `schema_migrations`. A transaction and advisory lock protect against partial migrations and concurrent runs. Re-running it skips applied migrations. Migrations are explicit; starting/building the app does not create or alter tables automatically.

Visit `http://localhost:3000/api/health` to verify database connectivity. It should return `status: healthy` and `database: connected`. Register a new account, create a match, join from a second account, then record and undo a ball.

For a deployment, configure the same environment variables and CA certificate there, run migrations against the intended database before serving requests, and then build/start the app. `DATABASE_POOL_MAX` defaults to 5 per Node.js process; account for all deployed instances when choosing a service connection limit.

## Local PostgreSQL alternative

For an already-running local PostgreSQL instance only:

```env
DATABASE_URL="postgresql://USER:PASSWORD@127.0.0.1:5432/local_cricket_dev"
PGSSLMODE="disable"
```

The local database must already exist. Omit both CA variables for this option. Disabling TLS is rejected for remote hosts.

## Storage and compatibility

- `users`: normalized unique email, bcrypt password hash, profile fields, timestamps.
- `matches`: identity, creator foreign key, unique match code, status, schedule, venue, overs, timestamps and version.
- `match_members`: user/match/role relationships with foreign keys and deletion cascades. Created/joined match lists are derived rather than duplicated on users.
- Match teams, player statistics, scoring state and ball history are JSONB scorecards. Their existing nested API shape and `_id` string keys are preserved; new records use UUID strings. Bcrypt hashes, JWT payload shape and login cookies retain their existing formats.
- Match saves update scorecards and membership in one transaction. Version checks reject stale writes with HTTP 409 instead of overwriting a newer score.
- Leaderboards aggregate completed matches with PostgreSQL SQL and JSONB queries. The API and server-rendered page query at request time; the page shares the database query directly and no longer depends on a self-fetch to localhost or NEXT_PUBLIC_BASE_URL.

Existing MongoDB users and matches are not imported by this schema migration. If they need to be retained, export and validate them and implement a separate data import before switching production. Existing bcrypt hashes can be preserved; historical accounts without a valid hash require separate handling. No live data has been deleted or changed by this implementation.

## Verification

```powershell
npm.cmd run lint
npm.cmd run typecheck
npm.cmd test
npm.cmd run build
```

The database integration tests run actual PostgreSQL SQL in an isolated in-memory PGlite instance. They do not use `.env.local` database credentials or contact Aiven. They verify application queries, constraints, transactions, score persistence and API response shapes. They do not verify Aiven networking/TLS, multi-process concurrency, browser behavior or realtime service delivery; validate those after configuration.
