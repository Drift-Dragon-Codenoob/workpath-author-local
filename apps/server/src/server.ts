import { readFile } from "node:fs/promises";
import http, { type IncomingMessage, type ServerResponse } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { WorkPathProject } from "@workpath/core";
import { verifyStoryboardRows, type StoryboardRowInput } from "@workpath/core";
import { addProjectImage, createStoredProject, exportProject, getProjectPage, importStoredProject, importStoryboardPage, initialiseStore, listProjects, loadProject, readProjectAsset, saveProject } from "./store.js";
import { createStoryboardTemplate, exportStoryboard, exportStoryboardCsv, parseStoryboardFile } from "./storyboardWorkbook.js";

const host = process.env.HOST || "127.0.0.1";
const port = Number(process.env.PORT || 4174);
const webDist = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../web/dist");

function json(response: ServerResponse, status: number, value: unknown) {
  response.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Access-Control-Allow-Origin": "http://127.0.0.1:4173" });
  response.end(JSON.stringify(value));
}

async function body(request: IncomingMessage) {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of request) {
    const buffer = Buffer.from(chunk);
    size += buffer.length;
    if (size > 20 * 1024 * 1024) throw new Error("Request is too large.");
    chunks.push(buffer);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
}

async function binaryBody(request: IncomingMessage) {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of request) {
    const buffer = Buffer.from(chunk); size += buffer.length;
    if (size > 20 * 1024 * 1024) throw new Error("Uploaded file is too large (20 MB maximum).");
    chunks.push(buffer);
  }
  return new Uint8Array(Buffer.concat(chunks));
}

async function api(request: IncomingMessage, response: ServerResponse, url: URL) {
  if (request.method === "OPTIONS") {
    response.writeHead(204, { "Access-Control-Allow-Origin": "http://127.0.0.1:4173", "Access-Control-Allow-Headers": "content-type,x-filename,x-project-revision", "Access-Control-Allow-Methods": "GET,POST,PUT,OPTIONS" });
    return response.end();
  }
  if (url.pathname === "/api/projects" && request.method === "GET") return json(response, 200, await listProjects());
  if (url.pathname === "/api/projects" && request.method === "POST") {
    const input = await body(request) as { title?: string };
    return json(response, 201, await createStoredProject(input.title || "Untitled Moodle Book"));
  }
  if (url.pathname === "/api/storyboard/template.xlsx" && request.method === "GET") {
    const bytes = await createStoryboardTemplate(); response.writeHead(200, { "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "Content-Disposition": "attachment; filename=workpath-storyboard-template.xlsx" }); return response.end(Buffer.from(bytes));
  }
  if (url.pathname === "/api/storyboard/verify" && request.method === "POST") return json(response, 200, await parseStoryboardFile(await binaryBody(request), url.searchParams.get("filename") || "storyboard.xlsx"));
  const storyboardExport = url.pathname.match(/^\/api\/projects\/([a-z0-9-]+)\/pages\/([a-f0-9-]{36})\/storyboard\.(xlsx|csv)$/);
  if (storyboardExport?.[1] && storyboardExport[2] && storyboardExport[3] && request.method === "GET") {
    const page = await getProjectPage(storyboardExport[1], storyboardExport[2]);
    if (storyboardExport[3] === "csv") { const csv = exportStoryboardCsv(page); response.writeHead(200, { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${page.id}-storyboard.csv"` }); return response.end(csv); }
    const bytes = await exportStoryboard(page); response.writeHead(200, { "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "Content-Disposition": `attachment; filename="${page.id}-storyboard.xlsx"` }); return response.end(Buffer.from(bytes));
  }
  const storyboardImport = url.pathname.match(/^\/api\/projects\/([a-z0-9-]+)\/storyboard\/import$/);
  if (storyboardImport?.[1] && request.method === "POST") {
    const input = await body(request) as { kind?: "chapter" | "subchapter"; parentChapterId?: string; revision?: number; rows?: StoryboardRowInput[] };
    if (input.kind !== "chapter" && input.kind !== "subchapter") throw new Error("Import target must be chapter or subchapter.");
    const verification = verifyStoryboardRows(input.rows ?? []); if (!verification.valid) return json(response, 400, { error: "Storyboard has validation errors.", verification });
    return json(response, 201, await importStoryboardPage(storyboardImport[1], { kind: input.kind, parentChapterId: input.parentChapterId, title: verification.title, blocks: verification.rows.flatMap((row) => row.block ? [row.block] : []), revision: Number(input.revision) }));
  }
  if (url.pathname === "/api/import/legacy" && request.method === "POST") return json(response, 201, await importStoredProject(await body(request)));
  const assetMatch = url.pathname.match(/^\/api\/projects\/([a-z0-9-]+)\/assets(?:\/([a-f0-9-]{36}))?$/);
  if (assetMatch?.[1] && request.method === "POST" && !assetMatch[2]) {
    const filename = decodeURIComponent(String(request.headers["x-filename"] || "image"));
    const revision = Number(request.headers["x-project-revision"]);
    if (!Number.isInteger(revision)) throw new Error("Project revision is required.");
    return json(response, 201, await addProjectImage(assetMatch[1], filename, String(request.headers["content-type"] || "application/octet-stream"), await binaryBody(request), revision));
  }
  if (assetMatch?.[1] && assetMatch[2] && request.method === "GET") {
    const result = await readProjectAsset(assetMatch[1], assetMatch[2]);
    response.writeHead(200, { "Content-Type": result.asset.mimeType, "Content-Length": result.bytes.length, "Cache-Control": "private, max-age=3600", "Access-Control-Allow-Origin": "http://127.0.0.1:4173" });
    return response.end(result.bytes);
  }
  const match = url.pathname.match(/^\/api\/projects\/([a-z0-9-]+)(\/export)?$/);
  if (!match?.[1]) return json(response, 404, { error: "Not found" });
  const id = match[1];
  if (match[2] === "/export" && (request.method === "POST" || request.method === "GET")) {
    const result = await exportProject(id);
    response.writeHead(200, { "Content-Type": "application/zip", "Content-Disposition": `attachment; filename="${id}-moodle-book.zip"`, "Access-Control-Allow-Origin": "http://127.0.0.1:4173" });
    return response.end(Buffer.from(result.bytes));
  }
  if (request.method === "GET") return json(response, 200, await loadProject(id));
  if (request.method === "PUT") return json(response, 200, await saveProject(id, await body(request) as WorkPathProject));
  return json(response, 405, { error: "Method not allowed" });
}

async function serveWeb(response: ServerResponse, url: URL) {
  const requested = url.pathname === "/" ? "index.html" : url.pathname.replace(/^\/+/, "");
  const target = path.resolve(webDist, requested);
  if (!target.startsWith(webDist)) { response.writeHead(403); return response.end(); }
  let data: Buffer;
  try { data = await readFile(target); } catch { data = await readFile(path.join(webDist, "index.html")); }
  const extension = path.extname(target);
  response.writeHead(200, { "Content-Type": extension === ".js" ? "text/javascript" : extension === ".css" ? "text/css" : "text/html" });
  response.end(data);
}

await initialiseStore();
http.createServer(async (request, response) => {
  try {
    const url = new URL(request.url || "/", `http://${host}:${port}`);
    if (url.pathname.startsWith("/api/")) await api(request, response, url); else await serveWeb(response, url);
  } catch (error) {
    json(response, 400, { error: error instanceof Error ? error.message : "Request failed" });
  }
}).listen(port, host, () => console.log(`WorkPath Local API: http://${host}:${port}`));
