import { useEffect, useMemo, useRef, useState } from "react";
import { renderContentBlock, type AssetRecord, type Chapter, type ContentBlock, type StoryboardRowInput, type StoryboardVerification, type Subchapter, type WorkPathProject } from "@workpath/core";
import { Trash2 } from "lucide-react";
import { BlockCanvas } from "./BlockCanvas";

type ProjectListItem = { id: string; title: string; updatedAt: string; revision: number };
type SelectedPage = { kind: "chapter"; chapter: Chapter } | { kind: "subchapter"; chapter: Chapter; subchapter: Subchapter };
const makeId = () => crypto.randomUUID();
const starterBlock = (): ContentBlock => ({ id: makeId(), type: "richText", html: "<p>Start writing here.</p>" });

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { ...init, headers: init?.body ? { "Content-Type": "application/json", ...(init.headers || {}) } : init?.headers });
  if (!response.ok) throw new Error((await response.json().catch(() => null))?.error || `Request failed (${response.status})`);
  return response.json() as Promise<T>;
}

function findPage(project: WorkPathProject | null, id: string): SelectedPage | null {
  if (!project) return null;
  for (const chapter of project.chapters) {
    if (chapter.id === id) return { kind: "chapter", chapter };
    const subchapter = chapter.subchapters.find((entry) => entry.id === id);
    if (subchapter) return { kind: "subchapter", chapter, subchapter };
  }
  return null;
}

