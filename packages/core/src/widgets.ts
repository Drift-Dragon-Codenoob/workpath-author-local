import Mustache from "mustache";
import type { AssetRecord, ContentBlock, WidgetBlock } from "./schema.js";

export type WidgetParameterType = "textfield" | "textarea" | "richtext" | "select" | "checkbox" | "numeric" | "image" | "repeatable";
export type WidgetParameterOption = string | { label: string; value: string };
export type WidgetParameter = { name: string; title: string; type: WidgetParameterType; default?: unknown; options?: WidgetParameterOption[]; min?: number; max?: number; initial?: number; itemLabel?: string; fields?: WidgetParameter[] };
export type WidgetDefinition = { key: string; name: string; category: string; description: string; version: string; template: string; parameters: WidgetParameter[] };
export type ValidationIssue = { blockId: string; message: string };

export const WIDGET_DEFINITIONS: WidgetDefinition[] = [
  { key: "note", name: "Note / callout", category: "Content", description: "Highlight a note, tip, warning, or important reminder.", version: "1.1.0", template: `<aside class="workpath-note workpath-note--{{tone}}" style="background:{{noteBackground}};border-left:5px solid {{noteBorder}};border-radius:4px;margin:20px 0;padding:18px 22px"><h3 style="margin-top:0">{{title}}</h3>{{{html}}}</aside>`, parameters: [
    { name: "tone", title: "Tone", type: "select", default: "info", options: ["info", "tip", "warning", "important"] },
    { name: "title", title: "Title", type: "textfield", default: "Note" },
    { name: "html", title: "Body", type: "richtext", default: "<p>Add a short note or reminder.</p>" }
  ] },
  { key: "accordion", name: "Accordion", category: "Interactive", description: "Expandable sections for supporting detail.", version: "1.1.0", template: `<section class="workpath-accordion" style="margin:20px 0">{{#sections}}<details style="border:1px solid #d3dce8;border-radius:5px;margin:8px 0;padding:12px"><summary style="cursor:pointer;font-weight:700">{{title}}</summary><div style="padding-top:10px">{{{body}}}</div></details>{{/sections}}</section>`, parameters: [
    { name: "sections", title: "Sections", type: "repeatable", min: 1, max: 10, initial: 2, itemLabel: "Section", fields: [
      { name: "title", title: "Title", type: "textfield", default: "Section {{i}}" }, { name: "body", title: "Body", type: "richtext", default: "<p>Add section content.</p>" }
    ] }
  ] },
  { key: "checklist", name: "Checklist", category: "Interactive", description: "A clear list of actions or checkpoints.", version: "1.1.0", template: `<section class="workpath-checklist" style="margin:20px 0"><h3>{{title}}</h3><ul style="padding-left:24px">{{#items}}<li style="margin:7px 0">{{text}}</li>{{/items}}</ul></section>`, parameters: [
    { name: "title", title: "Title", type: "textfield", default: "Checklist" },
    { name: "items", title: "Items", type: "repeatable", min: 1, max: 20, initial: 3, itemLabel: "Item", fields: [{ name: "text", title: "Text", type: "textfield", default: "Checklist item {{i}}" }] }
  ] },
  { key: "quote", name: "Quote", category: "Content", description: "A quotation with optional attribution.", version: "1.1.0", template: `<figure class="workpath-quote" style="border-left:4px solid #6f7f95;margin:20px 0;padding:5px 20px"><blockquote style="font-size:1.2rem;margin:0">{{{text}}}</blockquote>{{#attribution}}<figcaption style="color:#647187;margin-top:8px">— {{attribution}}</figcaption>{{/attribution}}</figure>`, parameters: [
    { name: "text", title: "Quote", type: "richtext", default: "<p>Add the quotation.</p>" }, { name: "attribution", title: "Attribution", type: "textfield", default: "" }
  ] },
  { key: "image", name: "Image", category: "Media", description: "An image with required alternative text and an optional caption.", version: "1.3.0", template: `<figure class="workpath-image" style="margin:20px 0;text-align:center">{{#imageUrl}}<img src="{{{imageUrl}}}" alt="{{altText}}" loading="lazy" style="border-radius:6px;box-sizing:border-box;display:block;height:auto;margin-left:auto;margin-right:auto;max-width:100%;{{{imageBorderStyle}}}">{{/imageUrl}}{{^imageUrl}}{{#altText}}<div role="img" aria-label="{{altText}}" style="background:#ffffff;border:2px dashed #bdc8d6;color:#52647b;padding:40px;text-align:center">{{altText}}</div>{{/altText}}{{^altText}}<div role="img" aria-label="Placeholder image" class="workpath-missing-media" style="background:#ffffff;border:2px dashed #bdc8d6;color:#65728a;padding:40px;text-align:center">Placeholder image</div>{{/altText}}{{/imageUrl}}{{#caption}}<figcaption style="color:#65728a;font-size:.88rem;margin-top:7px">{{caption}}</figcaption>{{/caption}}</figure>`, parameters: [
    { name: "imageAssetId", title: "Image", type: "image", default: "" }, { name: "altText", title: "Alternative text", type: "textfield", default: "" }, { name: "caption", title: "Caption", type: "textfield", default: "" }, { name: "showBorder", title: "Show border", type: "checkbox", default: false }
  ] },
  { key: "image-text", name: "Image + text", category: "Media", description: "An image beside a heading and supporting rich text.", version: "1.4.0", template: `<section class="workpath-image-text workpath-image-text--{{position}}" style="margin:20px 0"><table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border:0;border-collapse:separate;width:100%"><tbody><tr>{{#imageLeft}}<td width="40%" valign="top" style="border:0;padding:0 24px 0 0;vertical-align:top">{{#imageUrl}}<img src="{{{imageUrl}}}" alt="{{altText}}" loading="lazy" width="100%" style="border-radius:6px;box-sizing:border-box;display:block;height:auto;margin-left:auto;margin-right:auto;max-width:100%;{{{imageBorderStyle}}}">{{/imageUrl}}{{^imageUrl}}{{#altText}}<div role="img" aria-label="{{altText}}" style="background:#ffffff;border:2px dashed #bdc8d6;color:#52647b;padding:40px;text-align:center">{{altText}}</div>{{/altText}}{{^altText}}<div role="img" aria-label="Placeholder image" style="background:#ffffff;border:2px dashed #bdc8d6;color:#65728a;padding:40px;text-align:center">Placeholder image</div>{{/altText}}{{/imageUrl}}</td>{{/imageLeft}}<td width="60%" valign="top" style="border:0;padding:0;vertical-align:top"><h3 style="margin-top:0">{{heading}}</h3>{{{html}}}</td>{{#imageRight}}<td width="40%" valign="top" style="border:0;padding:0 0 0 24px;vertical-align:top">{{#imageUrl}}<img src="{{{imageUrl}}}" alt="{{altText}}" loading="lazy" width="100%" style="border-radius:6px;box-sizing:border-box;display:block;height:auto;margin-left:auto;margin-right:auto;max-width:100%;{{{imageBorderStyle}}}">{{/imageUrl}}{{^imageUrl}}{{#altText}}<div role="img" aria-label="{{altText}}" style="background:#ffffff;border:2px dashed #bdc8d6;color:#52647b;padding:40px;text-align:center">{{altText}}</div>{{/altText}}{{^altText}}<div role="img" aria-label="Placeholder image" style="background:#ffffff;border:2px dashed #bdc8d6;color:#65728a;padding:40px;text-align:center">Placeholder image</div>{{/altText}}{{/imageUrl}}</td>{{/imageRight}}</tr></tbody></table></section>`, parameters: [
    { name: "imageAssetId", title: "Image", type: "image", default: "" }, { name: "position", title: "Image position", type: "select", default: "left", options: ["left", "right"] }, { name: "altText", title: "Alternative text", type: "textfield", default: "" }, { name: "showBorder", title: "Show border", type: "checkbox", default: false }, { name: "heading", title: "Heading", type: "textfield", default: "Image with text" }, { name: "html", title: "Body", type: "richtext", default: "<p>Add supporting content.</p>" }
  ] },
  { key: "table", name: "Table", category: "Data", description: "An accessible table with directly editable rows and columns.", version: "1.2.0", template: `<figure class="workpath-table" style="margin:20px 0;overflow-x:auto"><table style="border-collapse:collapse;width:100%"><caption style="font-weight:700;padding:8px;text-align:left">{{caption}}</caption><thead><tr>{{#columns}}<th scope="col" style="background:#eaf0f7;border:1px solid #aebbc9;padding:9px 11px;text-align:left;vertical-align:top">{{heading}}</th>{{/columns}}</tr></thead><tbody>{{#rows}}<tr>{{#cells}}<td style="border:1px solid #aebbc9;padding:9px 11px;text-align:left;vertical-align:top">{{.}}</td>{{/cells}}</tr>{{/rows}}</tbody></table></figure>`, parameters: [
    { name: "caption", title: "Table caption", type: "textfield", default: "Table summary" },
    { name: "columns", title: "Columns", type: "repeatable", min: 1, max: 10, default: [{ heading: "Column 1" }, { heading: "Column 2" }, { heading: "Column 3" }], fields: [{ name: "heading", title: "Heading", type: "textfield", default: "Column {{i}}" }] },
    { name: "rows", title: "Rows", type: "repeatable", min: 1, max: 50, default: [{ cells: ["", "", ""] }, { cells: ["", "", ""] }, { cells: ["", "", ""] }] }
  ] },
  { key: "card-grid", name: "Card grid", category: "Layout", description: "Responsive cards with optional images and links.", version: "1.0.0", template: `<section class="workpath-card-grid" style="display:flex;flex-wrap:wrap;gap:16px;margin:20px 0">{{#cards}}<article style="border:1px solid #ccd6e2;border-radius:6px;box-sizing:border-box;flex:1 1 210px;overflow:hidden">{{#imageUrl}}<img src="{{{imageUrl}}}" alt="{{altText}}" style="display:block;height:auto;max-width:100%;width:100%">{{/imageUrl}}<div style="padding:16px"><h3 style="margin-top:0">{{title}}</h3>{{{body}}}{{#url}}<p><a href="{{url}}">{{linkLabel}}</a></p>{{/url}}</div></article>{{/cards}}</section>`, parameters: [
    { name: "cards", title: "Cards", type: "repeatable", min: 1, max: 8, initial: 3, itemLabel: "Card", fields: [{ name: "title", title: "Title", type: "textfield", default: "Card {{i}}" }, { name: "body", title: "Body", type: "richtext", default: "<p>Add card content.</p>" }, { name: "imageAssetId", title: "Image", type: "image", default: "" }, { name: "altText", title: "Alternative text", type: "textfield", default: "" }, { name: "url", title: "Link URL", type: "textfield", default: "" }, { name: "linkLabel", title: "Link label", type: "textfield", default: "Learn more" }] }
  ] },
  { key: "responsive-columns", name: "Responsive columns", category: "Layout", description: "Two to four columns of parallel content.", version: "1.0.0", template: `<section class="workpath-columns" style="display:flex;flex-wrap:wrap;gap:24px;margin:20px 0">{{#columns}}<div style="flex:1 1 200px;min-width:0"><h3 style="margin-top:0">{{heading}}</h3>{{{body}}}</div>{{/columns}}</section>`, parameters: [
    { name: "columns", title: "Columns", type: "repeatable", min: 2, max: 4, initial: 2, itemLabel: "Column", fields: [{ name: "heading", title: "Heading", type: "textfield", default: "Column {{i}}" }, { name: "body", title: "Body", type: "richtext", default: "<p>Add column content.</p>" }] }
  ] },
  { key: "resource-card", name: "Resource link card", category: "Resources", description: "A prominent link to a document, activity, package, or website.", version: "1.0.0", template: `<aside class="workpath-resource-card" style="border:1px solid #b9c7d8;border-left:5px solid #245fa6;border-radius:6px;margin:20px 0;padding:18px 22px"><p style="color:#52647b;font-size:.8rem;font-weight:700;margin:0 0 6px;text-transform:uppercase">{{resourceType}}</p><h3 style="margin:0 0 8px">{{title}}</h3>{{{description}}}{{#url}}<p><a href="{{url}}" style="background:#245fa6;border-radius:4px;color:#fff;display:inline-block;padding:9px 14px;text-decoration:none">{{buttonLabel}}</a></p>{{/url}}</aside>`, parameters: [
    { name: "resourceType", title: "Resource type", type: "select", default: "Resource", options: ["Resource", "Document", "Website", "Moodle activity", "SCORM package"] }, { name: "title", title: "Title", type: "textfield", default: "Learning resource" }, { name: "description", title: "Description", type: "richtext", default: "<p>Explain what this resource is for.</p>" }, { name: "url", title: "URL", type: "textfield", default: "https://" }, { name: "buttonLabel", title: "Button label", type: "textfield", default: "Open resource" }
  ] },
  { key: "list-group", name: "Styled list group", category: "Content", description: "A grouped list with headings, descriptions, and optional links.", version: "1.0.0", template: `<section class="workpath-list-group" style="border:1px solid #ccd6e2;border-radius:6px;margin:20px 0;overflow:hidden">{{#title}}<h3 style="background:#edf2f7;margin:0;padding:14px 18px">{{title}}</h3>{{/title}}{{#items}}<div style="border-top:1px solid #dce3eb;padding:14px 18px"><strong>{{heading}}</strong>{{{body}}}{{#url}}<a href="{{url}}">{{linkLabel}}</a>{{/url}}</div>{{/items}}</section>`, parameters: [
    { name: "title", title: "List title", type: "textfield", default: "Key items" }, { name: "items", title: "Items", type: "repeatable", min: 1, max: 20, initial: 3, itemLabel: "Item", fields: [{ name: "heading", title: "Heading", type: "textfield", default: "Item {{i}}" }, { name: "body", title: "Description", type: "richtext", default: "<p>Add a short description.</p>" }, { name: "url", title: "Optional URL", type: "textfield", default: "" }, { name: "linkLabel", title: "Link label", type: "textfield", default: "Open" }] }
  ] },
  { key: "code-snippet", name: "Code snippet", category: "Resources", description: "Preformatted code or commands with a language label.", version: "1.0.0", template: `<figure class="workpath-code" style="background:#17213d;border-radius:6px;color:#f4f7fb;margin:20px 0;overflow:auto;padding:18px"><figcaption style="color:#b9c8dc;margin-bottom:10px">{{caption}}{{#language}} · {{language}}{{/language}}</figcaption><pre style="margin:0;white-space:pre-wrap"><code>{{code}}</code></pre></figure>`, parameters: [
    { name: "caption", title: "Caption", type: "textfield", default: "Code example" }, { name: "language", title: "Language", type: "textfield", default: "text" }, { name: "code", title: "Code", type: "textarea", default: "Enter code here" }
  ] },
  { key: "true-false", name: "True or false", category: "Knowledge check", description: "A statement with an answer and explanatory feedback.", version: "1.1.0", template: `<section class="workpath-knowledge-check" style="border:1px solid #b9c8da;border-radius:6px;margin:20px 0;padding:20px"><h3 style="margin-top:0">{{question}}</h3><fieldset style="border:0;margin:0;padding:0"><legend style="font-size:.9rem;font-weight:700;margin-bottom:8px">Choose an answer</legend><label style="display:block;margin:8px 0"><input type="radio" name="{{quizName}}" value="True"> True</label><label style="display:block;margin:8px 0"><input type="radio" name="{{quizName}}" value="False"> False</label></fieldset><details style="margin-top:14px"><summary style="cursor:pointer;font-weight:700">Check answer</summary><p><strong>{{answer}}</strong></p>{{{feedback}}}</details></section>`, parameters: [
    { name: "question", title: "Statement", type: "textfield", default: "Enter a statement." }, { name: "answer", title: "Correct answer", type: "select", default: "True", options: ["True", "False"] }, { name: "feedback", title: "Feedback", type: "richtext", default: "<p>Explain the answer.</p>" }
  ] },
  { key: "single-choice", name: "Single-answer knowledge check", category: "Knowledge check", description: "A multiple-choice question with one correct answer.", version: "1.1.0", template: `<section class="workpath-knowledge-check" style="border:1px solid #b9c8da;border-radius:6px;margin:20px 0;padding:20px"><h3 style="margin-top:0">{{question}}</h3><fieldset style="border:0;margin:0;padding:0"><legend style="font-size:.9rem;font-weight:700;margin-bottom:8px">Choose one answer</legend>{{#options}}<label style="display:block;margin:8px 0"><input type="radio" name="{{quizName}}" value="{{text}}"> {{text}}</label>{{/options}}</fieldset><details style="margin-top:14px"><summary style="cursor:pointer;font-weight:700">Check answer</summary><p><strong>Correct answer:</strong> {{correctAnswer}}</p>{{{feedback}}}</details></section>`, parameters: [
    { name: "question", title: "Question", type: "textfield", default: "Ask a question." }, { name: "options", title: "Options", type: "repeatable", min: 2, max: 8, initial: 3, itemLabel: "Option", fields: [{ name: "text", title: "Answer text", type: "textfield", default: "Option {{i}}" }] }, { name: "correctAnswer", title: "Correct answer", type: "textfield", default: "Option 1" }, { name: "feedback", title: "Feedback", type: "richtext", default: "<p>Explain the correct answer.</p>" }
  ] },
  { key: "multiple-choice", name: "Multiple-answer knowledge check", category: "Knowledge check", description: "A question where more than one response may be correct.", version: "1.1.0", template: `<section class="workpath-knowledge-check" style="border:1px solid #b9c8da;border-radius:6px;margin:20px 0;padding:20px"><h3 style="margin-top:0">{{question}}</h3><fieldset style="border:0;margin:0;padding:0"><legend style="font-size:.9rem;font-weight:700;margin-bottom:8px">Choose all that apply</legend>{{#options}}<label style="display:block;margin:8px 0"><input type="checkbox" name="{{quizName}}" value="{{text}}"> {{text}}</label>{{/options}}</fieldset><details style="margin-top:14px"><summary style="cursor:pointer;font-weight:700">Check answers</summary><p><strong>Correct answers:</strong> {{correctAnswers}}</p>{{{feedback}}}</details></section>`, parameters: [
    { name: "question", title: "Question", type: "textfield", default: "Select all correct answers." }, { name: "options", title: "Options", type: "repeatable", min: 2, max: 10, initial: 4, itemLabel: "Option", fields: [{ name: "text", title: "Answer text", type: "textfield", default: "Option {{i}}" }] }, { name: "correctAnswers", title: "Correct answers", type: "textfield", default: "Option 1; Option 2" }, { name: "feedback", title: "Feedback", type: "richtext", default: "<p>Explain the correct combination.</p>" }
  ] },
  { key: "flip-cards", name: "Flip cards", category: "Interactive", description: "Image-front cards that animate to reveal text on the back.", version: "2.0.0", template: `<style>
.workpath-flip-card{flex:1 1 240px;max-width:360px;min-width:220px;perspective:1000px}
.workpath-flip-card>summary{cursor:pointer;display:block;list-style:none;outline-offset:4px}
.workpath-flip-card>summary::-webkit-details-marker{display:none}
.workpath-flip-card-inner{display:grid;min-height:300px;transform-style:preserve-3d;transition:transform .55s cubic-bezier(.2,.7,.2,1)}
.workpath-flip-card[open] .workpath-flip-card-inner{transform:rotateY(180deg)}
.workpath-flip-card-face{backface-visibility:hidden;border:1px solid #c6d1df;border-radius:6px;box-sizing:border-box;grid-area:1/1;overflow:hidden}
.workpath-flip-card-front{background:#eef2f7}
.workpath-flip-card-front img{height:100%;object-fit:cover;width:100%}
.workpath-flip-card-back{background:#fff;overflow:auto;padding:24px;transform:rotateY(180deg)}
.workpath-flip-card-back h3{margin-top:0}
@media (prefers-reduced-motion:reduce){.workpath-flip-card-inner{transition:none}}
</style><section class="workpath-flip-cards" style="display:flex;flex-wrap:wrap;gap:16px;justify-content:flex-start;margin:20px 0">{{#cards}}<details class="workpath-flip-card"><summary aria-label="Flip card: reveal {{backTitle}}"><div class="workpath-flip-card-inner"><div class="workpath-flip-card-face workpath-flip-card-front">{{#imageUrl}}<img src="{{{imageUrl}}}" alt="{{altText}}" loading="lazy">{{/imageUrl}}{{^imageUrl}}{{#altText}}<span role="img" aria-label="{{altText}}" style="align-items:center;background:#fff;color:#52647b;display:flex;height:100%;justify-content:center;padding:24px;text-align:center">{{altText}}</span>{{/altText}}{{^altText}}<span role="img" aria-label="Placeholder image" style="align-items:center;background:#fff;color:#65728a;display:flex;height:100%;justify-content:center;padding:24px;text-align:center">Placeholder image</span>{{/altText}}{{/imageUrl}}</div><div class="workpath-flip-card-face workpath-flip-card-back"><h3>{{backTitle}}</h3>{{{backBody}}}</div></div></summary></details>{{/cards}}</section>`, parameters: [
    { name: "cards", title: "Cards", type: "repeatable", min: 1, max: 12, initial: 3, itemLabel: "Card", fields: [{ name: "imageAssetId", title: "Front image", type: "image", default: "" }, { name: "altText", title: "Image alternative text", type: "textfield", default: "" }, { name: "backTitle", title: "Back heading", type: "textfield", default: "Card {{i}}" }, { name: "backBody", title: "Back text", type: "richtext", default: "<p>Add the text revealed when the card flips.</p>" }] }
  ] },
  { key: "hotspot-image", name: "Hotspot image", category: "Interactive", description: "An annotated image with positioned numbered callouts.", version: "1.2.1", template: `<figure class="workpath-hotspot" style="margin:20px 0"><div style="position:relative">{{#imageUrl}}<img src="{{{imageUrl}}}" alt="{{altText}}" style="display:block;height:auto;max-width:100%;width:100%">{{#hotspots}}<details style="left:{{x}}%;position:absolute;top:{{y}}%;transform:translate(-50%,-50%);z-index:2"><summary aria-label="Hotspot {{number}}: {{title}}" style="background:#245fa6;border:2px solid #fff;border-radius:50%;box-shadow:0 3px 9px rgba(20,43,73,.35);color:#fff;cursor:pointer;font-weight:700;list-style:none;padding:5px 9px"><span aria-hidden="true">{{number}}</span></summary><div style="background:#fff;border:1px solid #b9c8da;border-radius:6px;box-shadow:0 8px 22px rgba(20,43,73,.25);color:#17213d;left:50%;padding:14px;position:absolute;top:calc(100% + 8px);transform:translateX(-50%);width:min(280px,75vw)"><strong>{{title}}</strong>{{{body}}}</div></details>{{/hotspots}}{{/imageUrl}}{{^imageUrl}}{{#altText}}<div role="img" aria-label="{{altText}}" style="background:#ffffff;border:2px dashed #bdc8d6;color:#52647b;padding:40px;text-align:center">{{altText}}</div>{{/altText}}{{^altText}}<div role="img" aria-label="Placeholder image" style="background:#ffffff;border:2px dashed #bdc8d6;color:#65728a;padding:40px;text-align:center">Placeholder image</div>{{/altText}}{{/imageUrl}}</div><figcaption style="border:1px solid #c8d5e5;border-radius:0 0 6px 6px;border-top:0;max-width:100%"><details><summary style="color:#245fa6;cursor:pointer;font-size:.9rem;font-weight:700;padding:10px 14px">Image details</summary><ol style="margin:0;padding:0 28px 14px">{{#hotspots}}<li><strong>{{title}}</strong>{{{body}}}</li>{{/hotspots}}</ol></details></figcaption></figure>`, parameters: [
    { name: "imageAssetId", title: "Image", type: "image", default: "" }, { name: "altText", title: "Alternative text", type: "textfield", default: "" }, { name: "hotspots", title: "Hotspots", type: "repeatable", min: 1, max: 12, initial: 2, itemLabel: "Hotspot", fields: [{ name: "number", title: "Marker number", type: "numeric", default: 1 }, { name: "title", title: "Title", type: "textfield", default: "Hotspot {{i}}" }, { name: "body", title: "Detail", type: "richtext", default: "<p>Add hotspot detail.</p>" }, { name: "x", title: "Horizontal position (%)", type: "numeric", default: 50 }, { name: "y", title: "Vertical position (%)", type: "numeric", default: 50 }] }
  ] },
  { key: "custom-html", name: "Custom HTML", category: "Advanced", description: "Advanced Moodle-safe HTML with unsafe markup removed.", version: "1.0.0", template: `<section class="workpath-custom-html" style="margin:20px 0">{{{safeHtml}}}</section>`, parameters: [
    { name: "html", title: "HTML", type: "textarea", default: "<p>Add Moodle-safe HTML.</p>" }
  ] },
  { key: "image-gallery", name: "Image gallery / carousel", category: "Media", description: "A horizontally scrollable image gallery with captions.", version: "1.1.0", template: `<section class="workpath-gallery" aria-label="{{title}}" style="margin:20px 0"><h3>{{title}}</h3><div style="display:flex;gap:16px;overflow-x:auto;padding-bottom:12px;scroll-snap-type:x mandatory">{{#images}}<figure style="flex:0 0 78%;margin:0;scroll-snap-align:start">{{#imageUrl}}<img src="{{{imageUrl}}}" alt="{{altText}}" style="display:block;height:auto;max-width:100%;width:100%">{{/imageUrl}}{{^imageUrl}}{{#altText}}<div role="img" aria-label="{{altText}}" style="background:#ffffff;border:2px dashed #bdc8d6;color:#52647b;padding:40px;text-align:center">{{altText}}</div>{{/altText}}{{^altText}}<div role="img" aria-label="Placeholder image" style="background:#ffffff;border:2px dashed #bdc8d6;color:#65728a;padding:40px;text-align:center">Placeholder image</div>{{/altText}}{{/imageUrl}}<figcaption style="color:#5d6d82;padding-top:7px">{{caption}}</figcaption></figure>{{/images}}</div></section>`, parameters: [
    { name: "title", title: "Gallery title", type: "textfield", default: "Image gallery" }, { name: "images", title: "Images", type: "repeatable", min: 1, max: 12, initial: 3, itemLabel: "Image", fields: [{ name: "imageAssetId", title: "Image", type: "image", default: "" }, { name: "altText", title: "Alternative text", type: "textfield", default: "" }, { name: "caption", title: "Caption", type: "textfield", default: "" }] }
  ] },
  { key: "video-embed", name: "Video embed", category: "Media", description: "Responsive video from an approved provider, with transcript support.", version: "1.0.0", template: `<section class="workpath-video" style="margin:20px 0"><h3>{{title}}</h3>{{#videoEmbedUrl}}<div style="height:0;overflow:hidden;padding-bottom:56.25%;position:relative"><iframe src="{{{videoEmbedUrl}}}" title="{{title}}" allowfullscreen style="border:0;height:100%;left:0;position:absolute;top:0;width:100%"></iframe></div>{{/videoEmbedUrl}}{{^videoEmbedUrl}}{{#url}}<p><a href="{{url}}">Open video</a></p>{{/url}}{{/videoEmbedUrl}}{{{description}}}{{#transcript}}<details><summary>Video transcript</summary>{{{transcript}}}</details>{{/transcript}}</section>`, parameters: [
    { name: "title", title: "Video title", type: "textfield", default: "Video" }, { name: "url", title: "YouTube, Vimeo, or Microsoft Stream URL", type: "textfield", default: "" }, { name: "description", title: "Description", type: "richtext", default: "<p>Introduce the video.</p>" }, { name: "transcript", title: "Transcript", type: "richtext", default: "" }
  ] }
];

