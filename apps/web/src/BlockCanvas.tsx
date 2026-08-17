import { lazy, Suspense, useEffect, useState } from "react";
import { WIDGET_DEFINITIONS, createWidgetBlock, findWidgetDefinition, renderContentBlock, validateBlock, type AssetRecord, type BlockTemplate, type ContentBlock, type RichTextBlock, type WidgetBlock, type WidgetParameter } from "@workpath/core";
import { BookOpen, Boxes, Braces, CheckCircle2, FileText, Grid2X2, Image, LayoutGrid, Library, List, Save, Search, Sparkles, X } from "lucide-react";

const RichTextEditor = lazy(() => import("./RichTextEditor").then((module) => ({ default: module.RichTextEditor })));
const EditorLoading = () => <div className="editor-loading">Loading rich-text editor…</div>;

const makeRichText = (): RichTextBlock => ({ id: crypto.randomUUID(), type: "richText", html: "<p>Start writing here.</p>" });

export function BlockCanvas({ blocks, templates, assets, assetUrl, onChange, onUpload, onSaveTemplate, onDeleteTemplate }: { blocks: ContentBlock[]; templates: BlockTemplate[]; assets: AssetRecord[]; assetUrl: (asset: AssetRecord) => string; onChange: (blocks: ContentBlock[]) => void; onUpload: (blockId: string, parameterName: string, file: File) => Promise<void>; onSaveTemplate: (block: ContentBlock) => void; onDeleteTemplate: (template: BlockTemplate) => void }) {
  const [activeId, setActiveId] = useState(blocks[0]?.id ?? "");
  const [insertAt, setInsertAt] = useState<number | null>(null);
  useEffect(() => { if (activeId && !blocks.some((block) => block.id === activeId)) setActiveId(blocks[0]?.id ?? ""); }, [activeId, blocks]);
  const update = (id: string, block: ContentBlock) => onChange(blocks.map((entry) => entry.id === id ? block : entry));
  const openPicker = (index: number) => setInsertAt(index);
  const add = (source: ContentBlock) => { const block = structuredClone(source); block.id = crypto.randomUUID(); const next = [...blocks]; next.splice(insertAt ?? blocks.length, 0, block); onChange(next); setActiveId(block.id); setInsertAt(null); };
  const move = (index: number, direction: -1 | 1) => { const target = index + direction; if (target < 0 || target >= blocks.length) return; const next = [...blocks]; [next[index], next[target]] = [next[target]!, next[index]!]; onChange(next); };
  const duplicate = (index: number) => { const copy = structuredClone(blocks[index]!); copy.id = crypto.randomUUID(); const next = [...blocks]; next.splice(index + 1, 0, copy); onChange(next); setActiveId(copy.id); };
  const remove = (index: number) => { if (!window.confirm("Delete this block?")) return; onChange(blocks.filter((_, position) => position !== index)); };

  return <section className="block-builder" aria-label="Topic blocks">
    <div className="block-builder-heading"><div><span className="eyebrow">Build</span><h2>Content blocks</h2></div></div>
    {!blocks.length && insertAt === null && <button className="start-block-button" onClick={() => openPicker(0)}><strong>Add a block to start</strong><span>Choose text, media, an interaction, a saved template, or a table</span></button>}
    <div className="block-list">{blocks.map((block, index) => {
      const active = activeId === block.id;
      const label = block.type === "richText" ? "Rich text" : findWidgetDefinition(block.widgetKey)?.name ?? block.widgetKey;
      const issues = validateBlock(block);
      return <div className="block-and-insert" key={block.id}><article className={`block-card${active ? " active" : ""}`} onClick={() => setActiveId(block.id)}>
        <header><div><span className="block-number">{index + 1}</span><strong>{label}</strong></div><div className="block-actions"><button title="Move up" disabled={index === 0} onClick={(event) => { event.stopPropagation(); move(index, -1); }}>↑</button><button title="Move down" disabled={index === blocks.length - 1} onClick={(event) => { event.stopPropagation(); move(index, 1); }}>↓</button><button title="Save as project template" onClick={(event) => { event.stopPropagation(); onSaveTemplate(block); }}>Save template</button><button title="Duplicate" onClick={(event) => { event.stopPropagation(); duplicate(index); }}>Duplicate</button><button className="danger" title="Delete" onClick={(event) => { event.stopPropagation(); remove(index); }}>Delete</button></div></header>
        {issues.length > 0 && <ul className="validation-list">{issues.map((issue) => <li key={issue.message}>{issue.message}</li>)}</ul>}
        {active ? <>{block.type === "richText" ? <Suspense fallback={<EditorLoading />}><RichTextEditor id={block.id} value={block.html} onChange={(html) => update(block.id, { ...block, html })} /></Suspense> : <WidgetEditor block={block} assets={assets} assetUrl={assetUrl} onUpload={onUpload} onChange={(next) => update(block.id, next)} />}<BlockMetadataFields block={block} onChange={(next) => update(block.id, next)} /></> : <div className="block-summary" dangerouslySetInnerHTML={{ __html: renderContentBlock(block, assets, assetUrl) }} />}
      </article>{index < blocks.length - 1 && <button className="insert-block-button" title={`Add a block between blocks ${index + 1} and ${index + 2}`} aria-label={`Add a block between blocks ${index + 1} and ${index + 2}`} onClick={() => openPicker(index + 1)}>+</button>}</div>;
    })}</div>
    {insertAt !== null && <BlockLibrary templates={templates} onDeleteTemplate={onDeleteTemplate} onClose={() => setInsertAt(null)} onAdd={add} />}
    {blocks.length > 0 && <button className="append-block-button" onClick={() => insertAt === blocks.length ? setInsertAt(null) : openPicker(blocks.length)}>{insertAt === blocks.length ? "Close block library" : "+ Add block"}</button>}
  </section>;
}

