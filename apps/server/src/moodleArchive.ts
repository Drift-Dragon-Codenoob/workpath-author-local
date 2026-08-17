import path from "node:path";
import { gunzipSync } from "node:zlib";
import JSZip from "jszip";
import tar from "tar-stream";
import { assertProject, assetPackagePath, migrateProject, type AssetRecord, type BlockTemplate, type BookTheme, type Chapter, type Subchapter, type WorkPathProject } from "@workpath/core";
import { recoverContentBlocks } from "./htmlBlockRecovery.js";

export type ImportedArchiveAsset = AssetRecord & { bytes: Uint8Array };
export type MoodleArchiveImport = { title: string; unitCode?: string; chapters: Chapter[]; blockTemplates?: BlockTemplate[]; theme?: BookTheme; assets: ImportedArchiveAsset[]; warnings: string[] };

const MAX_FILES = 5000;
const MAX_UNCOMPRESSED_BYTES = 500 * 1024 * 1024;
const mimeTypes: Record<string, string> = { ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".gif": "image/gif", ".webp": "image/webp", ".svg": "image/svg+xml", ".pdf": "application/pdf", ".mp3": "audio/mpeg", ".mp4": "video/mp4", ".webm": "video/webm", ".txt": "text/plain", ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document", ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" };

export async function parseMoodleArchive(bytes: Uint8Array, filename: string, projectFolderId: string): Promise<MoodleArchiveImport> {
  const zip = await loadArchive(bytes);
  const entries = Object.values(zip.files).filter((entry) => !entry.dir);
  if (!entries.length) throw new Error("The archive is empty.");
  if (entries.length > MAX_FILES) throw new Error(`The archive contains too many files (${entries.length}; maximum ${MAX_FILES}).`);
  for (const entry of entries) assertSafeArchivePath(entry.name);
  const sourceImport = await parseWorkPathSource(zip, projectFolderId);
  if (sourceImport) return sourceImport;
  if (entries.some((entry) => /(^|\/)moodle_backup\.xml$/i.test(entry.name))) return parseMbzArchive(zip, filename, projectFolderId);
  return parseChapterImportZip(zip, filename, projectFolderId);
}

async function loadArchive(bytes: Uint8Array) {
  try { return await JSZip.loadAsync(bytes); }
  catch (zipError) {
    if (bytes[0] !== 0x1f || bytes[1] !== 0x8b) throw new Error("This file is not a supported ZIP or TGZ Moodle package.", { cause: zipError });
    try {
      const expanded = gunzipSync(bytes, { maxOutputLength: MAX_UNCOMPRESSED_BYTES }); const zip = new JSZip(); const extract = tar.extract();
      await new Promise<void>((resolve, reject) => {
        let files = 0;
        extract.on("entry", (header, stream, next) => {
          if (header.type !== "file") { stream.resume(); stream.once("end", next); return; }
          files += 1; if (files > MAX_FILES) { stream.resume(); reject(new Error(`The archive contains more than ${MAX_FILES} files.`)); return; }
          assertSafeArchivePath(header.name); const chunks: Buffer[] = [];
          stream.on("data", (chunk: Buffer) => chunks.push(Buffer.from(chunk))); stream.once("error", reject); stream.once("end", () => { zip.file(header.name, Buffer.concat(chunks)); next(); });
        });
        extract.once("finish", resolve); extract.once("error", reject); extract.end(expanded);
      });
      return zip;
    } catch (error) { throw new Error(`Could not read this TGZ-based Moodle backup. ${error instanceof Error ? error.message : "The archive is invalid."}`); }
  }
}