const definitions = new Map(WIDGET_DEFINITIONS.map((definition) => [definition.key, definition]));
export const findWidgetDefinition = (key: string) => definitions.get(key) ?? null;

function initialValue(parameter: WidgetParameter, index = 1): unknown {
  if (parameter.type === "repeatable") {
    if (Array.isArray(parameter.default)) return structuredClone(parameter.default);
    return Array.from({ length: parameter.initial ?? parameter.min ?? 1 }, (_, itemIndex) => Object.fromEntries((parameter.fields ?? []).map((field) => [field.name, initialValue(field, itemIndex + 1)])));
  }
  return typeof parameter.default === "string" ? parameter.default.replaceAll("{{i}}", String(index)) : parameter.default ?? (parameter.type === "checkbox" ? false : "");
}

export function defaultWidgetParams(definition: WidgetDefinition): Record<string, unknown> {
  return Object.fromEntries(definition.parameters.map((parameter) => [parameter.name, initialValue(parameter)]));
}

export function createWidgetBlock(widgetKey: string): WidgetBlock {
  const definition = findWidgetDefinition(widgetKey);
  if (!definition) throw new Error(`Unknown widget: ${widgetKey}`);
  return { id: crypto.randomUUID(), type: "widget", widgetKey, definitionVersion: definition.version, params: defaultWidgetParams(definition) };
}