const categoryIcons = { All: Library, Saved: Save, Text: FileText, Content: List, Layout: LayoutGrid, Media: Image, Interactive: Sparkles, "Knowledge check": CheckCircle2, Resources: BookOpen, Data: Grid2X2, Advanced: Braces } as const;

function BlockLibrary({ templates, onDeleteTemplate, onClose, onAdd }: { templates: BlockTemplate[]; onDeleteTemplate: (template: BlockTemplate) => void; onClose: () => void; onAdd: (block: ContentBlock) => void }) {
  const [category, setCategory] = useState<keyof typeof categoryIcons>("All");
  const [query, setQuery] = useState("");
  const categories = Object.keys(categoryIcons) as Array<keyof typeof categoryIcons>;
  const definitions = WIDGET_DEFINITIONS.filter((definition) => category !== "Saved" && (category === "All" || definition.category === category) && `${definition.name} ${definition.description} ${definition.category}`.toLowerCase().includes(query.trim().toLowerCase()));
  const matchingTemplates = templates.filter((template) => (category === "All" || category === "Saved") && template.name.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()));
  const showText = (category === "All" || category === "Text") && "rich text formatted tinymce".includes(query.trim().toLowerCase());
  return <div className="block-library-backdrop" role="presentation" onMouseDown={onClose}><section className="block-library" role="dialog" aria-modal="true" aria-labelledby="block-library-title" onMouseDown={(event) => event.stopPropagation()}>
    <aside><header><strong id="block-library-title">Block library</strong><button className="icon-button" aria-label="Close block library" onClick={onClose}><X aria-hidden="true" /></button></header><nav aria-label="Block categories">{categories.map((item) => { const Icon = categoryIcons[item]; return <button className={category === item ? "active" : ""} key={item} onClick={() => setCategory(item)}><Icon aria-hidden="true" />{item}</button>; })}</nav></aside>
    <main><label className="block-search"><Search aria-hidden="true" /><input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search blocks and saved templates" /></label><div className="library-heading"><div><span className="eyebrow">{category}</span><h3>{category === "All" ? "All blocks" : category === "Saved" ? "Saved templates" : `${category} blocks`}</h3></div><span>{definitions.length + matchingTemplates.length + (showText ? 1 : 0)} options</span></div><div className="library-grid">{matchingTemplates.map((template) => <article className="template-library-card" key={template.id}><button onClick={() => onAdd(template.block)}><Save aria-hidden="true" /><span><strong>{template.name}</strong><small>Reusable block saved in this project.</small><em>Saved template</em></span></button><button className="template-remove" onClick={() => onDeleteTemplate(template)}>Remove</button></article>)}{showText && <button onClick={() => onAdd(makeRichText())}><FileText aria-hidden="true" /><span><strong>Rich text</strong><small>Formatted text using TinyMCE.</small></span></button>}{definitions.map((definition) => { const Icon = categoryIcons[definition.category as keyof typeof categoryIcons] ?? Boxes; return <button key={definition.key} onClick={() => onAdd(createWidgetBlock(definition.key))}><Icon aria-hidden="true" /><span><strong>{definition.name}</strong><small>{definition.description}</small><em>{definition.category}</em></span></button>; })}{definitions.length === 0 && matchingTemplates.length === 0 && !showText && <p className="library-empty">No blocks match this search.</p>}</div></main>
  </section></div>;
}

