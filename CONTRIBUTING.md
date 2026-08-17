# Contributing to WorkPath Author Local

Thank you for considering a contribution. WorkPath is currently alpha software, so small, focused changes with tests are preferred.

## Development setup

Requirements:

- Node.js 24
- npm 11

From the repository root:

```bash
npm ci
npm run typecheck
npm test
npm run build
```

Run the development application with `npm run dev`, then open `http://127.0.0.1:4173`.

## Proposing a change

1. Search existing issues before opening a new one.
2. For a substantial feature or schema change, open an issue before implementation so the format and migration impact can be discussed.
3. Create a focused branch and keep unrelated changes separate.
4. Add or update tests for behavioural changes.
5. Update user or developer documentation when workflows, formats or limitations change.
6. Run the complete verification commands above before opening a pull request.

Pull requests should explain the problem, the chosen approach, user impact, validation performed and any Moodle compatibility considerations.

## Compatibility and safety

- Preserve existing project data through explicit schema migration.
- Treat uploaded archives, HTML and spreadsheets as untrusted input.
- Keep the local service bound to loopback unless a separately reviewed authenticated deployment model is introduced.
- Do not include real learner data, institutional backups, credentials or proprietary fixtures.
- Do not weaken accessibility fallbacks or Moodle-safe rendering to achieve a visual effect.

Report security vulnerabilities privately as described in [SECURITY.md](./SECURITY.md), rather than through a public issue.

## Licensing

The project licence is not yet final. Contributions cannot be accepted until the maintainer publishes the chosen licence and contribution terms.
