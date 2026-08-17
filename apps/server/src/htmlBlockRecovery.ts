import { HTMLElement, NodeType, parse } from "node-html-parser";
import { createWidgetBlock, type ContentBlock, type WidgetBlock } from "@workpath/core";

export type BlockRecovery = { blocks: ContentBlock[]; structuredCount: number; richTextCount: number };

const classWidgets: Array<[string, string]> = [
  ["workpath-note", "note"], ["workpath-accordion", "accordion"], ["workpath-checklist", "checklist"],
  ["workpath-quote", "quote"], ["workpath-image", "image"], ["workpath-image-text", "image-text"],
  ["workpath-table", "table"], ["workpath-card-grid", "card-grid"], ["workpath-columns", "responsive-columns"],
  ["workpath-resource-card", "resource-card"], ["workpath-list-group", "list-group"], ["workpath-code", "code-snippet"],
  ["workpath-flip-cards", "flip-cards"], ["workpath-hotspot", "hotspot-image"], ["workpath-custom-html", "custom-html"],
  ["workpath-gallery", "image-gallery"], ["workpath-video", "video-embed"]
];

export function recoverContentBlocks(html: string): BlockRecovery {
  const root = parse(`<div id="workpath-recovery-root">${html}</div>`, { comment: true }).querySelector("#workpath-recovery-root")!;
  const blocks: ContentBlock[] = []; let pending = ""; let structuredCount = 0; let richTextCount = 0;
  const flush = () => {
    if (!plainText(pending) && !/<(?:img|audio|video|hr|br)\b/i.test(pending)) { pending = ""; return; }
    blocks.push({ id: crypto.randomUUID(), type: "richText", html: pending.trim() }); richTextCount += 1; pending = "";
  };
  for (const node of root.childNodes) {
    if (node.nodeType === NodeType.ELEMENT_NODE) {
      const element = node as HTMLElement;
      if (element.tagName === "STYLE" && /workpath-flip-card/.test(element.textContent)) continue;
      const recovered = recoverElement(element);
      if (recovered) { flush(); blocks.push(recovered); structuredCount += 1; continue; }
    }
    if (node.nodeType !== NodeType.COMMENT_NODE) pending += node.toString();
  }
  flush();
  if (!blocks.length) { blocks.push({ id: crypto.randomUUID(), type: "richText", html: "<p>Imported chapter.</p>" }); richTextCount += 1; }
  return { blocks, structuredCount, richTextCount };
}

function recoverElement(element: HTMLElement): WidgetBlock | null {
  let key = classWidgets.find(([className]) => element.classList.contains(className))?.[1];
  if (!key && element.classList.contains("workpath-knowledge-check")) key = knowledgeKey(element);
  if (!key) return null;
  const block = createWidgetBlock(key);
  block.fallbackHtml = element.outerHTML;
  block.params = recoverParams(key, element);
  return block;
}

function recoverParams(key: string, element: HTMLElement): Record<string, unknown> {
  const q = (selector: string) => element.querySelector(selector);
  const qa = (selector: string) => element.querySelectorAll(selector);
  switch (key) {
    case "note": return { tone: [...element.classList.values()].find((name) => name.startsWith("workpath-note--"))?.slice(15) || "info", title: text(q("h3")), html: innerWithout(element, [q("h3")]) };
    case "accordion": return { sections: qa("details").map((item) => ({ title: text(item.querySelector("summary")), body: item.querySelector("div")?.innerHTML || innerWithout(item, [item.querySelector("summary")]) })) };
    case "checklist": return { title: text(q("h3")), items: qa("li").map((item) => ({ text: item.textContent.trim() })) };
    case "quote": return { text: q("blockquote")?.innerHTML || "", attribution: text(q("figcaption")).replace(/^\s*[—–-]\s*/, "") };
    case "image": return imageParams(element);
    case "image-text": {
      const content = qa("td").find((cell) => cell.getAttribute("width") === "60%") || q("td:nth-child(2)");
      return { ...imageParams(element), position: element.classList.contains("workpath-image-text--right") ? "right" : "left", heading: text(content?.querySelector("h3")), html: content ? innerWithout(content, [content.querySelector("h3")]) : "" };
    }
    case "table": return { caption: text(q("caption")), columns: qa("thead th").map((cell) => ({ heading: cell.textContent.trim() })), rows: qa("tbody tr").map((row) => ({ cells: row.querySelectorAll("td").map((cell) => cell.textContent.trim()) })) };
    case "card-grid": return { cards: directElements(element, "ARTICLE").map((card) => { const content = card.querySelector("div"); const link = content?.querySelector("a"); return { title: text(content?.querySelector("h3")), body: content ? innerWithout(content, [content.querySelector("h3"), link?.parentNode as HTMLElement]) : "", ...assetFields(card), url: link?.getAttribute("href") || "", linkLabel: text(link) }; }) };
    case "responsive-columns": return { columns: directElements(element, "DIV").map((column) => ({ heading: text(column.querySelector("h3")), body: innerWithout(column, [column.querySelector("h3")]) })) };
    case "resource-card": { const heading = q("h3"); const link = q("a"); const type = directElements(element, "P")[0]; return { resourceType: text(type), title: text(heading), description: innerWithout(element, [type, heading, link?.parentNode as HTMLElement]), url: link?.getAttribute("href") || "", buttonLabel: text(link) }; }
    case "list-group": { const title = directElements(element, "H3")[0]; return { title: text(title), items: directElements(element, "DIV").map((item) => { const heading = item.querySelector("strong"); const link = item.querySelector("a"); return { heading: text(heading), body: innerWithout(item, [heading, link]), url: link?.getAttribute("href") || "", linkLabel: text(link) }; }) }; }
    case "code-snippet": { const label = text(q("figcaption")); const parts = label.split(/\s+·\s+/, 2); return { caption: parts[0] || "Code example", language: parts[1] || "", code: q("code")?.textContent || "" }; }
    case "true-false": return { question: text(q("h3")), answer: text(q("details strong")), feedback: detailsFeedback(q("details"), true) };
    case "single-choice": return { question: text(q("h3")), options: qa('input[type="radio"]').map((input) => ({ text: input.getAttribute("value") || input.parentNode.textContent.trim() })), correctAnswer: answerAfterStrong(q("details")), feedback: detailsFeedback(q("details"), true) };
    case "multiple-choice": return { question: text(q("h3")), options: qa('input[type="checkbox"]').map((input) => ({ text: input.getAttribute("value") || input.parentNode.textContent.trim() })), correctAnswers: answerAfterStrong(q("details")), feedback: detailsFeedback(q("details"), true) };
    case "flip-cards": return { cards: qa("details.workpath-flip-card").map((card) => { const back = card.querySelector(".workpath-flip-card-back"); return { ...assetFields(card.querySelector(".workpath-flip-card-front") || card), backTitle: text(back?.querySelector("h3")), backBody: back ? innerWithout(back, [back.querySelector("h3")]) : "" }; }) };
    case "hotspot-image": { const holder = directElements(element, "DIV")[0]; const hotspots = holder?.querySelectorAll(":scope > details") || []; return { ...assetFields(holder || element), hotspots: hotspots.map((spot, index) => { const detail = spot.querySelector("div"); const style = spot.getAttribute("style") || ""; return { number: index + 1, title: text(detail?.querySelector("strong")), body: detail ? innerWithout(detail, [detail.querySelector("strong")]) : "", x: percent(style, "left"), y: percent(style, "top") }; }) }; }
    case "custom-html": return { html: element.innerHTML };
    case "image-gallery": return { title: text(q("h3")) || element.getAttribute("aria-label") || "Image gallery", images: qa("figure").map((figure) => ({ ...assetFields(figure), caption: text(figure.querySelector("figcaption")) })) };
    case "video-embed": { const iframe = q("iframe"); const link = q("a"); const details = q("details"); return { title: text(q("h3")), url: videoSource(iframe?.getAttribute("src") || link?.getAttribute("href") || ""), description: innerWithout(element, [q("h3"), iframe?.parentNode as HTMLElement, link?.parentNode as HTMLElement, details]), transcript: details ? innerWithout(details, [details.querySelector("summary")]) : "" }; }
    default: return {};
  }
}