function BlockMetadataFields({ block, onChange }: { block: ContentBlock; onChange: (block: ContentBlock) => void }) {
  const setMetadata = (field: "mapping" | "imagePrompt", value: string) => onChange({ ...block, metadata: { ...block.metadata, [field]: value } });
  const isImage = block.type === "widget" && (block.widgetKey === "image" || block.widgetKey === "image-text");
  return <details className="block-metadata" open={Boolean(block.metadata?.mapping || block.metadata?.imagePrompt)}><summary>Author metadata</summary><label className="field"><span>Mapping <small>Author-only; excluded from preview and Moodle</small></span><input value={block.metadata?.mapping ?? ""} onChange={(event) => setMetadata("mapping", event.target.value)} /></label>{isImage && <label className="field"><span>Suggested image prompt</span><textarea value={block.metadata?.imagePrompt ?? ""} onChange={(event) => setMetadata("imagePrompt", event.target.value)} /></label>}</details>;
}

function WidgetEditor({ block, assets, assetUrl, onChange, onUpload }: { block: WidgetBlock; assets: AssetRecord[]; assetUrl: (asset: AssetRecord) => string; onChange: (block: WidgetBlock) => void; onUpload: (blockId: string, parameterName: string, file: File) => Promise<void> }) {
  const definition = findWidgetDefinition(block.widgetKey);
  if (!definition) return <p className="error-box">The definition for {block.widgetKey} is unavailable. Its fallback content will be preserved.</p>;
  const setParam = (name: string, value: unknown) => onChange({ ...block, params: { ...block.params, [name]: value } });
  if (block.widgetKey === "table") return <TableEditor block={block} onChange={onChange} />;
  if (block.widgetKey === "hotspot-image") return <HotspotEditor block={block} assets={assets} assetUrl={assetUrl} onChange={onChange} onUpload={onUpload} />;
  if (["true-false", "single-choice", "multiple-choice"].includes(block.widgetKey)) return <KnowledgeCheckEditor block={block} assets={assets} assetUrl={assetUrl} onChange={onChange} onUpload={onUpload} />;
  return <div className="widget-editor"><p className="widget-description">{definition.description}</p>{definition.parameters.map((parameter) => <ParameterEditor key={parameter.name} parameter={parameter} value={block.params[parameter.name]} onChange={(value) => setParam(parameter.name, value)} id={`${block.id}-${parameter.name}`} path={parameter.name} assets={assets} assetUrl={assetUrl} onUpload={(path, file) => onUpload(block.id, path, file)} />)}</div>;
}

