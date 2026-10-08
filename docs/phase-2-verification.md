# Phase 2 implementation and verification

Implemented on 2026-10-08 on `main`, preserving the existing uncommitted Phase 1 changes.

## Changes

- Escaped five JSX apostrophes without changing the displayed text.
- Removed the unused import of the absent `ScoreCard` component and its obsolete commented usage; the page continues to render `ModernScorecard`.
- Added the API's existing `draws` field to the shared `TeamStats` interface and removed the duplicate component-local interface.
- Captured both teams after the existing scorecard loading guard so result/share callbacks use narrowed team values. Match-result calculations are unchanged.
- Memoized four match-fetch callbacks and corrected their effect dependencies. The live page retains its ten-second refresh interval and cleanup.
- Made the dashboard subscription depend on the user ID and stable update callback, preserving subscription cleanup.
- Named the existing API client singleton before its default export.
- Removed `typescript.ignoreBuildErrors` from `next.config.js`. Production builds now use the default TypeScript validation.

No lint rules or TypeScript errors were suppressed. Authentication logic, dependency versions, sample/demo data, and README presentation were not changed in this phase.

## Verification

| Check | Result |
| --- | --- |
| `npm.cmd run lint` | Passed with no warnings or errors; previously 5 errors and 6 warnings. |
| `npm.cmd run typecheck` | Passed; previously 10 errors. |
| `npm.cmd test` | Passed: 5 tests across 2 suites. |
| `npm.cmd run build` | Compilation, lint, and TypeScript validation passed; page-data collection failed because `MONGODB_URI` is missing. |
| Diff whitespace check | Passed. |

The tests remain isolated unit tests; they do not certify database-backed authentication or full E2E scoring behavior.

The initial build attempt was stopped after the sandbox blocked Google Fonts. The network-enabled retry compiled successfully and completed lint/type validation with the bypass removed. Importing the database module during page-data collection then reported `Please define the MONGODB_URI environment variable`, and the build exited with code 1 while collecting `/api/auth/me`.

The code-check portion of Phase 2 passes. A complete production build remains unverified until valid service configuration is available; production readiness is not certified.

## Environment

Only configuration presence was checked; no secret values were printed. No local `.env*` file was found, and the current process does not configure:

- `MONGODB_URI`
- `JWT_SECRET`
- `PUSHER_APP_ID`
- `NEXT_PUBLIC_PUSHER_KEY`
- `PUSHER_SECRET`
- `NEXT_PUBLIC_PUSHER_CLUSTER`
- `NEXT_PUBLIC_BASE_URL`

The leaderboard page currently falls back to `http://localhost:3000` when the base URL is absent. The database and Pusher modules also require their service configuration. No dummy credentials or build-time validation bypasses were added.

## Reproducing verification

Run from the repository root:

```powershell
npm.cmd run lint
npm.cmd run typecheck
npm.cmd test
npm.cmd run build
```

To complete build verification, configure valid development service settings locally (for example in the already ignored `.env.local`) and rerun the build with Google Fonts access. The first observed configuration blocker is `MONGODB_URI`; MongoDB connectivity, Pusher integration, and later build stages remain unverified.
