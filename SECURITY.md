# Security

Security fixes target the current `main` branch. Update to its latest tested release before reporting an issue.

Report exploitable issues privately through [GitHub private vulnerability reporting](https://github.com/MuhammadRaedSiddiqui/local-cricket-scorecard-app/security/advisories/new). Do not publish credentials, personal data, or exploit details in public issues. Include the affected version, reproduction steps using fictional data, impact, and any suggested mitigation. Response time depends on maintainer availability.

Keep database credentials, JWT secrets and Pusher server secrets in environment settings. Never put them in `NEXT_PUBLIC_*` variables. PostgreSQL connections to remote services require certificate and hostname verification. Logs and PEM files are ignored; check staged files before committing.

CI checks the locked dependency tree with `npm audit`. An audit result describes known dependency advisories; it does not replace review of application access controls or deployment configuration.
