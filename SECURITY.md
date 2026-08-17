# Security policy

## Supported versions

WorkPath Author Local is currently alpha software. Security fixes are applied to the latest commit on `main`; older tags are not supported unless a release explicitly says otherwise.

## Reporting a vulnerability

Do not open a public issue for a suspected vulnerability or include private project data in a report.

Use the repository's **Security → Report a vulnerability** option to submit a private GitHub security advisory. Include:

- the affected version or commit;
- reproduction steps or a minimal non-sensitive fixture;
- the expected and observed behaviour;
- the likely impact; and
- any suggested mitigation.

If private vulnerability reporting is unavailable while the repository remains private, contact the maintainer through GitHub without publishing exploit details.

## Deployment boundary

WorkPath is a single-user local application. Its HTTP service binds to `127.0.0.1` and has no network authentication. Do not expose it to a LAN, reverse proxy or the public internet. Managed-device distribution should also assess code signing and application-control requirements.
