# WorkPath Author Local — Pilot Guide

This release is suitable for a controlled pilot. The Windows release is a portable, precompiled package with an included runtime; it is not a signed installer.

## Recipient requirements

- A 64-bit Windows 10 or Windows 11 computer.
- A writable local folder for the extracted application.
- Permission to run local PowerShell scripts and the included `node.exe`. Managed computers may require IT approval.
- One available localhost port between `4174` and `4199`.

Do not run WorkPath directly from inside the ZIP or a read-only folder. Extract the complete package first, preferably to a local Windows folder. No installation or internet connection is required.

## Windows instructions

1. Extract the complete WorkPath portable ZIP to a writable folder.
2. Double-click **Run WorkPath.cmd**.
3. Keep the terminal window open while using WorkPath.
4. Press `Ctrl+C` in the terminal, or close the terminal, to stop WorkPath.

The launcher uses the included Windows runtime before checking the computer for Node.js. A `\\wsl.localhost` path is supported, although a local Windows folder is less likely to be restricted by organisational execution policies.

## Development and non-Windows use

Source checkouts on WSL, Linux and macOS still require Node.js 24 and npm 11. From the project folder, run:

```bash
sh run-workpath.sh
```

If executable permissions were preserved, `./run-workpath.sh` also works. Keep that terminal open and press `Ctrl+C` to stop WorkPath.

## First launch

The portable application selects an available localhost port and opens the application in the default browser. It runs the included precompiled files directly, so first launch performs no package installation or build.

## Project storage

Editable projects are stored separately from the application:

```text
~/WorkPath Projects/
```

On Windows this is the current user's `WorkPath Projects` folder. Replacing the application folder does not delete these projects. Deleting a project from inside WorkPath is permanent.

## Current limitations

- The launchers and application are not code-signed.
- There is no installer, Start Menu shortcut, automatic updater, or uninstaller.
- Organisational application-control policy may need to approve the included `node.exe` and PowerShell launcher.
- The service is intended for one local user and binds to `127.0.0.1`; it must not be exposed to a network.
- Native Windows and macOS releases should be smoke-tested on representative managed computers before a broad rollout.

## Troubleshooting

- **Included runtime is blocked:** ask IT to approve the extracted WorkPath folder and its `.workpath-runtime` executable.
- **PowerShell is blocked:** ask IT to approve the WorkPath folder and launcher. Do not weaken organisation-wide security policy.
- **The browser does not open:** copy the `http://127.0.0.1:PORT` address shown in the terminal into a browser.
- **No free port is available:** close another local WorkPath instance or software using ports `4174` through `4199`.
