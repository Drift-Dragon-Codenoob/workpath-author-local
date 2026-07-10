import { mkdir, readFile, readdir, rename, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import path from "node:path";
import { assertProject, compileMoodleBook, createProject, importLegacyProject, migrateProject, type AssetRecord, type Chapter, type ContentBlock, type Subchapter, type WorkPathProject } from "@workpath/core";

export const projectsRoot = path.resolve(process.env.WORKPATH_PROJECTS_DIR || path.join(homedir(), "WorkPath Projects"));

function safeId(value: string) {
  if (!/^[a-z0-9][a-z0-9-]{0,80}$/.test(value)) throw new Error("Invalid project id.");
  return value;
}

function projectDir(id: string) { return path.join(projectsRoot, safeId(id)); }
function projectFile(id: string) { return path.join(projectDir(id), "project.json"); }
const slug = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "untitled";

export async function initialiseStore() { await mkdir(projectsRoot, { recursive: true }); }

export async function listProjects() {
  await initialiseStore();
  const entries = await readdir(projectsRoot, { withFileTypes: true });
  const projects = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    try {
      const project = await loadProject(entry.name);
      projects.push({ id: entry.name, title: project.title, updatedAt: project.updatedAt, revision: project.revision });
    } catch { /* Ignore unrelated folders. */ }
  }
  return projects.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function createStoredProject(title: string) {
  const id = `${slug(title)}-${Date.now().toString(36)}`;
  const project = createProject(title.trim() || "Untitled Moodle Book");
  await mkdir(path.join(projectDir(id), "assets", "originals"), { recursive: true });
  await mkdir(path.join(projectDir(id), "exports"), { recursive: true });
  await saveProject(id, project, false);
  return { id, project };
}

export async function importStoredProject(value: unknown) {
  const imported = importLegacyProject(value);
  const id = `${slug(imported.project.title)}-${Date.now().toString(36)}`;
  await mkdir(path.join(projectDir(id), "assets", "originals"), { recursive: true });
  await mkdir(path.join(projectDir(id), "exports"), { recursive: true });
  const project = await saveProject(id, imported.project, false);
  return { id, project, warnings: imported.warnings, sourceSchemaVersion: imported.sourceSchemaVersion };
}

export async function loadProject(id: string): Promise<WorkPathProject> {
  const value: unknown = JSON.parse(await readFile(projectFile(id), "utf8"));
  const project = migrateProject(value);
  assertProject(project);
  return project;
}

export async function saveProject(id: string, project: WorkPathProject, increment = true) {
  assertProject(project);
  const existing = increment ? await loadProject(id) : null;
  if (existing && project.revision !== existing.revision) throw new Error(`Revision conflict: expected ${existing.revision}. Reload the project.`);
  const next = { ...project, revision: increment ? project.revision + 1 : project.revision, updatedAt: new Date().toISOString() };
  const target = projectFile(id);
  const temporary = `${target}.tmp`;
  await writeFile(temporary, `${JSON.stringify(next, null, 2)}\n`, "utf8");
  await rename(temporary, target);
  return next;
}

const allowedImages = new Set(["image/jpeg", "image/png", "image/gif", "image/webp"]);

export async function addProjectImage(id: string, filename: string, mimeType: string, bytes: Uint8Array, revision: number) {
  if (!allowedImages.has(mimeType)) throw new Error("Choose a PNG, JPEG, GIF, or WebP image.");
  if (!bytes.length) throw new Error("The image file is empty.");
  if (bytes.length > 20 * 1024 * 1024) throw new Error("Images must be smaller than 20 MB.");
  const project = await loadProject(id);
  if (project.revision !== revision) throw new Error(`Revision conflict: expected ${project.revision}. Reload the project.`);
  const safeName = filename.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-|-$/g, "") || "image";
  const asset: AssetRecord = { id: crypto.randomUUID(), filename: safeName, mimeType, size: bytes.length, relativePath: `assets/originals/${crypto.randomUUID()}-${safeName}` };
  await writeFile(path.join(projectDir(id), asset.relativePath), bytes);
  const saved = await saveProject(id, { ...project, assets: [...project.assets, asset] });
  return { asset, project: saved };
}

export async function readProjectAsset(id: string, assetId: string) {
  if (!/^[a-f0-9-]{36}$/.test(assetId)) throw new Error("Invalid asset id.");
  const project = await loadProject(id);
  const asset = project.assets.find((item) => item.id === assetId);
  if (!asset || !asset.relativePath.startsWith("assets/originals/")) throw new Error("Asset not found.");
  return { asset, bytes: await readFile(path.join(projectDir(id), asset.relativePath)) };
}

export async function importStoryboardPage(id: string, input: { kind: "chapter" | "subchapter"; parentChapterId?: string; title: string; blocks: ContentBlock[]; revision: number }) {
  const project = await loadProject(id);
  if (project.revision !== input.revision) throw new Error(`Revision conflict: expected ${project.revision}. Reload the project.`);
  if (!input.title.trim()) throw new Error("Storyboard title is required.");
  if (!input.blocks.length) throw new Error("Storyboard must contain at least one block.");
  let pageId = "";
  let next: WorkPathProject;
  if (input.kind === "chapter") {
    const chapter: Chapter = { id: crypto.randomUUID(), title: input.title.trim(), summary: "", order: project.chapters.length + 1, enabled: true, blocks: input.blocks, subchapters: [] }; pageId = chapter.id;
    next = { ...project, chapters: [...project.chapters, chapter] };
  } else {
    const parent = project.chapters.find((chapter) => chapter.id === input.parentChapterId); if (!parent) throw new Error("Select a parent chapter for the imported subchapter.");
    const subchapter: Subchapter = { id: crypto.randomUUID(), title: input.title.trim(), summary: "", order: parent.subchapters.length + 1, blocks: input.blocks }; pageId = subchapter.id;
    next = { ...project, chapters: project.chapters.map((chapter) => chapter.id === parent.id ? { ...chapter, subchapters: [...chapter.subchapters, subchapter] } : chapter) };
  }
  return { pageId, project: await saveProject(id, next) };
}

export async function getProjectPage(id: string, pageId: string) {
  const project = await loadProject(id);
  for (const chapter of project.chapters) { if (chapter.id === pageId) return chapter; const subchapter = chapter.subchapters.find((entry) => entry.id === pageId); if (subchapter) return subchapter; }
  throw new Error("Chapter or subchapter not found.");
}

export async function exportProject(id: string) {
  const project = await loadProject(id);
  return compileMoodleBook({
    project,
    readAsset: async (asset) => new Uint8Array(await readFile(path.join(projectDir(id), asset.relativePath)))
  });
}