export function assetPackagePath(asset: AssetRecord) {
  const safeName = asset.filename.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-|-$/g, "") || "file";
  return `assets/${asset.id}-${safeName}`;
}

function assetContext(value: unknown, assets: AssetRecord[], assetUrl: (asset: AssetRecord) => string): unknown {
  if (Array.isArray(value)) return value.map((entry) => assetContext(entry, assets, assetUrl));
  if (!value || typeof value !== "object") return value;
  const next: Record<string, unknown> = {};
  for (const [key, field] of Object.entries(value as Record<string, unknown>)) {
    next[key] = assetContext(field, assets, assetUrl);
    if (key.toLowerCase().endsWith("assetid") && typeof field === "string") {
      const asset = assets.find((item) => item.id === field);
      next[key.replace(/assetId$/i, "Url")] = asset ? assetUrl(asset) : "";
    }
  }
  return next;
}

function safeCustomHtml(value: string) {
  return value
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<iframe\b[^>]*>[\s\S]*?<\/iframe>/gi, "")
    .replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    .replace(/(href|src)\s*=\s*(["'])\s*javascript:[\s\S]*?\2/gi, '$1="#"');
}

function approvedVideoUrl(value: string) {
  try {
    const url = new URL(value);
    if (url.hostname === "youtu.be") return `https://www.youtube-nocookie.com/embed/${url.pathname.slice(1)}`;
    if (url.hostname.endsWith("youtube.com")) { const id = url.searchParams.get("v") || url.pathname.match(/\/(?:embed|shorts)\/([^/?]+)/)?.[1]; return id ? `https://www.youtube-nocookie.com/embed/${id}` : ""; }
    if (url.hostname === "vimeo.com" || url.hostname.endsWith(".vimeo.com")) { const id = url.pathname.split("/").filter(Boolean).pop(); return id && /^\d+$/.test(id) ? `https://player.vimeo.com/video/${id}` : ""; }
    if (url.protocol === "https:" && (url.hostname.endsWith("microsoftstream.com") || url.hostname.endsWith("sharepoint.com"))) return url.toString();
  } catch { /* Invalid URLs use the linked fallback. */ }
  return "";
}

export function renderWidgetBlock(block: WidgetBlock, assets: AssetRecord[] = [], assetUrl: (asset: AssetRecord) => string = assetPackagePath): string {
  const definition = findWidgetDefinition(block.widgetKey);
  if (!definition) return block.fallbackHtml || `<aside class="workpath-missing-widget">Missing widget: ${block.widgetKey}</aside>`;
  const context = assetContext(block.params, assets, assetUrl) as Record<string, unknown>;
  const tone = String(context.tone ?? "info");
  const noteColours: Record<string, [string, string]> = { info: ["#eef6ff", "#4b79ad"], tip: ["#ecf8ef", "#3b8b50"], warning: ["#fff7df", "#d49a1d"], important: ["#fff0f0", "#bd3f3f"] };
  [context.noteBackground, context.noteBorder] = noteColours[tone] ?? noteColours.info!;
  const imageRight = context.position === "right";
  context.imageLeft = !imageRight;
  context.imageRight = imageRight;
  context.imageBorderStyle = context.showBorder ? "background:#ffffff;border:1px solid #aebbc9;padding:4px;" : "border:0;padding:0;";
  context.imageOrder = imageRight ? 2 : 1;
  context.textOrder = imageRight ? 1 : 2;
  if (["true-false", "single-choice", "multiple-choice"].includes(block.widgetKey)) context.quizName = `workpath-check-${block.id.replace(/[^a-zA-Z0-9_-]/g, "-")}`;
  if (block.widgetKey === "flip-cards" && Array.isArray(context.cards)) context.cards = context.cards.map((item) => { const card = item as Record<string, unknown>; return { ...card, imageUrl: card.imageUrl || card.frontUrl || "", backTitle: card.backTitle || "Flip card", backBody: card.backBody || "<p>Add the revealed text.</p>" }; });
  if (block.widgetKey === "custom-html") context.safeHtml = safeCustomHtml(String(context.html ?? ""));
  if (block.widgetKey === "video-embed") context.videoEmbedUrl = approvedVideoUrl(String(context.url ?? ""));
  if (block.widgetKey === "hotspot-image" && Array.isArray(context.hotspots)) context.hotspots = context.hotspots.map((item, index) => ({ ...(item as Record<string, unknown>), number: index + 1 }));
  try { return Mustache.render(definition.template, context); }
  catch { return block.fallbackHtml || `<aside class="workpath-missing-widget">Could not render ${definition.name}.</aside>`; }
}

export function renderContentBlock(block: ContentBlock, assets: AssetRecord[] = [], assetUrl: (asset: AssetRecord) => string = assetPackagePath): string {
  if (block.type !== "richText") return renderWidgetBlock(block, assets, assetUrl);
  return block.html.replace(/\/api\/projects\/[a-z0-9-]+\/assets\/([a-f0-9-]{36})/gi, (original, assetId: string) => {
    const asset = assets.find((item) => item.id === assetId); return asset ? assetUrl(asset) : original;
  });
}

export function validateBlock(block: ContentBlock): ValidationIssue[] {
  if (block.type === "richText") return block.html.trim() ? [] : [{ blockId: block.id, message: "Rich text block is empty." }];
  const definition = findWidgetDefinition(block.widgetKey);
  if (!definition) return [{ blockId: block.id, message: `Widget definition “${block.widgetKey}” is missing.` }];
  const issues: ValidationIssue[] = [];
  for (const parameter of definition.parameters) {
    const value = block.params[parameter.name];
    if (parameter.type === "repeatable" && (!Array.isArray(value) || value.length < (parameter.min ?? 0))) issues.push({ blockId: block.id, message: `${parameter.title} needs at least ${parameter.min ?? 1} item(s).` });
  }
  if (block.widgetKey === "table") {
    const columns = Array.isArray(block.params.columns) ? block.params.columns : [];
    const rows = Array.isArray(block.params.rows) ? block.params.rows : [];
    if (!String(block.params.caption ?? "").trim()) issues.push({ blockId: block.id, message: "A table caption is required for accessibility." });
    if (columns.length < 1) issues.push({ blockId: block.id, message: "Add at least one table column." });
    if (rows.some((row) => !row || typeof row !== "object" || !Array.isArray((row as { cells?: unknown }).cells) || (row as { cells: unknown[] }).cells.length !== columns.length)) issues.push({ blockId: block.id, message: "Every table row must match the column count." });
  }
  if ((block.widgetKey === "image" || block.widgetKey === "image-text") && !block.params.imageAssetId) issues.push({ blockId: block.id, message: "Choose an image." });
  if ((block.widgetKey === "image" || block.widgetKey === "image-text") && !String(block.params.altText ?? "").trim()) issues.push({ blockId: block.id, message: "Alternative text is required." });
  const unsafeHtml = (value: unknown) => /<script\b|<iframe\b|\son\w+\s*=|javascript\s*:/i.test(String(value ?? ""));
  if (block.widgetKey === "custom-html" && unsafeHtml(block.params.html)) issues.push({ blockId: block.id, message: "Custom HTML contains scripts, iframes, event handlers, or JavaScript URLs." });
  if (block.widgetKey === "video-embed" && String(block.params.url ?? "").trim() && !approvedVideoUrl(String(block.params.url))) issues.push({ blockId: block.id, message: "Use an approved YouTube, Vimeo, Microsoft Stream, or SharePoint video URL." });
  if (block.widgetKey === "resource-card" && !/^https?:\/\/|^\/|^#/.test(String(block.params.url ?? ""))) issues.push({ blockId: block.id, message: "Resource URL must be an HTTP(S), relative, or page link." });
  if (block.widgetKey === "code-snippet" && !String(block.params.code ?? "").trim()) issues.push({ blockId: block.id, message: "Code cannot be empty." });
  if (block.widgetKey === "hotspot-image") {
    if (!block.params.imageAssetId) issues.push({ blockId: block.id, message: "Choose a hotspot image." });
    if (!String(block.params.altText ?? "").trim()) issues.push({ blockId: block.id, message: "Hotspot image alternative text is required." });
    const hotspots = Array.isArray(block.params.hotspots) ? block.params.hotspots as Array<Record<string, unknown>> : [];
    if (hotspots.some((hotspot) => Number(hotspot.x) < 0 || Number(hotspot.x) > 100 || Number(hotspot.y) < 0 || Number(hotspot.y) > 100)) issues.push({ blockId: block.id, message: "Hotspot positions must be between 0 and 100 percent." });
    if (hotspots.some((hotspot) => !String(hotspot.title ?? "").trim() || !String(hotspot.body ?? "").replace(/<[^>]+>/g, "").trim())) issues.push({ blockId: block.id, message: "Every hotspot needs a title and detail." });
  }
  if (["single-choice", "multiple-choice"].includes(block.widgetKey)) {
    const options = Array.isArray(block.params.options) ? block.params.options as Array<Record<string, unknown>> : [];
    const optionText = options.map((option) => String(option.text ?? "").trim()).filter(Boolean);
    if (optionText.length < 2 || optionText.length !== options.length) issues.push({ blockId: block.id, message: "Add at least two answer options with text." });
    if (new Set(optionText).size !== optionText.length) issues.push({ blockId: block.id, message: "Answer option text must be unique." });
    if (block.widgetKey === "single-choice" && !optionText.includes(String(block.params.correctAnswer ?? "").trim())) issues.push({ blockId: block.id, message: "Choose a correct answer from the answer options." });
    if (block.widgetKey === "multiple-choice") {
      const correct = String(block.params.correctAnswers ?? "").split(";").map((item) => item.trim()).filter(Boolean);
      if (!correct.length || correct.some((item) => !optionText.includes(item))) issues.push({ blockId: block.id, message: "Choose one or more correct answers from the answer options." });
    }
  }
  if (block.widgetKey === "flip-cards") {
    const cards = Array.isArray(block.params.cards) ? block.params.cards as Array<Record<string, unknown>> : [];
    if (cards.some((card) => !(card.imageAssetId || card.frontAssetId))) issues.push({ blockId: block.id, message: "Choose an image for every flip card." });
    if (cards.some((card) => (card.imageAssetId || card.frontAssetId) && !String(card.altText ?? "").trim())) issues.push({ blockId: block.id, message: "Alternative text is required for every flip card image." });
    if (cards.some((card) => !String(card.backTitle ?? "").trim() || !String(card.backBody ?? "").replace(/<[^>]+>/g, "").trim())) issues.push({ blockId: block.id, message: "Every flip card needs a back heading and text." });
  }
  if (block.widgetKey === "image-gallery") {
    const images = Array.isArray(block.params.images) ? block.params.images as Array<Record<string, unknown>> : [];
    if (images.some((image) => !image.imageAssetId)) issues.push({ blockId: block.id, message: "Choose an image for every gallery item." });
    if (images.some((image) => !String(image.altText ?? "").trim())) issues.push({ blockId: block.id, message: "Alternative text is required for every gallery image." });
  }
  if (block.widgetKey === "card-grid") {
    const cards = Array.isArray(block.params.cards) ? block.params.cards as Array<Record<string, unknown>> : [];
    if (cards.some((card) => card.imageAssetId && !String(card.altText ?? "").trim())) issues.push({ blockId: block.id, message: "Alternative text is required for each card image." });
  }
  return issues;
}