export function App() {
  const [projects, setProjects] = useState<ProjectListItem[]>([]);
  const [projectId, setProjectId] = useState("");
  const [project, setProject] = useState<WorkPathProject | null>(null);
  const [selectedPageId, setSelectedPageId] = useState("");
  const [status, setStatus] = useState("Connecting to local service…");
  const [previewMode, setPreviewMode] = useState(false);
  const importInput = useRef<HTMLInputElement>(null);
  const bookWorkbookInput = useRef<HTMLInputElement>(null);
  const storyboardInput = useRef<HTMLInputElement>(null);
  const storyboardTargetRef = useRef<{ kind: "chapter" | "subchapter"; parentChapterId?: string } | null>(null);
  const [storyboardTarget, setStoryboardTarget] = useState<{ kind: "chapter" | "subchapter"; parentChapterId?: string } | null>(null);
  const [storyboardReview, setStoryboardReview] = useState<StoryboardVerification | null>(null);
  const [storyboardError, setStoryboardError] = useState("");
  const selected = findPage(project, selectedPageId);
  const chapters = useMemo(() => [...(project?.chapters ?? [])].sort((a, b) => a.order - b.order), [project?.chapters]);

  async function refreshProjects() { const next = await request<ProjectListItem[]>("/api/projects"); setProjects(next); setStatus(`${next.length} local project(s)`); }
  useEffect(() => { void refreshProjects().catch((error) => setStatus(error.message)); }, []);
  async function openProject(id: string) { const next = await request<WorkPathProject>(`/api/projects/${id}`); setProjectId(id); setProject(next); setSelectedPageId(next.chapters[0]?.id ?? ""); setPreviewMode(false); setStatus(`Opened ${next.title}`); }
  async function deleteProject(item: ProjectListItem) {
    if (!window.confirm(`Delete “${item.title}” permanently?\n\nThis removes its saved content, assets and exports. This action cannot be undone.`)) return;
    try {
      await request<{ id: string; title: string }>(`/api/projects/${item.id}`, { method: "DELETE" });
      setProjects((current) => current.filter((projectItem) => projectItem.id !== item.id));
      setStatus(`Deleted ${item.title}`);
    } catch (error) { setStatus(error instanceof Error ? `Delete failed: ${error.message}` : "Delete failed"); }
  }
  async function createNew() {
    const title = window.prompt("Project title", "Untitled Moodle Book")?.trim(); if (!title) return;
    const created = await request<{ id: string; project: WorkPathProject }>("/api/projects", { method: "POST", body: JSON.stringify({ title }) });
    setProjects((current) => [{ id: created.id, title: created.project.title, updatedAt: created.project.updatedAt, revision: created.project.revision }, ...current]);
    setProjectId(created.id); setProject(created.project); setSelectedPageId(created.project.chapters[0]?.id ?? ""); setPreviewMode(false); setStatus("Created local project");
  }
  async function importLegacy(file: File) {
    try {
      if (file.size > 20 * 1024 * 1024) throw new Error("Project JSON must be smaller than 20 MB.");
      const value: unknown = JSON.parse(await file.text()); setStatus(`Importing ${file.name}…`);
      const imported = await request<{ id: string; project: WorkPathProject; warnings: string[]; sourceSchemaVersion: string }>("/api/import/legacy", { method: "POST", body: JSON.stringify(value) });
      setProjectId(imported.id); setProject(imported.project); setSelectedPageId(imported.project.chapters[0]?.id ?? ""); setPreviewMode(false);
      setStatus(imported.warnings.length ? `Imported with ${imported.warnings.length} warning(s): ${imported.warnings.join(" ")}` : `Imported WorkPath ${imported.sourceSchemaVersion} project`); void refreshProjects();
    } catch (error) { setStatus(error instanceof Error ? `Import failed: ${error.message}` : "Import failed"); }
    finally { if (importInput.current) importInput.current.value = ""; }
  }
  async function importBookWorkbook(file: File) {
    try {
      if (file.size > 20 * 1024 * 1024) throw new Error("Book workbook must be smaller than 20 MB.");
      setStatus(`Importing ${file.name}…`);
      const response = await fetch("/api/import/storyboard-book", { method: "POST", headers: { "Content-Type": file.type || "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }, body: file });
      const result = await response.json().catch(() => null) as { id?: string; project?: WorkPathProject; error?: string; verification?: { errors?: string[] } } | null;
      if (!response.ok || !result?.id || !result.project) throw new Error(result?.verification?.errors?.join(" ") || result?.error || `Import failed (${response.status})`);
      setProjectId(result.id); setProject(result.project); setSelectedPageId(result.project.chapters[0]?.id ?? ""); setPreviewMode(false); setStatus(`Imported ${result.project.title}`); void refreshProjects();
    } catch (error) { setStatus(error instanceof Error ? `Import failed: ${error.message}` : "Book workbook import failed"); }
    finally { if (bookWorkbookInput.current) bookWorkbookInput.current.value = ""; }
  }
  async function save() {
    if (!project) return null;
    try { const saved = await request<WorkPathProject>(`/api/projects/${projectId}`, { method: "PUT", body: JSON.stringify(project) }); setProject(saved); setStatus(`Saved revision ${saved.revision}`); void refreshProjects(); return saved; }
    catch (error) { setStatus(error instanceof Error ? error.message : "Save failed"); return null; }
  }
  function change(updater: (current: WorkPathProject) => WorkPathProject) { setProject((current) => current ? updater(current) : current); }
  function updateSelected(updater: (page: Chapter | Subchapter) => Chapter | Subchapter) {
    if (!selected) return;
    change((current) => ({ ...current, chapters: current.chapters.map((chapter) => {
      if (selected.kind === "chapter") return chapter.id === selected.chapter.id ? updater(chapter) as Chapter : chapter;
      return chapter.id === selected.chapter.id ? { ...chapter, subchapters: chapter.subchapters.map((subchapter) => subchapter.id === selected.subchapter.id ? updater(subchapter) as Subchapter : subchapter) } : chapter;
    }) }));
  }
  function addChapter() {
    const chapter: Chapter = { id: makeId(), title: `Chapter ${chapters.length + 1}`, summary: "", order: chapters.length + 1, enabled: true, blocks: [starterBlock()], subchapters: [] };
    change((current) => ({ ...current, chapters: [...current.chapters, chapter] })); setSelectedPageId(chapter.id);
  }
  function addSubchapter(chapterId: string) {
    const chapter = project?.chapters.find((entry) => entry.id === chapterId); if (!chapter) return;
    const subchapter: Subchapter = { id: makeId(), title: `Subchapter ${chapter.subchapters.length + 1}`, summary: "", order: chapter.subchapters.length + 1, blocks: [starterBlock()] };
    change((current) => ({ ...current, chapters: current.chapters.map((entry) => entry.id === chapterId ? { ...entry, subchapters: [...entry.subchapters, subchapter] } : entry) })); setSelectedPageId(subchapter.id);
  }
  function moveChapter(index: number, direction: -1 | 1) {
    const target = index + direction; if (target < 0 || target >= chapters.length) return;
    const next = [...chapters]; [next[index], next[target]] = [next[target]!, next[index]!];
    change((current) => ({ ...current, chapters: next.map((chapter, position) => ({ ...chapter, order: position + 1 })) }));
  }
  function moveSubchapter(chapterId: string, index: number, direction: -1 | 1) {
    change((current) => ({ ...current, chapters: current.chapters.map((chapter) => {
      if (chapter.id !== chapterId) return chapter; const next = [...chapter.subchapters].sort((a, b) => a.order - b.order); const target = index + direction;
      if (target < 0 || target >= next.length) return chapter; [next[index], next[target]] = [next[target]!, next[index]!]; return { ...chapter, subchapters: next.map((subchapter, position) => ({ ...subchapter, order: position + 1 })) };
    }) }));
  }
  function deleteChapter(chapterId: string) {
    const chapter = project?.chapters.find((entry) => entry.id === chapterId); if (!chapter || !window.confirm(`Delete “${chapter.title}” and all of its subchapters?`)) return;
    const remaining = chapters.filter((entry) => entry.id !== chapterId).map((entry, index) => ({ ...entry, order: index + 1 })); change((current) => ({ ...current, chapters: remaining })); setSelectedPageId(remaining[0]?.id ?? "");
  }
  function deleteSubchapter(chapterId: string, subchapterId: string) {
    const chapter = project?.chapters.find((entry) => entry.id === chapterId); const subchapter = chapter?.subchapters.find((entry) => entry.id === subchapterId); if (!chapter || !subchapter || !window.confirm(`Delete subchapter “${subchapter.title}”?`)) return;
    change((current) => ({ ...current, chapters: current.chapters.map((entry) => entry.id === chapterId ? { ...entry, subchapters: entry.subchapters.filter((item) => item.id !== subchapterId).map((item, index) => ({ ...item, order: index + 1 })) } : entry) })); setSelectedPageId(chapterId);
  }
  const assetUrl = (asset: AssetRecord) => `/api/projects/${projectId}/assets/${asset.id}`;
  function setNestedParam(params: Record<string, unknown>, path: string, value: unknown) {
    const parts = path.split("."); const next = structuredClone(params); let target: Record<string, unknown> | unknown[] = next;
    parts.forEach((part, index) => { if (index === parts.length - 1) { if (Array.isArray(target)) target[Number(part)] = value; else target[part] = value; return; } const child = Array.isArray(target) ? target[Number(part)] : target[part]; if (!child || typeof child !== "object") return; target = child as Record<string, unknown> | unknown[]; });
    return next;
  }
  async function uploadBlockImage(blockId: string, parameterName: string, file: File) {
    if (!project) return;
    try {
      const saved = await save(); if (!saved) return; setStatus(`Uploading ${file.name}…`);
      const response = await fetch(`/api/projects/${projectId}/assets`, { method: "POST", headers: { "Content-Type": file.type, "X-Filename": encodeURIComponent(file.name), "X-Project-Revision": String(saved.revision) }, body: file });
      const result = await response.json().catch(() => null) as { asset?: AssetRecord; project?: WorkPathProject; error?: string } | null;
      if (!response.ok || !result?.asset || !result.project) throw new Error(result?.error || `Upload failed (${response.status})`);
      const asset = result.asset; const updateBlocks = (blocks: ContentBlock[]) => blocks.map((block) => block.id === blockId && block.type === "widget" ? { ...block, params: setNestedParam(block.params, parameterName, asset.id) } : block);
      setProject({ ...result.project, chapters: result.project.chapters.map((chapter) => ({ ...chapter, blocks: updateBlocks(chapter.blocks), subchapters: chapter.subchapters.map((subchapter) => ({ ...subchapter, blocks: updateBlocks(subchapter.blocks) })) })) });
      setStatus(`Uploaded ${asset.filename}; save to keep the block selection`);
    } catch (error) { setStatus(error instanceof Error ? error.message : "Image upload failed"); }
  }
  async function exportBook() { if (project && await save()) window.location.href = `/api/projects/${projectId}/export`; }
  async function exportBookStoryboard() { if (project && await save()) window.location.href = `/api/projects/${projectId}/storyboard.xlsx`; }
  function beginStoryboardImport(kind: "chapter" | "subchapter", parentChapterId?: string) { const target = { kind, parentChapterId }; storyboardTargetRef.current = target; setStoryboardTarget(target); setStoryboardReview(null); setStoryboardError(""); storyboardInput.current?.click(); }
  async function verifyStoryboard(file: File) {
    try {
      setStatus(`Verifying ${file.name}…`);
      const response = await fetch(`/api/storyboard/verify?filename=${encodeURIComponent(file.name)}`, { method: "POST", headers: { "Content-Type": file.type || "application/octet-stream" }, body: file });
      const result = await response.json().catch(() => null) as StoryboardVerification & { error?: string };
      if (!response.ok) throw new Error(result?.error || `Verification failed (${response.status})`);
      setStoryboardReview(result); setStatus(result.valid ? "Storyboard is ready to import" : "Storyboard needs corrections");
    } catch (error) { const message = error instanceof Error ? error.message : "Storyboard verification failed"; setStatus(message); setStoryboardError(message); setStoryboardReview(null); }
    finally { if (storyboardInput.current) storyboardInput.current.value = ""; }
  }
  async function applyStoryboard() {
    const target = storyboardTargetRef.current ?? storyboardTarget;
    if (!project || !target || !storyboardReview?.valid) return;
    const rows: StoryboardRowInput[] = storyboardReview.rows.map((row, index) => ({ topic: index === 0 ? storyboardReview.title : "", order: row.order, blockType: row.blockType, content: row.content, mapping: row.mapping, settingsJson: row.settingsJson }));
    try {
      const result = await request<{ pageId: string; project: WorkPathProject }>(`/api/projects/${projectId}/storyboard/import`, { method: "POST", body: JSON.stringify({ ...target, revision: project.revision, rows }) });
      setProject(result.project); setSelectedPageId(result.pageId); setStoryboardReview(null); setStoryboardTarget(null); setStatus(`Imported ${storyboardReview.title}`); void refreshProjects();
    } catch (error) { const message = error instanceof Error ? error.message : "Storyboard import failed"; setStatus(message); setStoryboardError(message); }
  }
  function closeStoryboardReview() { setStoryboardReview(null); setStoryboardTarget(null); setStoryboardError(""); storyboardTargetRef.current = null; }

  if (!project) return <main className="welcome"><section><span className="eyebrow">Local-first Moodle authoring</span><h1>WorkPath Author Local</h1><p>Projects and assets live on this computer. Moodle Book packages are compiled by the local service.</p><div className="welcome-actions"><button className="primary" onClick={() => void createNew()}>Create project</button><button onClick={() => bookWorkbookInput.current?.click()}>Import Excel Book</button><button onClick={() => importInput.current?.click()}>Import original project</button><input ref={bookWorkbookInput} className="visually-hidden" type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={(event) => { const file = event.target.files?.[0]; if (file) void importBookWorkbook(file); }} /><input ref={importInput} className="visually-hidden" type="file" accept=".json,.workpath.json,.uoclearn.json,application/json" onChange={(event) => { const file = event.target.files?.[0]; if (file) void importLegacy(file); }} /></div><div className="project-list">{projects.map((item) => <div className="project-list-item" key={item.id}><button className="project-open" onClick={() => void openProject(item.id)}><strong>{item.title}</strong><small>Revision {item.revision} · {new Date(item.updatedAt).toLocaleString()}</small></button><button className="project-delete" title={`Delete ${item.title}`} aria-label={`Delete ${item.title}`} onClick={() => void deleteProject(item)}><Trash2 size={18} aria-hidden="true" /></button></div>)}</div><footer aria-live="polite">{status}</footer></section></main>;
  if (previewMode) return <PreviewPage project={project} selectedPageId={selectedPageId} assetUrl={assetUrl} onSelectPage={setSelectedPageId} onReturn={() => setPreviewMode(false)} />;

  const page = selected?.kind === "chapter" ? selected.chapter : selected?.subchapter;
  return <div className="app-shell">
    <header><div><span className="eyebrow">WorkPath Author Local</span><input value={project.title} onChange={(event) => change((current) => ({ ...current, title: event.target.value }))} /></div><nav><a className="header-button" href="/api/storyboard/template.xlsx">Excel template</a><button onClick={() => { setProject(null); setProjectId(""); void refreshProjects(); }}>Projects</button><button onClick={() => void save()}>Save</button><button onClick={() => setPreviewMode(true)}>Preview</button><button onClick={() => void exportBookStoryboard()}>Export Excel Book</button><button className="primary" onClick={() => void exportBook()}>Export Moodle Book</button></nav></header>
    <input ref={storyboardInput} className="visually-hidden" type="file" accept=".xlsx,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv" onChange={(event) => { const file = event.target.files?.[0]; if (file) void verifyStoryboard(file); }} />
    <aside className="structure-sidebar"><span className="eyebrow">Book structure</span>{chapters.map((chapter, chapterIndex) => <section key={chapter.id}><div className="structure-row"><button className={`chapter-link${chapter.id === selectedPageId ? " active" : ""}`} onClick={() => setSelectedPageId(chapter.id)}><strong>{chapter.title}</strong><small>Chapter</small></button><div className="structure-actions"><button title="Move chapter up" disabled={chapterIndex === 0} onClick={() => moveChapter(chapterIndex, -1)}>↑</button><button title="Move chapter down" disabled={chapterIndex === chapters.length - 1} onClick={() => moveChapter(chapterIndex, 1)}>↓</button><button className="danger" title="Delete chapter" onClick={() => deleteChapter(chapter.id)}>×</button></div></div>{[...chapter.subchapters].sort((a, b) => a.order - b.order).map((subchapter, subchapterIndex, sorted) => <div className="structure-row subchapter-row" key={subchapter.id}><button className={`subchapter-link${subchapter.id === selectedPageId ? " active" : ""}`} onClick={() => setSelectedPageId(subchapter.id)}>{subchapter.title}</button><div className="structure-actions"><button title="Move subchapter up" disabled={subchapterIndex === 0} onClick={() => moveSubchapter(chapter.id, subchapterIndex, -1)}>↑</button><button title="Move subchapter down" disabled={subchapterIndex === sorted.length - 1} onClick={() => moveSubchapter(chapter.id, subchapterIndex, 1)}>↓</button><button className="danger" title="Delete subchapter" onClick={() => deleteSubchapter(chapter.id, subchapter.id)}>×</button></div></div>)}<div className="subchapter-buttons"><button onClick={() => addSubchapter(chapter.id)}>+ Add subchapter</button><button onClick={() => beginStoryboardImport("subchapter", chapter.id)}>Import Excel</button></div></section>)}<div className="chapter-buttons"><button onClick={addChapter}>+ Add chapter</button><button onClick={() => beginStoryboardImport("chapter")}>Import chapter</button></div></aside>
    <main className="editor">{page ? <article><section className="topic-settings"><div className="page-heading-row"><span className="eyebrow">{selected?.kind === "chapter" ? "Chapter" : `Subchapter of ${selected?.chapter.title}`}</span><div><a href={`/api/projects/${projectId}/pages/${page.id}/storyboard.xlsx`}>Export Excel</a><a href={`/api/projects/${projectId}/pages/${page.id}/storyboard.csv`}>Export CSV</a></div></div><input className="topic-title" aria-label="Page title" value={page.title} onChange={(event) => updateSelected((current) => ({ ...current, title: event.target.value }))} /><textarea className="summary" aria-label="Page purpose" placeholder="Learner-facing purpose…" value={page.summary} onChange={(event) => updateSelected((current) => ({ ...current, summary: event.target.value }))} />{selected?.kind === "chapter" && <><label className="chapter-enabled"><input type="checkbox" checked={selected.chapter.enabled} onChange={(event) => updateSelected((current) => ({ ...current, enabled: event.target.checked }))} /> Include this chapter in Moodle export</label><p className="structure-hint">This chapter can contain learning blocks directly. Add subchapters only when learners benefit from another level of breakdown.</p></>}</section><BlockCanvas blocks={page.blocks} assets={project.assets} assetUrl={assetUrl} onUpload={uploadBlockImage} onChange={(blocks) => updateSelected((current) => ({ ...current, blocks }))} /></article> : <div className="empty"><h2>Add a chapter to begin</h2><button onClick={addChapter}>+ Add chapter</button></div>}</main>
    <footer className="status">{status}</footer>
    {storyboardReview && <StoryboardReview verification={storyboardReview} target={storyboardTarget?.kind ?? "chapter"} onClose={closeStoryboardReview} onImport={() => void applyStoryboard()} />}
    {storyboardError && !storyboardReview && <ImportError message={storyboardError} onClose={closeStoryboardReview} />}
  </div>;
}

function ImportError({ message, onClose }: { message: string; onClose: () => void }) {
  return <div className="modal-backdrop" role="presentation"><section className="import-error" role="alertdialog" aria-modal="true" aria-labelledby="import-error-title"><span className="eyebrow">Storyboard import</span><h2 id="import-error-title">Could not read this file</h2><p>{message}</p><p>Use the current WorkPath Excel template and make sure the local service was restarted after the storyboard feature was installed.</p><button className="primary" onClick={onClose}>Close</button></section></div>;
}

function StoryboardReview({ verification, target, onClose, onImport }: { verification: StoryboardVerification; target: "chapter" | "subchapter"; onClose: () => void; onImport: () => void }) {
  return <div className="modal-backdrop" role="presentation"><section className="storyboard-review" role="dialog" aria-modal="true" aria-labelledby="storyboard-review-title"><header><div><span className="eyebrow">Import {target}</span><h2 id="storyboard-review-title">{verification.title || "Storyboard verification"}</h2></div><button onClick={onClose}>×</button></header><div className="review-summary"><strong>{verification.rows.length} block(s)</strong><span className={verification.valid ? "valid" : "invalid"}>{verification.valid ? "Ready to import" : "Corrections required"}</span></div>{verification.messages.length > 0 && <ul className="review-messages">{verification.messages.map((message, index) => <li className={message.severity} key={`${message.row}-${index}`}><strong>Row {message.row}:</strong> {message.message}</li>)}</ul>}<div className="review-blocks">{verification.rows.map((row) => <article key={row.row}><header><strong>{row.order}. {row.blockType}</strong>{row.mapping && <span>Mapping: {row.mapping}</span>}</header>{row.previewHtml ? <div dangerouslySetInnerHTML={{ __html: row.previewHtml }} /> : <p>Preview unavailable.</p>}</article>)}</div><footer><button onClick={onClose}>Cancel</button><button className="primary" disabled={!verification.valid} onClick={onImport}>Create {target}</button></footer></section></div>;
}

function PreviewPage({ project, selectedPageId, assetUrl, onSelectPage, onReturn }: { project: WorkPathProject; selectedPageId: string; assetUrl: (asset: AssetRecord) => string; onSelectPage: (id: string) => void; onReturn: () => void }) {
  const selected = findPage(project, selectedPageId) ?? (project.chapters[0] ? { kind: "chapter" as const, chapter: project.chapters[0] } : null);
  const page = selected?.kind === "chapter" ? selected.chapter : selected?.subchapter;
  return <div className="preview-page"><header className="preview-banner"><div><span className="eyebrow">Moodle preview</span><strong>{project.title}</strong></div><button onClick={onReturn}>← Return to editor</button></header><div className="preview-layout"><nav className="preview-navigation" aria-label="Book chapters">{project.chapters.filter((chapter) => chapter.enabled).sort((a, b) => a.order - b.order).map((chapter) => <section key={chapter.id}><button className={chapter.id === page?.id ? "active chapter-preview-link" : "chapter-preview-link"} onClick={() => onSelectPage(chapter.id)}>{chapter.title}</button>{[...chapter.subchapters].sort((a, b) => a.order - b.order).map((subchapter) => <button className={`preview-subchapter${subchapter.id === page?.id ? " active" : ""}`} key={subchapter.id} onClick={() => onSelectPage(subchapter.id)}>{subchapter.title}</button>)}</section>)}</nav><main className="moodle-preview">{page ? <article><h1>{page.title}</h1>{page.summary && <p className="preview-purpose"><strong>Purpose:</strong> {page.summary}</p>}{page.blocks.map((block) => <div className="preview-block" key={block.id} dangerouslySetInnerHTML={{ __html: renderContentBlock(block, project.assets, assetUrl) }} />)}{selected?.kind === "chapter" && selected.chapter.subchapters.length > 0 && <nav className="chapter-contents"><h2>In this chapter</h2><ul>{selected.chapter.subchapters.map((subchapter) => <li key={subchapter.id}><button onClick={() => onSelectPage(subchapter.id)}>{subchapter.title}</button></li>)}</ul></nav>}</article> : <div className="empty"><h1>No chapters to preview</h1></div>}</main></div></div>;
}