function KnowledgeCheckEditor({ block, assets, assetUrl, onChange, onUpload }: { block: WidgetBlock; assets: AssetRecord[]; assetUrl: (asset: AssetRecord) => string; onChange: (block: WidgetBlock) => void; onUpload: (blockId: string, parameterName: string, file: File) => Promise<void> }) {
  const definition = findWidgetDefinition(block.widgetKey)!;
  const setParam = (name: string, value: unknown) => onChange({ ...block, params: { ...block.params, [name]: value } });
  const parameter = (name: string) => definition.parameters.find((item) => item.name === name)!;
  const editor = (name: string) => <ParameterEditor parameter={parameter(name)} value={block.params[name]} onChange={(value) => setParam(name, value)} id={`${block.id}-${name}`} path={name} assets={assets} assetUrl={assetUrl} onUpload={(path, file) => onUpload(block.id, path, file)} />;
  if (block.widgetKey === "true-false") return <div className="widget-editor"><p className="widget-description">Learners select an answer, then reveal the explanation when ready.</p>{editor("question")}{editor("answer")}{editor("feedback")}</div>;
  const options = Array.isArray(block.params.options) ? block.params.options as Array<{ text?: string }> : [];
  const multiple = block.widgetKey === "multiple-choice";
  const correct = new Set(String(block.params.correctAnswers ?? "").split(";").map((item) => item.trim()).filter(Boolean));
  const updateOptions = (next: Array<{ text?: string }>) => { const valid = new Set(next.map((item) => item.text ?? "")); setParam("options", next); if (multiple) setParam("correctAnswers", [...correct].filter((item) => valid.has(item)).join("; ")); else if (!valid.has(String(block.params.correctAnswer ?? ""))) setParam("correctAnswer", next[0]?.text ?? ""); };
  const move = (index: number, direction: -1 | 1) => { const target = index + direction; if (target < 0 || target >= options.length) return; const next = [...options]; [next[index], next[target]] = [next[target]!, next[index]!]; updateOptions(next); };
  return <div className="widget-editor knowledge-check-editor"><p className="widget-description">Learners select their response before revealing the answer and explanation.</p>{editor("question")}<fieldset className="choice-options"><legend>Answer options</legend>{options.map((option, index) => <div className="choice-option" key={index}><input aria-label={`Option ${index + 1}`} value={option.text ?? ""} onChange={(event) => updateOptions(options.map((item, itemIndex) => itemIndex === index ? { ...item, text: event.target.value } : item))} /><label className="choice-correct"><input type={multiple ? "checkbox" : "radio"} name={`${block.id}-correct`} checked={multiple ? correct.has(option.text ?? "") : String(block.params.correctAnswer ?? "") === (option.text ?? "")} onChange={() => multiple ? setParam("correctAnswers", correct.has(option.text ?? "") ? [...correct].filter((item) => item !== option.text).join("; ") : [...correct, option.text ?? ""].filter(Boolean).join("; ")) : setParam("correctAnswer", option.text ?? "")} />Correct</label><div className="choice-actions"><button type="button" disabled={index === 0} aria-label={`Move option ${index + 1} up`} onClick={() => move(index, -1)}>↑</button><button type="button" disabled={index === options.length - 1} aria-label={`Move option ${index + 1} down`} onClick={() => move(index, 1)}>↓</button><button type="button" className="danger" disabled={options.length <= 2} aria-label={`Remove option ${index + 1}`} onClick={() => updateOptions(options.filter((_, itemIndex) => itemIndex !== index))}>Remove</button></div></div>)}</fieldset><button type="button" className="add-item" disabled={options.length >= (parameter("options").max ?? 10)} onClick={() => updateOptions([...options, { text: `Option ${options.length + 1}` }])}>+ Add option</button>{editor("feedback")}</div>;
}

type Hotspot = { number?: number; title?: string; body?: string; x?: number; y?: number };

