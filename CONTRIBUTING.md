# Contributing

Open an issue to describe a bug or propose a substantial feature before implementing it. For small fixes, open a pull request directly.

## Local development

Use Node.js 22 or 24 and npm. Follow the [README](README.md) and [PostgreSQL setup guide](docs/postgresql-setup.md). Keep credentials in ignored environment files. Use a development database; never run automated fixtures against production.

Before submitting a pull request, run:

```sh
npm ci
npm run lint
npm run typecheck
npm test
npm audit
npm run build
```

For changes to authentication, scoring, or storage, run the browser tests against an isolated database: `npm run test:e2e`. See [verification instructions](docs/verification.md).

Describe the user-visible behavior, include relevant screenshots for UI changes, and report checks and any remaining limitations. Add meaningful regression tests for behavior changes. Keep dependency upgrades and unrelated feature changes separate when practical.

## Pull requests

Submit changes through a pull request to `main`. CI must pass before merging. Do not include `.env.local`, connection strings, tokens, certificates, logs, or real user data. Use fictional fixture names and addresses.

Contributions are licensed under the project's [MIT license](LICENSE).
