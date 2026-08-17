import JSZip from "jszip";
import type { AssetRecord, BookTheme, WorkPathProject } from "./schema.js";
import { assetPackagePath, renderContentBlock, validateBlock } from "./widgets.js";

export type CompileInput = { project: WorkPathProject; readAsset: (asset: AssetRecord) => Promise<Uint8Array> };
export type CompileResult = { bytes: Uint8Array; report: string[] };

const escapeHtml = (value: string) => value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
const slug = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "untitled";

function documentHtml(title: string, content: string, theme: BookTheme) {
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(title)}</title><style>
.workpath-book{background:${theme.contentBackground};color:${theme.body.color};font-family:${theme.body.fontFamily};font-size:${theme.body.fontSize}px;font-weight:${theme.body.fontWeight};line-height:${theme.body.lineHeight};padding:1.5rem}
.workpath-book h1{color:${theme.h1.color};font-family:${theme.h1.fontFamily};font-size:${theme.h1.fontSize}px;font-weight:${theme.h1.fontWeight};line-height:${theme.h1.lineHeight}}
.workpath-book h2{color:${theme.h2.color};font-family:${theme.h2.fontFamily};font-size:${theme.h2.fontSize}px;font-weight:${theme.h2.fontWeight};line-height:${theme.h2.lineHeight}}
.workpath-book h3{color:${theme.h3.color};font-family:${theme.h3.fontFamily};font-size:${theme.h3.fontSize}px;font-weight:${theme.h3.fontWeight};line-height:${theme.h3.lineHeight}}
.workpath-book img{height:auto;max-width:100%}</style></head><body style="background:${theme.pageBackground};margin:0"><div class="workpath-page" style="background:${theme.pageBackground};box-sizing:border-box;padding:40px 6%;width:100%"><main class="workpath-book" style="background:${theme.contentBackground};box-sizing:border-box;color:${theme.body.color};font-family:${theme.body.fontFamily};font-size:${theme.body.fontSize}px;font-weight:${theme.body.fontWeight};line-height:${theme.body.lineHeight};margin:0 auto;max-width:980px;padding:50px 60px">${content}</main></div></body></html>`;
}

export async function compileMoodleBook({ project, readAsset }: CompileInput): Promise<CompileResult> {
  const zip = new JSZip();
  const report: string[] = [];
  const chapters = [...project.chapters].filter((item) => item.enabled).sort((a, b) => a.order - b.order);
  if (!chapters.length) throw new Error("The book needs at least one enabled chapter.");
  const pages = chapters.flatMap((chapter) => [{ title: chapter.title, blocks: chapter.blocks }, ...chapter.subchapters.map((subchapter) => ({ title: subchapter.title, blocks: subchapter.blocks }))]);
  const issueDetails = pages.flatMap((page) => page.blocks.flatMap((block) => validateBlock(block).map((issue) => ({ text: `${page.title}: ${issue.message}`, blocking: issue.message !== "Rich text block is empty." && !isMissingImageFallback(block, issue.message) }))));
  const issues = issueDetails.map((issue) => issue.text);
  const blockingIssues = issueDetails.filter((issue) => issue.blocking).map((issue) => issue.text);
  if (blockingIssues.length) throw new Error(`Resolve export validation issues: ${blockingIssues.join("; ")}`);

  let topicCount = 0;
  chapters.forEach((chapter, chapterIndex) => {
    const subchapters = [...chapter.subchapters].sort((a, b) => a.order - b.order);
    const prefix = String(chapterIndex + 1).padStart(2, "0");
    const links = subchapters.map((subchapter, index) => `<li><a href="${prefix}-${String(index + 1).padStart(2, "0")}-${slug(subchapter.title)}_sub.html">${escapeHtml(subchapter.title)}</a></li>`).join("");
    const chapterContent = pageContent(chapter.title, chapter.summary, chapter.blocks, project);
    zip.file(`${prefix}-00-${slug(chapter.title)}.html`, documentHtml(chapter.title, `${chapterContent}${links ? `<nav aria-label="Subchapters"><h2>In this chapter</h2><ul>${links}</ul></nav>` : ""}`, project.theme));
    subchapters.forEach((subchapter, index) => {
      topicCount += 1;
      const content = pageContent(subchapter.title, subchapter.summary, subchapter.blocks, project);
      zip.file(`${prefix}-${String(index + 1).padStart(2, "0")}-${slug(subchapter.title)}_sub.html`, documentHtml(subchapter.title, content, project.theme));
    });
  });

  for (const asset of project.assets) {
    if (!asset.relativePath.startsWith("assets/originals/")) throw new Error(`Unsafe asset path: ${asset.relativePath}`);
    zip.file(assetPackagePath(asset), await readAsset(asset));
  }
  zip.file("workpath-source.json", `${JSON.stringify({ format: "workpath-source", version: 1, project }, null, 2)}\n`);
  report.push(`${chapters.length} chapter(s)`, `${topicCount} subchapter(s)`, `${project.assets.length} media file(s)`, ...issues.map((issue) => `Warning: ${issue}`), "Moodle Book import: ready");
  zip.file("workpath-import-report.txt", report.join("\n"));
  return { bytes: await zip.generateAsync({ type: "uint8array", compression: "DEFLATE", compressionOptions: { level: 6 } }), report };
}

function isMissingImageFallback(block: WorkPathProject["chapters"][number]["blocks"][number], message: string) {
  if (block.type !== "widget") return false;
  if ((block.widgetKey === "image" || block.widgetKey === "image-text") && !block.params.imageAssetId) return message === "Choose an image." || message === "Alternative text is required.";
  if (block.widgetKey === "hotspot-image" && !block.params.imageAssetId) return message === "Choose a hotspot image." || message === "Hotspot image alternative text is required.";
  if (block.widgetKey === "image-gallery" && Array.isArray(block.params.images)) {
    const images = block.params.images as Array<Record<string, unknown>>;
    if (message === "Choose an image for every gallery item.") return true;
    if (message === "Alternative text is required for every gallery image.") return !images.some((image) => image.imageAssetId && !String(image.altText ?? "").trim());
  }
  if (block.widgetKey === "flip-cards" && Array.isArray(block.params.cards)) {
    const cards = block.params.cards as Array<Record<string, unknown>>;
    if (message === "Choose an image for every flip card.") return true;
    if (message === "Alternative text is required for every flip card image.") return !cards.some((card) => (card.imageAssetId || card.frontAssetId) && !String(card.altText ?? "").trim());
  }
  return false;
}

function pageContent(title: string, summary: string, blocks: WorkPathProject["chapters"][number]["blocks"], project: WorkPathProject) {
  return `<h1 style="color:${project.theme.h1.color};font-family:${project.theme.h1.fontFamily};font-size:${project.theme.h1.fontSize}px;font-weight:${project.theme.h1.fontWeight};line-height:${project.theme.h1.lineHeight}">${escapeHtml(title)}</h1>${summary ? `<p style="background:#f5f7fa;border-left:4px solid #6f87a5;padding:12px 16px"><strong>Purpose:</strong> ${escapeHtml(summary)}</p>` : ""}${blocks.map((block) => renderContentBlock(block, project.assets)).join("\n")}`;
}
