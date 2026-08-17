# Public release checklist

Use this checklist before changing the repository from private to public or publishing a binary release.

## Ownership and licensing

- [ ] Confirm the maintainer has permission to publish the source, product name, formats and documentation.
- [ ] Select and add the project licence.
- [ ] Confirm that the selected licence and distribution model are compatible with the self-hosted TinyMCE licence, or replace/appropriately license the editor.
- [ ] Decide whether the existing Git author name and email may remain public.
- [ ] Review [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md) and include it in release packages.

## Security and privacy

- [x] Scan the current tree and Git history for common credential and private-key patterns.
- [x] Remove institution-specific names and workstation-specific paths from public documentation.
- [x] Add a security policy and keep the server loopback-only.
- [x] Add dependency update automation and continuous integration.
- [ ] Enable GitHub private vulnerability reporting, secret scanning, push protection and Dependabot alerts when available.
- [ ] Review or resolve all dependency advisories before each release.

## Product and release quality

- [x] Document alpha status, storage behaviour, limitations and verification commands.
- [x] Verify tests, typechecking and production builds on Node.js 24.
- [ ] Add representative screenshots or a short demonstration using synthetic content only.
- [ ] Test the portable package on a representative Windows 10/11 machine.
- [ ] Decide whether unsigned alpha packages are acceptable for the intended audience.
- [ ] Create a versioned GitHub pre-release with release notes, the portable ZIP and its `.sha256` file.

## GitHub presentation

- [x] Add a concise repository description and relevant topics.
- [x] Add issue and pull-request templates.
- [ ] Add a public support/contact route and code of conduct if outside contributions will be accepted.
- [ ] Re-read every commit, workflow log and release asset before changing visibility; public repositories can be copied and forked immediately.