async function parseChapterImportZip(zip: JSZip, filename: string, projectFolderId: string): Promise<MoodleArchiveImport> {
  const htmlEntries = Object.values(zip.files).filter((entry) => !entry.dir && /\.html?$/i.test(entry.name)).sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
  if (!htmlEntries.length) throw new Error("The archive contains no Moodle Book HTML chapters.");
  const sourceAssets = Object.values(zip.files).filter((entry) => !entry.dir && !/\.html?$/i.test(entry.name) && !/(^|\/)workpath-import-report\.txt$/i.test(entry.name));
  const assets = await readAssets(sourceAssets, projectFolderId);
  const assetPaths = new Map(sourceAssets.map((entry, index) => [normaliseArchivePath(entry.name), assets[index]!]));
  const chapters: Chapter[] = []; let totalBytes = assets.reduce((sum, asset) => sum + asset.size, 0); let structured = 0; let richText = 0;
  for (const entry of htmlEntries) {
    const source = await entry.async("text"); totalBytes += Buffer.byteLength(source); checkExpandedSize(totalBytes);
    const title = htmlTitle(source) || humanTitle(path.posix.basename(entry.name).replace(/_sub\.html?$/i, "").replace(/\.html?$/i, ""));
    const summary = purposeText(source); let html = pageContent(source);
    html = rewriteLocalReferences(html, entry.name, assetPaths, projectFolderId); html = sanitiseImportedHtml(html);
    const recovered = recoverContentBlocks(html); const blocks = recovered.blocks; structured += recovered.structuredCount; richText += recovered.richTextCount;
    if (/_sub\.html?$/i.test(entry.name) && chapters.length) {
      const parent = chapters.at(-1)!; const subchapter: Subchapter = { id: crypto.randomUUID(), title, summary, order: parent.subchapters.length + 1, blocks }; parent.subchapters.push(subchapter);
    } else chapters.push({ id: crypto.randomUUID(), title, summary, order: chapters.length + 1, enabled: true, blocks, subchapters: [] });
  }
  if (!chapters.length) throw new Error("The archive does not contain a top-level Moodle Book chapter.");
  return { title: archiveTitle(filename), chapters, assets, warnings: [recoveryWarning(structured, richText)] };
}

async function parseMbzArchive(zip: JSZip, filename: string, projectFolderId: string): Promise<MoodleArchiveImport> {
  const bookFiles = Object.values(zip.files).filter((entry) => !entry.dir && /(^|\/)activities\/book_[^/]+\/book\.xml$/i.test(entry.name));
  const standaloneChapterFiles = Object.values(zip.files).filter((entry) => !entry.dir && /(^|\/)chapters\.xml$/i.test(entry.name));
  const chapterFiles = standaloneChapterFiles.length ? standaloneChapterFiles : bookFiles;
  if (!chapterFiles.length) throw new Error("This Moodle backup does not contain a Book activity.");
  const fileRecords = await moodleFileRecords(zip);
  const assets = await readMoodleAssets(fileRecords);
  fileRecords.forEach((record, index) => { record.asset = assets[index]; });
  let totalBytes = assets.reduce((sum, asset) => sum + asset.size, 0); const chapters: Chapter[] = []; let structured = 0; let richText = 0;
  for (const chapterFile of chapterFiles.sort((a, b) => a.name.localeCompare(b.name))) {
    const xml = await chapterFile.async("text"); totalBytes += Buffer.byteLength(xml); checkExpandedSize(totalBytes);
    const pages = xmlElements(xml, "chapter").map((chapter, index) => ({ chapter, page: Number(xmlValue(chapter.body, "pagenum")) || index + 1 })).sort((a, b) => a.page - b.page);
    for (const { chapter } of pages) {
      const chapterXml = chapter.body; const itemId = xmlValue(chapterXml, "id") || xmlAttribute(chapter.attributes, "id"); const title = decodeXml(xmlValue(chapterXml, "title")) || "Imported chapter";
      const sourceHtml = decodeXml(xmlValue(chapterXml, "content")); const summary = purposeText(sourceHtml);
      let html = pageContent(sourceHtml); html = rewritePluginFiles(html, itemId, fileRecords, projectFolderId); html = sanitiseImportedHtml(html);
      const recovered = recoverContentBlocks(html); const blocks = recovered.blocks; structured += recovered.structuredCount; richText += recovered.richTextCount;
      if (xmlValue(chapterXml, "subchapter") === "1" && chapters.length) {
        const parent = chapters.at(-1)!; parent.subchapters.push({ id: crypto.randomUUID(), title, summary, order: parent.subchapters.length + 1, blocks });
      } else chapters.push({ id: crypto.randomUUID(), title, summary, order: chapters.length + 1, enabled: xmlValue(chapterXml, "hidden") !== "1", blocks, subchapters: [] });
    }
  }
  if (!chapters.length) throw new Error("No Moodle Book chapters could be read from this backup.");
  const bookEntry = bookFiles[0] ?? Object.values(zip.files).find((entry) => !entry.dir && /(^|\/)book\.xml$/i.test(entry.name));
  const bookXml = bookEntry ? await bookEntry.async("text") : ""; const title = decodeXml(xmlValue(bookXml, "name")) || archiveTitle(filename);
  return { title, chapters, assets, warnings: [recoveryWarning(structured, richText)] };
}

