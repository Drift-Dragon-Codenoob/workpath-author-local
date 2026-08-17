# Public release checklist

Use this checklist before changing the repository from private to public or publishing a binary release.

## Ownership and licensing

- [x] Record that the maintainer independently authored the source on personal time, equipment and accounts without copying an earlier implementation.
- [ ] Review the applicable employment contract and organisational IP policy because the tool relates to the maintainer's work domain.
- [x] Select and add GPL-3.0-or-later as the project licence.
- [x] Confirm GPL distribution is compatible with self-hosted TinyMCE configured with `licenseKey="gpl"`.
- [x] Confirm that the existing Git author name and email may remain public.
- [ ] Review [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md) and include it in release packages.

## Security and privacy

- [x] Scan the current tree and Git history for common credential and private-key patterns.
- [x] Remove institution-specific names and workstation-specific paths from public documentation.
- [x] Add a security policy and keep the server loopback-only.
- [x] Add dependency update automation and continuous integration.
- [ ] Enable GitHub private vulnerability reporting, secret scanning, push protection and Dependabot alerts when available.
- [x] Review the remaining ExcelJS/UUID advisory, document why the affected APIs are not used, and retain a high-severity CI audit gate.

## Product and release quality

- [x] Document alpha status, storage behaviour, limitations and verification commands.
- [x] Verify tests, typechecking and production builds on Node.js 24.
- [ ] Add representative screenshots or a short demonstration using synthetic content only.
- [ ] Test the portable package on a representative Windows 10/11 machine.
- [ ] Decide whether unsigned alpha packages are acceptable for the intended audience.
- [x] Select `v0.2.0-alpha.1` as the first public pre-release version.
- [ ] Create the GitHub pre-release with release notes, the portable ZIP and its `.sha256` file.

## GitHub presentation

- [x] Add a concise repository description and relevant topics.
- [x] Add issue and pull-request templates.
- [x] Accept public issues and pull requests under GPL-3.0-or-later, with security reports kept private.
- [ ] Add a code of conduct and an appropriate private conduct-reporting route.
- [ ] Re-read every commit, workflow log and release asset before changing visibility; public repositories can be copied and forked immediately.