function HotspotEditor({ block, assets, assetUrl, onChange, onUpload }: { block: WidgetBlock; assets: AssetRecord[]; assetUrl: (asset: AssetRecord) => string; onChange: (block: WidgetBlock) => void; onUpload: (blockId: string, parameterName: string, file: File) => Promise<void> }) {
  const hotspots = Array.isArray(block.params.hotspots) ? block.params.hotspots as Hotspot[] : [];
  const [selectedIndex, setSelectedIndex] = useState<number | null>(hotspots.length ? 0 : null);
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);
  const image = assets.find((asset) => asset.id === block.params.imageAssetId);
  const selected = selectedIndex === null ? null : hotspots[selectedIndex] ?? null;
  useEffect(() => { setSelectedIndex((current) => hotspots.length === 0 ? null : current === null || current >= hotspots.length ? 0 : current); }, [hotspots.length]);
  const setParams = (params: Record<string, unknown>) => onChange({ ...block, params: { ...block.params, ...params } });
  const updateHotspot = (index: number, update: (hotspot: Hotspot) => Hotspot) => setParams({ hotspots: hotspots.map((hotspot, itemIndex) => itemIndex === index ? update(hotspot) : hotspot) });
  const point = (clientX: number, clientY: number, canvas: HTMLElement) => {
    const rect = canvas.getBoundingClientRect();
    return { x: Math.round(Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100))), y: Math.round(Math.max(0, Math.min(100, ((clientY - rect.top) / rect.height) * 100))) };
  };
  const addAt = (clientX: number, clientY: number, canvas: HTMLElement) => {
    if (hotspots.length >= 12) return;
    const position = point(clientX, clientY, canvas); const index = hotspots.length;
    setParams({ hotspots: [...hotspots, { number: index + 1, title: `Hotspot ${index + 1}`, body: "<p>Add hotspot detail.</p>", ...position }] }); setSelectedIndex(index);
  };
  const imageParameter: WidgetParameter = { name: "imageAssetId", title: "Image", type: "image" };
  return <div className="widget-editor hotspot-editor">
    <p className="widget-description">Choose an image, then click it to add markers. Select a marker to edit its detail, or drag it to reposition.</p>
    <ParameterEditor parameter={imageParameter} value={block.params.imageAssetId} onChange={(value) => setParams({ imageAssetId: value })} id={`${block.id}-image`} path="imageAssetId" assets={assets} assetUrl={assetUrl} onUpload={(path, file) => onUpload(block.id, path, file)} />
    <label className="field"><span>Alternative text</span><input value={String(block.params.altText ?? "")} onChange={(event) => setParams({ altText: event.target.value })} /></label>
    {image ? <div className="hotspot-placement">
      <p>Click blank space to add a marker. Drag a marker to move it.</p>
      <div className="hotspot-canvas" onPointerDown={(event) => { if (event.target === event.currentTarget || event.target instanceof HTMLImageElement) addAt(event.clientX, event.clientY, event.currentTarget); }}>
        <img src={assetUrl(image)} alt="" />
        {hotspots.map((hotspot, index) => <button key={index} type="button" className={selectedIndex === index ? "selected" : ""} style={{ left: `${Number(hotspot.x) || 0}%`, top: `${Number(hotspot.y) || 0}%` }} aria-label={`Hotspot ${index + 1}: ${hotspot.title || "Untitled"}`} onClick={(event) => { event.stopPropagation(); setSelectedIndex(index); }} onPointerDown={(event) => { event.stopPropagation(); event.currentTarget.setPointerCapture(event.pointerId); setSelectedIndex(index); setDraggingIndex(index); }} onPointerMove={(event) => { if (draggingIndex !== index) return; const canvas = event.currentTarget.parentElement; if (!canvas) return; const position = point(event.clientX, event.clientY, canvas); updateHotspot(index, (current) => ({ ...current, ...position })); }} onPointerUp={() => setDraggingIndex(null)} onPointerCancel={() => setDraggingIndex(null)} onKeyDown={(event) => { const increment = event.shiftKey ? 5 : 1; const directions: Record<string, Partial<{ x: number; y: number }>> = { ArrowLeft: { x: -increment }, ArrowRight: { x: increment }, ArrowUp: { y: -increment }, ArrowDown: { y: increment } }; const direction = directions[event.key]; if (!direction) return; event.preventDefault(); updateHotspot(index, (current) => ({ ...current, x: Math.max(0, Math.min(100, Number(current.x) + (direction.x ?? 0))), y: Math.max(0, Math.min(100, Number(current.y) + (direction.y ?? 0))) })); }}>{index + 1}</button>)}
      </div>
    </div> : <p className="hotspot-empty">Choose an image before placing hotspots.</p>}
    {hotspots.length > 0 && <div className="hotspot-marker-list" aria-label="Hotspots">{hotspots.map((hotspot, index) => <button key={index} type="button" className={selectedIndex === index ? "selected" : ""} onClick={() => setSelectedIndex(index)}><span>{index + 1}</span>{hotspot.title || "Untitled hotspot"}</button>)}</div>}
    {selected && selectedIndex !== null && <section className="hotspot-detail">
      <header><strong>Hotspot {selectedIndex + 1}</strong><button type="button" className="danger" onClick={() => { const next = hotspots.filter((_, index) => index !== selectedIndex); setParams({ hotspots: next }); setSelectedIndex(next.length ? Math.min(selectedIndex, next.length - 1) : null); }}>Remove</button></header>
      <label className="field"><span>Title</span><input value={selected.title ?? ""} onChange={(event) => updateHotspot(selectedIndex, (current) => ({ ...current, title: event.target.value }))} /></label>
      <label className="field rich-field"><span>Detail</span><Suspense fallback={<EditorLoading />}><RichTextEditor id={`${block.id}-hotspot-${selectedIndex}`} value={selected.body ?? ""} onChange={(body) => updateHotspot(selectedIndex, (current) => ({ ...current, body }))} compact /></Suspense></label>
      <details className="hotspot-position"><summary>Fine-tune position</summary><div><label className="field"><span>Horizontal position (%)</span><input type="number" min="0" max="100" value={Number(selected.x) || 0} onChange={(event) => updateHotspot(selectedIndex, (current) => ({ ...current, x: Math.max(0, Math.min(100, event.target.valueAsNumber || 0)) }))} /></label><label className="field"><span>Vertical position (%)</span><input type="number" min="0" max="100" value={Number(selected.y) || 0} onChange={(event) => updateHotspot(selectedIndex, (current) => ({ ...current, y: Math.max(0, Math.min(100, event.target.valueAsNumber || 0)) }))} /></label></div></details>
    </section>}
  </div>;
}