async function parseWorkPathSource(zip: JSZip, projectFolderId: string): Promise<MoodleArchiveImport | null> {
  const entry = Object.values(zip.files).find((item) => !item.dir && /(^|\/)workpath-source\.json$/i.test(item.name));
  if (!entry) return null;
  let envelope: unknown;
  try { envelope = JSON.parse(await entry.async("text")); } catch { throw new Error("The WorkPath source manifest is not valid JSON."); }
  if (!envelope || typeof envelope !== "object" || (envelope as Record<string, unknown>).format !== "workpath-source" || (envelope as Record<string, unknown>).version !== 1) throw new Error("The WorkPath source manifest has an unsupported format.");
  const project = migrateProject((envelope as { project?: unknown }).project); assertProject(project);
  const assets: ImportedArchiveAsset[] = []; const warnings: string[] = [];
  for (const asset of project.assets) {
    const assetEntry = zip.file(assetPackagePath(asset));
    if (!assetEntry) { warnings.push(`Source asset is missing from the package: ${asset.filename}`); continue; }
    const bytes = await assetEntry.async("uint8array"); checkExpandedSize(assets.reduce((sum, item) => sum + item.size, 0) + bytes.length);
    assets.push({ ...asset, size: bytes.length, relativePath: `assets/originals/${asset.id}-${safeFilename(asset.filename)}`, bytes });
  }
  const rewritten = rewriteProjectAssetUrls(project, projectFolderId);
  return { title: rewritten.title, unitCode: rewritten.unitCode, chapters: rewritten.chapters, blockTemplates: rewritten.blockTemplates, theme: rewritten.theme, assets, warnings: ["Restored exact editable blocks from the WorkPath source manifest.", ...warnings] };
}

function rewriteProjectAssetUrls(project: WorkPathProject, projectFolderId: string): WorkPathProject {
  return JSON.parse(JSON.stringify(project).replace(/\/api\/projects\/[a-z0-9-]+\/assets\/([a-f0-9-]{36})/gi, `/api/projects/${projectFolderId}/assets/$1`)) as WorkPathProject;
}

function recoveryWarning(structured: number, richText: number) {
  return `Reconstructed ${structured} structured WorkPath block(s) from Moodle HTML; preserved ${richText} unrecognised content group(s) as rich text.`;
}

async function readAssets(entries: JSZip.JSZipObject[], projectFolderId: string) {
  const assets: ImportedArchiveAsset[] = []; let total = 0;
  for (const entry of entries) {
    const data = await entry.async("uint8array"); total += data.length; checkExpandedSize(total);
    const id = crypto.randomUUID(); const filename = safeFilename(path.posix.basename(entry.name));
    assets.push({ id, filename, mimeType: mimeTypes[path.extname(filename).toLowerCase()] ?? "application/octet-stream", size: data.length, relativePath: `assets/originals/${id}-${filename}`, bytes: data });
  }
  return assets;
}

type MoodleFileRecord = { itemId: string; filepath: string; filename: string; mimeType: string; entry: JSZip.JSZipObject; asset?: ImportedArchiveAsset };
async function moodleFileRecords(zip: JSZip) {
  const filesEntry = Object.values(zip.files).find((entry) => !entry.dir && /(^|\/)files\.xml$/i.test(entry.name)); if (!filesEntry) return [];
  const xml = await filesEntry.async("text"); const records: MoodleFileRecord[] = [];
  for (const fileXml of xmlBlocks(xml, "file")) {
    const hash = xmlValue(fileXml, "contenthash"); const filename = decodeXml(xmlValue(fileXml, "filename")); if (!hash || filename === ".") continue;
    const entry = zip.file(`files/${hash.slice(0, 2)}/${hash}`); if (!entry) continue;
    records.push({ itemId: xmlValue(fileXml, "itemid"), filepath: decodeXml(xmlValue(fileXml, "filepath")), filename, mimeType: decodeXml(xmlValue(fileXml, "mimetype")), entry });
  }
  return records;
}

