import { existsSync, readFileSync } from "node:fs";
import { createServer } from "node:net";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn, spawnSync } from "node:child_process";

const root = dirname(fileURLToPath(import.meta.url));
const npm = "npm";
const windows = process.platform === "win32";

function run(command, args) {
  const result = spawnSync(command, args, { cwd: root, stdio: "inherit", shell: windows });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${command} ${args.join(" ")} failed with exit code ${result.status}.`);
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
  const dependencyMarker = join(root, "node_modules", ".bin", windows ? "tsc.cmd" : "tsc");
  if (!existsSync(dependencyMarker)) { console.log("Installing WorkPath dependencies for this operating environment..."); run(npm, ["install"]); }
  console.log("Preparing WorkPath..."); run(npm, ["run", "build"]);
  const port = await choosePort(); const url = `http://127.0.0.1:${port}`;
  const child = spawn(npm, ["start"], { cwd: root, env: { ...process.env, HOST: "127.0.0.1", PORT: String(port) }, stdio: "inherit", shell: windows });
  const stop = () => { if (child.exitCode === null) child.kill("SIGTERM"); };
  process.on("SIGINT", stop); process.on("SIGTERM", stop);
  await waitForApp(url, child); console.log(`WorkPath is ready: ${url}`); if (process.env.WORKPATH_NO_OPEN !== "1") openBrowser(url);
  const exitCode = await new Promise((resolve) => child.once("exit", (code) => resolve(code ?? 0)));
  process.exitCode = Number(exitCode);
} catch (error) {
  console.error(`\nCould not start WorkPath: ${error instanceof Error ? error.message : error}`);
  process.exitCode = 1;
}