function TableEditor({ block, onChange }: { block: WidgetBlock; onChange: (block: WidgetBlock) => void }) {
  const columns = Array.isArray(block.params.columns) ? block.params.columns as Array<{ heading?: string }> : [];
  const rows = Array.isArray(block.params.rows) ? block.params.rows as Array<{ cells?: string[] }> : [];
  const setParams = (params: Record<string, unknown>) => onChange({ ...block, params: { ...block.params, ...params } });
  const addColumn = () => {
    if (columns.length >= 10) return;
    setParams({ columns: [...columns, { heading: `Column ${columns.length + 1}` }], rows: rows.map((row) => ({ ...row, cells: [...(row.cells ?? []), ""] })) });
  };
  const removeColumn = (index: number) => {
    if (columns.length <= 1) return;
    setParams({ columns: columns.filter((_, position) => position !== index), rows: rows.map((row) => ({ ...row, cells: (row.cells ?? []).filter((_, position) => position !== index) })) });
  };
  const addRow = () => { if (rows.length < 50) setParams({ rows: [...rows, { cells: columns.map(() => "") }] }); };
  const removeRow = (index: number) => setParams({ rows: rows.filter((_, position) => position !== index) });
  return <div className="widget-editor table-editor"><p className="widget-description">Edit the table directly. Add or remove rows and columns as the content changes.</p><label className="field"><span>Accessible table caption</span><input value={String(block.params.caption ?? "")} onChange={(event) => setParams({ caption: event.target.value })} /></label><div className="table-grid-scroll"><table><thead><tr><th className="table-row-control" aria-label="Row controls" />{columns.map((column, columnIndex) => <th key={columnIndex}><input aria-label={`Column ${columnIndex + 1} heading`} value={column.heading ?? ""} onChange={(event) => setParams({ columns: columns.map((item, position) => position === columnIndex ? { ...item, heading: event.target.value } : item) })} /><button title={`Remove column ${columnIndex + 1}`} disabled={columns.length <= 1} onClick={() => removeColumn(columnIndex)}>×</button></th>)}<th className="table-column-add"><button onClick={addColumn} disabled={columns.length >= 10}>+ Column</button></th></tr></thead><tbody>{rows.map((row, rowIndex) => <tr key={rowIndex}><th className="table-row-control" scope="row"><span>Row {rowIndex + 1}</span><button title={`Remove row ${rowIndex + 1}`} disabled={rows.length <= 1} onClick={() => removeRow(rowIndex)}>×</button></th>{columns.map((_, columnIndex) => <td key={columnIndex}><input aria-label={`Row ${rowIndex + 1}, column ${columnIndex + 1}`} value={row.cells?.[columnIndex] ?? ""} onChange={(event) => setParams({ rows: rows.map((item, position) => position === rowIndex ? { ...item, cells: columns.map((__, cellIndex) => cellIndex === columnIndex ? event.target.value : item.cells?.[cellIndex] ?? "") } : item) })} /></td>)}<td /></tr>)}</tbody></table></div><button className="add-table-row" onClick={addRow} disabled={rows.length >= 50}>+ Add row</button></div>;
}

