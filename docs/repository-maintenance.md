# Repository maintenance

## GitHub presentation

Description: **CrickLive: live cricket scorecards, ball-by-ball scoring, and league leaderboards with Next.js and PostgreSQL.**

Homepage: `https://cricklive-seven.vercel.app`

Topics: `cricket`, `scorecard`, `nextjs`, `typescript`, `react`, `postgresql`, `aiven`, `pusher`, `tailwindcss`.

The repository includes an MIT license, contribution and conduct guides, private security reporting instructions, issue forms, and a pull-request template. Dependabot checks npm dependencies and GitHub Actions weekly.

## Continuous integration

The `CI` workflow runs on pushes and pull requests to `main`, with a read-only token. It uses pinned GitHub Actions revisions, Node.js 22, and an isolated PostgreSQL service. The **Quality checks** job installs the lockfile, runs lint/types/unit and SQL tests, audits dependencies, applies migrations, builds, and tests browser workflows. Production credentials are not required.

## Protection for main

The intended policy requires a pull request, an up-to-date **Quality checks** result, and resolved review conversations before merge. Force pushes and branch deletion are blocked, and administrators follow the same policy.

The approval count is zero so a sole maintainer can merge a passing pull request without approving their own work. Add required approving reviews when another reviewer joins the project. Changes to this policy require repository administration access.
