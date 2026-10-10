# Repository health verification

Report date: 10 October 2026. Application changes: [`21fc5f5`](https://github.com/MuhammadRaedSiddiqui/local-cricket-scorecard-app/commit/21fc5f54136ca12b2d23de9c68666f85c0138d10).

## Dependencies and compatibility

The initial full dependency audit reported 82 affected entries (2 critical, 59 high, 19 moderate, 2 low). After upgrades and removal of unused dependencies, both the local audit and GitHub CI reported **zero known vulnerabilities** across production and development dependencies.

Framework upgrades include Next.js 16.4, React 19.3, Tailwind CSS 4.3, and Sentry 11.6. Route parameters and the Next.js proxy entry point were migrated, and the production build was verified. Vulnerable development dependency trees were removed by replacing Jest with Vitest and the legacy Next.js lint configuration with flat ESLint configuration. The lockfile installs without force or legacy peer dependency flags.

ESLint remains on version 9 because the React lint plugin's peer range does not support version 10. TypeScript remains on 5.9, which is compatible with the current lint tooling. Dependabot proposes upgrades; major upgrades must pass checks and compatibility review before merging. A clean audit is a point-in-time result, not proof that the application has no security defects.

## Automated checks

[GitHub CI passed](https://github.com/MuhammadRaedSiddiqui/local-cricket-scorecard-app/actions/runs/37979034750), including:

| Check | Result |
| --- | --- |
| Clean lockfile install | Passed |
| Lint and TypeScript | Passed |
| Unit and SQL/API tests | 16 passed across 4 files |
| Dependency audit | Zero known vulnerabilities |
| PostgreSQL migrations | Passed on an isolated PostgreSQL 17 service |
| Production build | Passed |
| Browser workflows | 3 passed |

Local coverage passed: **91.66% statements/lines, 81.81% branches, 100% functions** for the login and register routes only. SQL/API tests execute real queries against isolated PGlite. Browser CI uses placeholder Pusher keys and therefore does not verify live realtime delivery.

## Hosted workflows

Both Vercel projects were configured with the intended Aiven database, verified TLS CA, JWT secret, and Pusher settings, then successfully redeployed. Credentials and certificates were not committed or included in this report.

The same approved verification passed on [the primary app](https://cricklive-seven.vercel.app) and [the second deployment](https://local-cricket-scorecard-app.vercel.app):

- PostgreSQL health, anonymous access denial, registration, browser login/profile, invalid-password rejection, and logout.
- Match creation, viewer joining, viewer edit rejection, starting and configuring players.
- Recording a boundary and fetching persisted team, batting, and bowling statistics.
- A second authenticated browser subscribing to its private Pusher channel and receiving both scored-ball and undo events.
- Scoring page rendering, persisted undo, and leaderboard availability.

Each verification match was deleted. The six exact fixture accounts from the local build and both deployments were subsequently removed from PostgreSQL. Raw verification reports remain ignored under `test-results/`; they contain no passwords or tokens.

These checks demonstrate the named scenarios. They do not exhaust every dismissal, extras, innings-transition, concurrency, load, or connection-recovery case. Landing-page scores and usage counts remain illustrative sample content. README screenshots were captured from the tested production build with fictional players.

## Repository presentation

The README now documents features, stack, setup, checks, deployment, project layout, and actual screenshots. GitHub description and nine topics are configured. MIT licensing, contribution/conduct/security guides, issue forms, a pull-request template, weekly Dependabot updates, and pinned CI actions are present. Private vulnerability reporting is enabled.

GitHub's community-profile API reports **100% completeness**. This measures repository metadata and files, not application security or test completeness. The main-branch protection policy is documented in [repository maintenance](repository-maintenance.md).
