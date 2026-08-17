import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync, copyFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import JSZip from "jszip";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const appVersion = JSON.parse(readFileSync(join(root, "package.json"), "utf8")).version;
const nodeVersion = "24.19.0";
const runtimeName = `node-v${nodeVersion}-win-x64`;
const cacheDir = join(root, ".workpath-cache", runtimeName);
const releaseName = "WorkPath-Author-Local-portable-win-x64";
const releaseDir = join(root, "release", releaseName);
const releaseZip = join(root, "release", `${releaseName}.zip`);
const releaseChecksum = `${releaseZip}.sha256`;

function run(command, args) {
  const result = spawnSync(command, args, { cwd: root, stdio: "inherit", shell: process.platform === "win32" });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${command} ${args.join(" ")} failed with exit code ${result.status}.`);
}

async function prepareRuntime() {
  const supplied = process.env.WORKPATH_WINDOWS_NODE_DIR;
  if (supplied) {
    if (!existsSync(join(supplied, "node.exe"))) throw new Error("WORKPATH_WINDOWS_NODE_DIR does not contain node.exe.");
    return supplied;
  }
  if (existsSync(join(cacheDir, "node.exe")) && existsSync(join(cacheDir, ".verified-source-sha256"))) return cacheDir;
  const url = `https://nodejs.org/dist/v${nodeVersion}/${runtimeName}.zip`;
  console.log(`Downloading the portable Node.js runtime from ${url}`);
  const response = await fetch(url); if (!response.ok) throw new Error(`Could not download Node.js (${response.status}).`);
  const archiveBytes = Buffer.from(await response.arrayBuffer());
  const checksumsResponse = await fetch(`https://nodejs.org/dist/v${nodeVersion}/SHASUMS256.txt`); if (!checksumsResponse.ok) throw new Error(`Could not download Node.js checksums (${checksumsResponse.status}).`);
  const checksums = await checksumsResponse.text(); const expected = checksums.match(new RegExp(`^([a-f0-9]{64})\\s+${runtimeName}\\.zip$`, "m"))?.[1];
  if (!expected) throw new Error(`Node.js checksums do not list ${runtimeName}.zip.`);
  const actual = createHash("sha256").update(archiveBytes).digest("hex");
  if (actual !== expected) throw new Error(`Node.js runtime checksum mismatch: expected ${expected}, received ${actual}.`);
  const archive = await JSZip.loadAsync(archiveBytes); mkdirSync(cacheDir, { recursive: true });
  for (const filename of ["node.exe", "LICENSE"]) {
    const entry = archive.file(`${runtimeName}/${filename}`); if (!entry) throw new Error(`Node.js archive is missing ${filename}.`);
    writeFileSync(join(cacheDir, filename), Buffer.from(await entry.async("uint8array")));
  }
  writeFileSync(join(cacheDir, ".verified-source-sha256"), `${actual}\n`);
  return cacheDir;
}

function copyTree(source, target) {
  mkdirSync(target, { recursive: true });
  for (const entry of readdirSync(source, { withFileTypes: true })) {
    const from = join(source, entry.name); const to = join(target, entry.name);
    if (entry.isDirectory()) copyTree(from, to); else if (entry.isFile()) copyFileSync(from, to);
  }
}

function addTree(zip, directory) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const target = join(directory, entry.name);
    if (entry.isDirectory()) addTree(zip, target); else if (entry.isFile()) zip.file(relative(releaseDir, target).replaceAll("\\", "/"), readFileSync(target));
  }
}

console.log("Building WorkPath application…");
run(process.platform === "win32" ? "npm.cmd" : "npm", ["run", "build"]);
run(join(root, "node_modules", ".bin", process.platform === "win32" ? "esbuild.cmd" : "esbuild"), ["apps/server/src/server.ts", "--bundle", "--platform=node", "--format=esm", "--target=node24", '--banner:js=import { createRequire } from "node:module"; const require = createRequire(import.meta.url);', "--outfile=apps/server/dist/server.bundle.mjs"]);
const runtimeDir = await prepareRuntime();

rmSync(releaseDir, { recursive: true, force: true }); rmSync(releaseZip, { force: true }); rmSync(releaseChecksum, { force: true });
mkdirSync(join(releaseDir, "apps", "server", "dist"), { recursive: true });
copyFileSync(join(root, "apps", "server", "dist", "server.bundle.mjs"), join(releaseDir, "apps", "server", "dist", "server.bundle.mjs"));
copyTree(join(root, "apps", "web", "dist"), join(releaseDir, "apps", "web", "dist"));
for (const filename of ["Run WorkPath.cmd", "Run WorkPath.ps1", "run-workpath.mjs", "README.md", "PILOT_GUIDE.md", "LICENSE", "THIRD_PARTY_NOTICES.md"]) copyFileSync(join(root, filename), join(releaseDir, filename));
writeFileSync(join(releaseDir, "SOURCE.md"), `# Corresponding source\n\nThis portable package was built from WorkPath Author Local v${appVersion}.\n\nThe complete corresponding source is available at:\n\nhttps://github.com/Drift-Dragon-Codenoob/workpath-author-local/tree/v${appVersion}\n\nBuild instructions are in README.md. The portable package is produced with \`npm run release:windows\`.\n`);
const packagedRuntime = join(releaseDir, ".workpath-runtime", runtimeName); mkdirSync(packagedRuntime, { recursive: true });
copyFileSync(join(runtimeDir, "node.exe"), join(packagedRuntime, "node.exe"));
if (existsSync(join(runtimeDir, "LICENSE"))) copyFileSync(join(runtimeDir, "LICENSE"), join(packagedRuntime, "LICENSE"));
writeFileSync(join(releaseDir, "portable-release.json"), `${JSON.stringify({ format: 1, appVersion, nodeVersion, platform: "win32", architecture: "x64", builtAt: new Date().toISOString() }, null, 2)}\n`);

console.log("Creating portable release ZIP…");
const zip = new JSZip(); addTree(zip, releaseDir);
const releaseBytes = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE", compressionOptions: { level: 6 } }); writeFileSync(releaseZip, releaseBytes);
const checksum = createHash("sha256").update(releaseBytes).digest("hex"); writeFileSync(releaseChecksum, `${checksum}  ${releaseName}.zip\n`);
console.log(`Portable release ready: ${releaseZip}`); console.log(`SHA-256: ${checksum}`);
