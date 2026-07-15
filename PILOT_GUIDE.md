# WorkPath Author Local — Pilot Guide

This release is suitable for a controlled pilot. It is a source package with a guided launcher, not a signed Windows installer or a self-contained desktop application.

## Recipient requirements

- A 64-bit Windows 10 or Windows 11 computer, or a current WSL/Linux/macOS environment.
- Node.js 24 with npm 11 available on the command line.
- Internet access on first launch so npm can download the dependency versions locked by WorkPath.
- A writable local folder for the extracted application.
- Permission to run PowerShell and npm. Managed computers may require IT approval.
- One available localhost port between `4174` and `4199`.

Do not run WorkPath directly from inside the ZIP, a read-only folder, or a shared network drive. Extract the complete package first. Avoid copying `node_modules` from another computer; the launcher installs dependencies for the recipient's operating system.

## Windows instructions

1. Install Node.js 24, including npm, from the organisation's approved software source.
2. Extract the complete WorkPath ZIP to a writable local folder.
3. Double-click **Run WorkPath.cmd**.
4. Keep the terminal window open while using WorkPath.
5. Press `Ctrl+C` in the terminal, or close the terminal, to stop WorkPath.

If the application folder is under `\\wsl.localhost` or `\\wsl$`, the Windows launcher starts it inside the detected WSL distribution. Node.js 24 and npm 11 must then be installed inside that distribution.

## WSL, Linux, and macOS instructions

From the extracted WorkPath folder, run:

```bash
sh run-workpath.sh
```

If executable permissions were preserved, `./run-workpath.sh` also works. Keep that terminal open and press `Ctrl+C` to stop WorkPath.

## First launch

The first launch takes longer because WorkPath:

1. verifies Node.js 24 and npm 11;
2. installs the exact dependencies recorded in `package-lock.json`;
3. creates a production build;
4. selects an available localhost port; and
5. opens the application in the default browser.

Later launches reuse dependencies unless the operating system, processor architecture, Node/npm major version, or lockfile changes.

## Project storage

Editable projects are stored separately from the application:

```text
~/WorkPath Projects/
```

On Windows this is the current user's `WorkPath Projects` folder. Replacing the application folder does not delete these projects. Deleting a project from inside WorkPath is permanent.

## Current limitations

- Node.js is not bundled.
- The launchers and application are not code-signed.
- There is no installer, Start Menu shortcut, automatic updater, or uninstaller.
- First launch depends on npm registry access and may be blocked by an organisational proxy or application-control policy.
- The service is intended for one local user and binds to `127.0.0.1`; it must not be exposed to a network.
- Native Windows and macOS releases should be smoke-tested on representative managed computers before a broad rollout.

## Troubleshooting

- **Node.js or npm version error:** install Node.js 24 with npm 11, close the old terminal, and launch WorkPath again.
- **PowerShell is blocked:** ask IT to approve the WorkPath folder and launcher. Do not weaken organisation-wide security policy.
- **Dependency installation fails:** confirm internet and npm registry access, or ask IT whether a proxy/private registry is required.
- **The browser does not open:** copy the `http://127.0.0.1:PORT` address shown in the terminal into a browser.
- **No free port is available:** close another local WorkPath instance or software using ports `4174` through `4199`.