function ParameterEditor({ parameter, value, onChange, id, path, assets, assetUrl, onUpload }: { parameter: WidgetParameter; value: unknown; onChange: (value: unknown) => void; id: string; path: string; assets: AssetRecord[]; assetUrl: (asset: AssetRecord) => string; onUpload: (path: string, file: File) => Promise<void> }) {
  if (parameter.type === "richtext") return <label className="field rich-field"><span>{parameter.title}</span><Suspense fallback={<EditorLoading />}><RichTextEditor id={id} value={typeof value === "string" ? value : ""} onChange={onChange} compact /></Suspense></label>;
  if (parameter.type === "textarea") return <label className="field"><span>{parameter.title}</span><textarea className="code-textarea" value={typeof value === "string" ? value : ""} onChange={(event) => onChange(event.target.value)} spellCheck={false} /></label>;
  if (parameter.type === "repeatable") {
    const entries = Array.isArray(value) ? value as Array<Record<string, unknown>> : [];
    const addItem = () => { if (parameter.max && entries.length >= parameter.max) return; const index = entries.length + 1; const entry = Object.fromEntries((parameter.fields ?? []).map((field) => [field.name, typeof field.default === "string" ? field.default.replaceAll("{{i}}", String(index)) : field.default ?? ""])); onChange([...entries, entry]); };
    const moveItem = (index: number, direction: -1 | 1) => { const nextIndex = index + direction; if (nextIndex < 0 || nextIndex >= entries.length) return; const next = [...entries]; [next[index], next[nextIndex]] = [next[nextIndex]!, next[index]!]; onChange(next); };
    return <fieldset className="repeatable"><legend>{parameter.title}</legend>{entries.map((entry, index) => <details className="repeatable-item" key={index} open><summary><strong>{parameter.itemLabel ?? "Item"} {index + 1}</strong><span>{String(entry.title ?? entry.heading ?? entry.text ?? "").replace(/<[^>]+>/g, "")}</span></summary><div className="repeatable-controls"><button title={`Move ${parameter.itemLabel ?? "item"} up`} aria-label={`Move ${parameter.itemLabel ?? "item"} ${index + 1} up`} disabled={index === 0} onClick={() => moveItem(index, -1)}>↑</button><button title={`Move ${parameter.itemLabel ?? "item"} down`} aria-label={`Move ${parameter.itemLabel ?? "item"} ${index + 1} down`} disabled={index === entries.length - 1} onClick={() => moveItem(index, 1)}>↓</button><button className="danger" disabled={entries.length <= (parameter.min ?? 0)} onClick={() => onChange(entries.filter((_, position) => position !== index))}>Remove</button></div>{(parameter.fields ?? []).map((field) => <ParameterEditor key={field.name} parameter={field} value={entry[field.name]} id={`${id}-${index}-${field.name}`} path={`${path}.${index}.${field.name}`} assets={assets} assetUrl={assetUrl} onUpload={onUpload} onChange={(nextValue) => onChange(entries.map((item, position) => position === index ? { ...item, [field.name]: nextValue } : item))} />)}</details>)}<button className="add-item" disabled={Boolean(parameter.max && entries.length >= parameter.max)} onClick={addItem}>+ Add {parameter.itemLabel?.toLowerCase() ?? "item"}</button></fieldset>;
  }
  if (parameter.type === "image") {
    const selected = assets.find((asset) => asset.id === value);
    return <div className="field image-field"><span>{parameter.title}</span>{selected && <img src={assetUrl(selected)} alt="" />}<select value={String(value ?? "")} onChange={(event) => onChange(event.target.value)}><option value="">Choose an uploaded image</option>{assets.filter((asset) => asset.mimeType.startsWith("image/")).map((asset) => <option value={asset.id} key={asset.id}>{asset.filename}</option>)}</select><label className="upload-button">Upload new image<input className="visually-hidden" type="file" accept="image/png,image/jpeg,image/gif,image/webp" onChange={(event) => { const file = event.target.files?.[0]; if (file) void onUpload(path, file); event.target.value = ""; }} /></label></div>;
  }
  if (parameter.type === "select") return <label className="field"><span>{parameter.title}</span><select value={String(value ?? "")} onChange={(event) => onChange(event.target.value)}>{parameter.options?.map((option) => { const label = typeof option === "string" ? option : option.label; const optionValue = typeof option === "string" ? option : option.value; return <option key={optionValue} value={optionValue}>{label}</option>; })}</select></label>;
  if (parameter.type === "checkbox") return <label className="field checkbox-field"><input type="checkbox" checked={Boolean(value)} onChange={(event) => onChange(event.target.checked)} /><span>{parameter.title}</span></label>;
  return <label className="field"><span>{parameter.title}</span><input type={parameter.type === "numeric" ? "number" : "text"} value={typeof value === "string" || typeof value === "number" ? value : ""} onChange={(event) => onChange(parameter.type === "numeric" ? event.target.valueAsNumber : event.target.value)} /></label>;
}