function imageParams(element: HTMLElement) { const image = element.querySelector("img"); const placeholder = element.querySelector('[role="img"]'); return { imageAssetId: assetId(image?.getAttribute("src") || ""), altText: image?.getAttribute("alt") || placeholder?.getAttribute("aria-label") || "", caption: text(element.querySelector("figcaption")), showBorder: /border\s*:\s*1px/i.test(image?.getAttribute("style") || "") }; }
function assetFields(element: HTMLElement) { const image = element.querySelector("img"); const placeholder = element.querySelector('[role="img"]'); return { imageAssetId: assetId(image?.getAttribute("src") || ""), altText: image?.getAttribute("alt") || placeholder?.getAttribute("aria-label") || "" }; }
function assetId(url: string) { return url.match(/\/assets\/([a-f0-9-]{36})(?:[?#]|$)/i)?.[1] || url.match(/^assets\/([a-f0-9-]{36})-/i)?.[1] || ""; }
function directElements(element: HTMLElement, tag: string) { return element.childNodes.filter((node): node is HTMLElement => node.nodeType === NodeType.ELEMENT_NODE && (node as HTMLElement).tagName === tag); }
function text(element: HTMLElement | null | undefined) { return element?.textContent.trim() || ""; }
function plainText(html: string) { return parse(html).textContent.trim(); }
function innerWithout(element: HTMLElement, excluded: Array<HTMLElement | null | undefined>) { let html = element.innerHTML; for (const item of excluded) if (item) html = html.replace(item.outerHTML, ""); return html.trim(); }
function knowledgeKey(element: HTMLElement) { const legend = text(element.querySelector("legend")).toLowerCase(); if (legend.includes("all") || element.querySelector('input[type="checkbox"]')) return "multiple-choice"; const values = element.querySelectorAll('input[type="radio"]').map((input) => input.getAttribute("value")); return legend === "choose an answer" && values.length === 2 && values.includes("True") && values.includes("False") ? "true-false" : "single-choice"; }
function answerAfterStrong(details: HTMLElement | null) { const paragraph = details?.querySelector("p"); if (!paragraph) return ""; return paragraph.textContent.replace(paragraph.querySelector("strong")?.textContent || "", "").trim(); }
function detailsFeedback(details: HTMLElement | null, removeAnswer: boolean) { return details ? innerWithout(details, [details.querySelector("summary"), removeAnswer ? details.querySelector("p") : null]) : ""; }
function percent(style: string, property: string) { return Number(style.match(new RegExp(`${property}\\s*:\\s*([\\d.]+)%`, "i"))?.[1] || 50); }
function videoSource(url: string) { const youtube = url.match(/youtube(?:-nocookie)?\.com\/embed\/([^/?]+)/i)?.[1]; if (youtube) return `https://www.youtube.com/watch?v=${youtube}`; const vimeo = url.match(/player\.vimeo\.com\/video\/(\d+)/i)?.[1]; return vimeo ? `https://vimeo.com/${vimeo}` : url; }
