import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { createServer } from "node:net";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn, spawnSync } from "node:child_process";

const root = dirname(fileURLToPath(import.meta.url));
const npm = "npm";
const windows = process.platform === "win32";
const requiredNodeMajor = 24;
const requiredNpmMajor = 11;
const installStateFile = join(root, "node_modules", ".workpath-install-state.json");
const portableManifest = join(root, "portable-release.json");

function run(command, args) {
  const result = spawnSync(command, args, { cwd: root, stdio: "inherit", shell: windows });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${command} ${args.join(" ")} failed with exit code ${result.status}.`);
}

function commandVersion(command) {
  const result = spawnSync(command, ["--version"], { cwd: root, encoding: "utf8", shell: windows });
  if (result.error || result.status !== 0) throw new Error(`${command} is required but was not found. Install Node.js ${requiredNodeMajor}, which includes npm, then try again.`);
  return String(result.stdout || result.stderr).trim().replace(/^v/, "");
}

function majorVersion(value) {
  const major = Number(value.split(".")[0]);
  if (!Number.isInteger(major)) throw new Error(`Could not understand version ${value}.`);
  return major;
}

function expectedInstallState(nodeVersion, npmVersion) {
  const lockFile = join(root, "package-lock.json");
  if (!existsSync(lockFile)) throw new Error("package-lock.json is missing. Re-download the complete WorkPath package.");
  return {
    platform: process.platform,
    architecture: process.arch,
    nodeMajor: majorVersion(nodeVersion),
    npmMajor: majorVersion(npmVersion),
    packageLockSha256: createHash("sha256").update(readFileSync(lockFile)).digest("hex")
  };
}

function dependenciesAreCurrent(expected) {
  if (!existsSync(installStateFile)) return false;
  try {
    return JSON.stringify(JSON.parse(readFileSync(installStateFile, "utf8"))) === JSON.stringify(expected);
  } catch {
    return false;
  }
}

function portAvailable(port) {
  return new Promise((resolve) => {
    const server = createServer();
    server.once("error", () => resolve(false));
    server.listen(port, "127.0.0.1", () => server.close(() => resolve(true)));
  });
}

async function choosePort() {
  if (process.env.PORT) {
    const requested = Number(process.env.PORT);
    if (!Number.isInteger(requested) || requested < 1 || requested > 65535) throw new Error(`Invalid PORT value: ${process.env.PORT}`);
    if (!await portAvailable(requested)) throw new Error(`Requested port ${requested} is already in use.`);
    return requested;
  }
  for (let port = 4174; port <= 4199; port += 1) if (await portAvailable(port)) return port;
  throw new Error("No free WorkPath port was found between 4174 and 4199.");
}

function openBrowser(url) {
  const isWsl = process.platform === "linux" && existsSync("/proc/version") && /microsoft|wsl/i.test(readFileSync("/proc/version", "utf8"));
  if (process.platform === "win32") return spawn("cmd.exe", ["/c", "start", "", url], { detached: true, stdio: "ignore" }).unref();
  if (isWsl && existsSync("/mnt/c/Windows/System32/cmd.exe")) return spawn("/mnt/c/Windows/System32/cmd.exe", ["/c", "start", "", url], { detached: true, stdio: "ignore" }).unref();
  const opener = process.platform === "darwin" ? "open" : "xdg-open";
  const opened = spawn(opener, [url], { detached: true, stdio: "ignore" });
  opened.on("error", () => console.log(`Open ${url} in your browser.`)); opened.unref();
}

async function waitForApp(url, child) {
  for (let attempt = 0; attempt < 120; attempt += 1) {
    if (child.exitCode !== null) throw new Error(`WorkPath stopped before it was ready (exit code ${child.exitCode}).`);
    try { const response = await fetch(url); if (response.ok) return; } catch { /* Server is still starting. */ }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error("WorkPath did not become ready within 30 seconds.");
}

try {
  console.log(`WorkPath folder: ${root}`);
  const nodeVersion = process.version.replace(/^v/, "");
  if (majorVersion(nodeVersion) !== requiredNodeMajor) throw new Error(`WorkPath requires Node.js ${requiredNodeMajor}. Detected Node.js ${nodeVersion}. Install Node.js ${requiredNodeMajor}, then try again.`);
  if (existsSync(portableManifest)) {
    const bundle = join(root, "apps", "server", "dist", "server.bundle.mjs");
    if (!existsSync(bundle)) throw new Error("The portable WorkPath server is missing. Re-extract the complete release ZIP.");
    const port = await choosePort(); const url = `http://127.0.0.1:${port}`;
    const child = spawn(process.execPath, [bundle], { cwd: root, env: { ...process.env, HOST: "127.0.0.1", PORT: String(port) }, stdio: "inherit" });
    const stop = () => { if (child.exitCode === null) child.kill("SIGTERM"); };
    process.on("SIGINT", stop); process.on("SIGTERM", stop);
    await waitForApp(url, child); console.log(`WorkPath is ready: ${url}`); if (process.env.WORKPATH_NO_OPEN !== "1") openBrowser(url);
    const exitCode = await new Promise((resolve) => child.once("exit", (code) => resolve(code ?? 0)));
    process.exitCode = Number(exitCode);
  } else {
  const npmVersion = commandVersion(npm);
  if (majorVersion(npmVersion) !== requiredNpmMajor) throw new Error(`WorkPath requires npm ${requiredNpmMajor}. Detected npm ${npmVersion}. Install Node.js ${requiredNodeMajor} with npm ${requiredNpmMajor}, then try again.`);
  const installState = expectedInstallState(nodeVersion, npmVersion);
  if (!dependenciesAreCurrent(installState)) {
    console.log("Installing the verified WorkPath dependencies for this computer...");
    run(npm, ["ci", "--no-audit", "--no-fund"]);
    writeFileSync(installStateFile, `${JSON.stringify(installState, null, 2)}\n`);
  }
  console.log("Preparing WorkPath..."); run(npm, ["run", "build"]);
  const port = await choosePort(); const url = `http://127.0.0.1:${port}`;
  const child = spawn(npm, ["start"], { cwd: root, env: { ...process.env, HOST: "127.0.0.1", PORT: String(port) }, stdio: "inherit", shell: windows });
  const stop = () => { if (child.exitCode === null) child.kill("SIGTERM"); };
  process.on("SIGINT", stop); process.on("SIGTERM", stop);
  await waitForApp(url, child); console.log(`WorkPath is ready: ${url}`); if (process.env.WORKPATH_NO_OPEN !== "1") openBrowser(url);
  const exitCode = await new Promise((resolve) => child.once("exit", (code) => resolve(code ?? 0)));
  process.exitCode = Number(exitCode);
  }
} catch (error) {
  console.error(`\nCould not start WorkPath: ${error instanceof Error ? error.message : error}`);
  process.exitCode = 1;
}
