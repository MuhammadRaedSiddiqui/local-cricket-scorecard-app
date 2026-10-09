# Verification

## Local checks

Run `npm run lint`, `npm run typecheck`, `npm test`, `npm audit`, and `npm run build`. Unit and SQL integration tests use an in-memory PGlite database and do not contact your configured PostgreSQL service.

Coverage currently focuses on authentication and the PostgreSQL/API workflows. `npm run test:coverage` is not a claim of complete application coverage.

## Browser checks

Browser tests create fictional accounts and matches. Use a dedicated database and application instance, never production.

1. Configure `.env.local` for that database and run `npm run db:migrate`.
2. Run `npm run build`.
3. Install Chromium with `npx playwright install chromium`.
4. Run `E2E_START_SERVER=1 npm run test:e2e` to start the production server automatically, or start the app yourself and run `npm run test:e2e`.

In PowerShell, set `$env:E2E_START_SERVER = '1'` before running the test command. For another isolated instance, set `E2E_BASE_URL` instead. The tests delete their own verification match; the isolated database retains their fixture accounts until reset.

CI uses a temporary PostgreSQL service, placeholder realtime keys, and a production server. It checks registration/login, authorization, persisted scoring/undo, and browser rendering. It does not verify actual Pusher event delivery.

## Deployed checks

Check `/api/health` for connectivity, then verify login and profile, create a clearly named verification match, join from another account, record and undo a ball, and confirm the second account receives the Pusher event. Check persistence after a fresh request. A successful build does not verify these workflows.

The optional `scripts/verify-deployment.cjs` requires `VERIFY_BASE_URL`, `VERIFY_ALLOW_WRITES=1`, and the application's public Pusher settings. It writes fictional records only, reports booleans/statuses without tokens, and deletes its verification match. Run it only against a deployment you own and have approved for test writes. It does not delete accounts automatically.

Screenshots in the README use fictional verification players. Do not publish real account details or credentials in screenshots, test artifacts, or reports.