async function readMoodleAssets(records: MoodleFileRecord[]) {
  const assets: ImportedArchiveAsset[] = []; let total = 0;
  for (const record of records) {
    const data = await record.entry.async("uint8array"); total += data.length; checkExpandedSize(total);
    const id = crypto.randomUUID(); const filename = safeFilename(record.filename);
    assets.push({ id, filename, mimeType: record.mimeType && record.mimeType !== "$@NULL@$" ? record.mimeType : mimeTypes[path.extname(filename).toLowerCase()] ?? "application/octet-stream", size: data.length, relativePath: `assets/originals/${id}-${filename}`, bytes: data });
  }
  return assets;
}

function rewritePluginFiles(html: string, itemId: string, records: MoodleFileRecord[], projectFolderId: string) {
  return html.replace(/(["'])(?:@@PLUGINFILE@@|\$@PLUGINFILE@\$)\/([^"']+)\1/gi, (whole, quote: string, source: string) => {
    const decoded = decodeURIComponentSafe(source.split(/[?#]/)[0]!); const record = records.find((item) => item.itemId === itemId && normaliseArchivePath(`${item.filepath}/${item.filename}`).endsWith(normaliseArchivePath(decoded)));
    return record?.asset ? `${quote}/api/projects/${projectFolderId}/assets/${record.asset.id}${quote}` : whole;
  });
}

function rewriteLocalReferences(html: string, htmlPath: string, assetPaths: Map<string, ImportedArchiveAsset>, projectFolderId: string) {
  return html.replace(/\b(src|href)=(['"])([^'"#][^'"]*)\2/gi, (whole, attribute: string, quote: string, source: string) => {
    if (/^(?:[a-z]+:|\/\/|\/api\/)/i.test(source)) return whole;
    const withoutSuffix = decodeURIComponentSafe(source.split(/[?#]/)[0]!); const resolved = normaliseArchivePath(path.posix.join(path.posix.dirname(htmlPath), withoutSuffix)); const asset = assetPaths.get(resolved);
    return asset ? `${attribute}=${quote}/api/projects/${projectFolderId}/assets/${asset.id}${quote}` : whole;
  });
}

function pageContent(source: string) {
  const main = source.match(/<main\b[^>]*class=(['"])[^'"]*\bworkpath-book\b[^'"]*\1[^>]*>([\s\S]*?)<\/main>/i)?.[2] ?? source.match(/<body\b[^>]*>([\s\S]*?)<\/body>/i)?.[1] ?? source;
  return main.replace(/^\s*<h1\b[^>]*>[\s\S]*?<\/h1>/i, "").replace(/^\s*<p\b[^>]*>\s*<strong>\s*Purpose:\s*<\/strong>[\s\S]*?<\/p>/i, "").replace(/<nav\b[^>]*aria-label=(['"])Subchapters\1[^>]*>[\s\S]*?<\/nav>\s*$/i, "");
}

function sanitiseImportedHtml(source: string) {
  const safeIframes: string[] = [];
  const protectedSource = source.replace(/<iframe\b([^>]*)>[\s\S]*?<\/iframe>/gi, (_whole, attributes: string) => {
    const src = htmlAttribute(attributes, "src"); if (!approvedImportedVideoUrl(src)) return "";
    const title = htmlAttribute(attributes, "title"); const token = `WORKPATH_SAFE_IFRAME_${safeIframes.length}_TOKEN`;
    safeIframes.push(`<iframe src="${escapeAttribute(src)}"${title ? ` title="${escapeAttribute(title)}"` : ""} allowfullscreen></iframe>`); return token;
  });
  let sanitised = protectedSource.replace(/<(script|iframe|object|embed|form)\b[^>]*>[\s\S]*?<\/\1>/gi, "").replace(/<(script|iframe|object|embed|form)\b[^>]*\/?\s*>/gi, "").replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "").replace(/(href|src)\s*=\s*(["'])\s*javascript:[\s\S]*?\2/gi, '$1="#"');
  safeIframes.forEach((iframe, index) => { sanitised = sanitised.replace(`WORKPATH_SAFE_IFRAME_${index}_TOKEN`, iframe); });
  return sanitised;
}

function htmlAttribute(source: string, name: string) { return source.match(new RegExp(`\\b${name}\\s*=\\s*(["'])(.*?)\\1`, "i"))?.[2] ?? ""; }
function approvedImportedVideoUrl(value: string) { try { const url = new URL(value); return url.protocol === "https:" && (url.hostname === "www.youtube-nocookie.com" || url.hostname === "www.youtube.com" || url.hostname === "player.vimeo.com" || url.hostname.endsWith("microsoftstream.com") || url.hostname.endsWith("sharepoint.com")); } catch { return false; } }
function escapeAttribute(value: string) { return value.replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;").replaceAll(">", "&gt;"); }

function htmlTitle(source: string) { return decodeXml(source.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? source.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i)?.[1] ?? "").replace(/<[^>]+>/g, "").trim(); }
function purposeText(source: string) { return decodeXml(source.match(/<p\b[^>]*>\s*<strong>\s*Purpose:\s*<\/strong>\s*([\s\S]*?)<\/p>/i)?.[1] ?? "").replace(/<[^>]+>/g, "").trim(); }
function archiveTitle(filename: string) { return humanTitle(path.basename(filename).replace(/\.(?:zip|mbz)$/i, "").replace(/-[a-z0-9]{8}-moodle-book.*$/i, "").replace(/-moodle-book.*$/i, "")); }
function humanTitle(value: string) {
  const cleaned = value.replace(/^\d+[-_ ]+\d+[-_ ]+/, "").replace(/[-_]+/g, " ").replace(/\s+/g, " ").trim();
  return cleaned.split(" ").map((word) => /^(?:ai|ml|dl|ict[a-z]*\d+)$/i.test(word) ? word.toUpperCase() : `${word.charAt(0).toUpperCase()}${word.slice(1).toLowerCase()}`).join(" ") || "Imported Moodle Book";
}
function safeFilename(value: string) { return value.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-|-$/g, "") || "asset"; }
function normaliseArchivePath(value: string) { return path.posix.normalize(value.replaceAll("\\", "/").replace(/^\.\//, "")).replace(/^\/+/, ""); }
function assertSafeArchivePath(value: string) { const normalised = normaliseArchivePath(value); if (!normalised || normalised === ".." || normalised.startsWith("../") || /^[a-z]:/i.test(value)) throw new Error(`Unsafe archive path: ${value}`); }
function checkExpandedSize(size: number) { if (size > MAX_UNCOMPRESSED_BYTES) throw new Error("The expanded archive is larger than 500 MB."); }
function decodeURIComponentSafe(value: string) { try { return decodeURIComponent(value); } catch { return value; } }
function xmlBlocks(source: string, tag: string) { return [...source.matchAll(new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)<\\/${tag}>`, "gi"))].map((match) => match[1] ?? ""); }
function xmlElements(source: string, tag: string) { return [...source.matchAll(new RegExp(`<${tag}\\b([^>]*)>([\\s\\S]*?)<\\/${tag}>`, "gi"))].map((match) => ({ attributes: match[1] ?? "", body: match[2] ?? "" })); }
function xmlAttribute(source: string, name: string) { return source.match(new RegExp(`\\b${name}\\s*=\\s*(["'])(.*?)\\1`, "i"))?.[2] ?? ""; }
function xmlValue(source: string, tag: string) { return source.match(new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i"))?.[1]?.trim().replace(/^<!\[CDATA\[|\]\]>$/g, "") ?? ""; }
function decodeXml(value: string) { return value.replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code))).replace(/&#x([\da-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16))).replaceAll("&quot;", '"').replaceAll("&apos;", "'").replaceAll("&lt;", "<").replaceAll("&gt;", ">").replaceAll("&amp;", "&"); }
