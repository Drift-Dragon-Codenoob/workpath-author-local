# WorkPath Author Local — Developer Handover

## Read this first

WorkPath Author Local is a clean, local-first rebuild of the original Moodle-hosted WorkPath Author application.

The new direction is:

- A local Node service owns projects, media, validation and Moodle compilation.
- A React application runs in the user's normal browser and acts only as the editing client.
- Editable project data lives on the local filesystem, not in browser storage.
- The primary delivery contract is a ZIP that Moodle imports as a native, editable **Book** resource.
- The previous browser application remains a reference and migration source; it is not the architectural foundation of this rebuild.

This repository is committed on `main` and tracks `https://github.com/Drift-Dragon-Codenoob/workpath-author-local.git` as `origin`.

## Current status

The foundation is runnable and verified. It currently provides:

- An npm workspace containing `web`, `server` and `core` packages.
- A React project list and chapter/subchapter block editor.
- A local Node HTTP API.
- Filesystem-backed project creation, listing, loading and atomic saving.
- Optimistic revision checks to prevent silent overwrites.
- A versioned `1.4` project schema with automatic `1.0`–`1.3` migration.
- A shared Moodle Book compiler.
- Original `.workpath.json` and `.uoclearn.json` project migration with explicit compatibility warnings.
- Moodle Book chapter-import ZIP and ZIP/TGZ-based `.mbz` recovery with packaged asset copying, `workpath-*` widget reconstruction and safe rich-text fallback.
- A block canvas with TinyMCE rich-text editing, ordering, duplication and deletion.
- A searchable Rise-inspired block library with 21 authoring options grouped by category.
- Shared definitions and Moodle-safe rendering for content, layout, resource, media, interaction, knowledge-check, data and advanced blocks.
- Rise-inspired top-down authoring with the block library appended after lesson content.
- A separate Moodle preview mode with book-topic navigation.
- Direct-edit dynamic tables with one to ten columns and up to fifty rows.
- Revision-safe PNG, JPEG, GIF and WebP upload, preview and Moodle packaging.
- Moodle chapter and `_sub.html` subchapter generation.
- Validated Excel storyboard template, verification review, chapter/subchapter import and lossless Excel/CSV export.
- Full-book structured Excel export with one canonical worksheet per chapter and subchapter.
- Validated full-book Excel import from the project selection screen.
- A compiler test confirming the expected ZIP structure.
- A production build in which the Node service can serve the compiled frontend.

The foundation does **not** yet provide external YAML widget-pack loading, `.workpath.zip` media migration, thumbnails, full validation or packaging as a desktop installer. See [Known gaps](#known-gaps-and-risks).

## Product language and Moodle mapping

Use this terminology consistently in code, UI and documentation:

| WorkPath term | Moodle term | Technical representation |
|---|---|---|
| Book | Book resource/activity | One compiled import ZIP |
| Chapter | Chapter | Top-level HTML file containing its own blocks |
| Subchapter | Subchapter | Optional child file ending `_sub.html` |
| Widget/block | Page content | Moodle-safe HTML inside a chapter or subchapter |
| Project | Editable source | Local project folder plus `project.json` |
| Moodle package | Delivery artifact | HTML/media ZIP for Book `Import chapter` |

Moodle Book supports only two content levels: chapters and subchapters. WorkPath must not introduce a third navigational level.

## Non-negotiable product contract

The application is successful only when its output can be imported into Moodle as a functional native Book.

The canonical workflow is:

1. An author creates or opens a WorkPath project locally.
2. WorkPath validates its structure, widgets, links and assets.
3. WorkPath compiles an HTML/media ZIP.
4. A teacher creates a Moodle Book resource.
5. The teacher uses **Book administration → Import chapter**.
6. Moodle turns ordinary HTML files into chapters and `_sub.html` files into subchapters.

An IMS Content Package is a different Moodle resource type and is not the primary target. A handcrafted `.mbz` backup may be investigated later, but should not replace the documented HTML import ZIP until it has been proven across the institutional Moodle versions.

## Repository layout

```text
WorkPath Author Local/
  apps/
    web/                 React browser client
      src/App.tsx        Current thin editing shell
      src/styles.css     Current application skin
      vite.config.ts     Dev server and /api proxy
    server/              Local filesystem/API process
      src/server.ts      HTTP routing and production web serving
      src/store.ts       Project filesystem boundary
  packages/
    core/                Environment-independent product logic
      src/schema.ts      Versioned project model and defaults
      src/compiler.ts    Moodle Book ZIP compiler
      src/compiler.test.ts
      src/index.ts       Public core API
  README.md              Short operator quick start
  EXCEL_WORKBOOKS.md     Canonical Excel import/export contract
  DEVELOPERS.md          This handover document
  run-workpath.mjs       Cross-platform build/start/browser launcher
  Run WorkPath.cmd       Native Windows launcher wrapper
  Run WorkPath.ps1       Windows/WSL path detection and delegation
  run-workpath.sh        WSL/Linux launcher wrapper
  package.json           Root workspace commands
  tsconfig.base.json     Shared TypeScript settings
```

## Architectural boundaries

### `packages/core`

This is the most important package. It should remain independent of React, the DOM and the local HTTP service.

It owns:

- Project schemas and schema migration.
- Widget definitions and canonical widget data.
- Moodle-safe rendering.
- Structure and asset validation.
- Filename and link generation.
- Moodle Book ZIP compilation.
- Compatibility fixtures and compiler tests.

If a feature affects the meaning or output of a project, its core logic belongs here.

### `apps/server`

The local service is the trust and filesystem boundary.

It owns:

- Safe filesystem paths.
- Project discovery and lifecycle.
- Atomic writes and backups.
- Media streaming and thumbnails.
- Import/export jobs.
- Calling the compiler.
- Serving the production frontend.

The browser must never be allowed to provide arbitrary filesystem paths. API routes should work with validated project and asset IDs.

### `apps/web`

The React application is an editing client.

It owns:

- Authoring interactions.
- Local UI state and drafts.
- Topic-level loading and navigation.
- Accessible previews and controls.
- Progress and error reporting.

It must not become the canonical storage layer. Avoid reintroducing IndexedDB, base64 media storage or whole-book rendering on every keystroke.

## Runtime flow

```text
Browser UI (127.0.0.1:4173 during development)
        │
        │ JSON API requests
        ▼
Local Node service (127.0.0.1:4174)
        │
        ├── project folders
        ├── original media
        ├── thumbnails
        └── exports
                │
                ▼
        @workpath/core compiler
                │
                ▼
        Moodle Book import ZIP
```

In a production build, the Node service serves the compiled React frontend as well as the API. Development keeps Vite and the API on separate ports with a proxy.

## Requirements

- Node.js 24 is used in the current environment.
- npm 11 is used in the current environment.
- No database or external service is required.

The implementation uses current Web/Node features including `crypto.randomUUID`, `structuredClone`, async iteration over request streams and ESM.

## Commands

From the repository root:

```bash
npm install
```

Install all workspace dependencies.

```bash
npm run dev
```

Build `@workpath/core`, then start:

- React/Vite: `http://127.0.0.1:4173`
- Local API: `http://127.0.0.1:4174`

For the shareable single-server workflow, use `npm run launch`. The launcher builds the application, chooses a free localhost port and opens the browser. Set `WORKPATH_NO_OPEN=1` for automated smoke tests that should not launch a browser.

Create the offline Windows x64 pilot package with `npm run release:windows`. This builds the frontend, bundles the server and runtime JavaScript dependencies into one module, downloads/caches the pinned portable Node.js runtime, and writes `release/WorkPath-Author-Local-portable-win-x64.zip`. The resulting launcher does not use npm or the network on the recipient computer.

```bash
npm run typecheck
```

Type-check all workspaces.

```bash
npm test
```

Run the core compiler test suite.

```bash
npm run build
```

Compile core, build the React frontend and compile the Node service.

```bash
npm start
```

Start the compiled Node service. Run `npm run build` first. The service then serves both the API and `apps/web/dist`.

## Configuration

| Variable | Default | Purpose |
|---|---|---|
| `WORKPATH_PROJECTS_DIR` | `~/WorkPath Projects` | Root folder for editable projects |
| `HOST` | `127.0.0.1` | Local API bind address |
| `PORT` | `4174` | Local API port |

The service deliberately binds to localhost by default. Do not expose it to a network without authentication, origin controls, CSRF protection and a security review.

Example isolated development store:

```bash
WORKPATH_PROJECTS_DIR=/tmp/workpath-projects npm run dev
```

## Local project layout

```text
~/WorkPath Projects/
  my-book-mre123ab/
    project.json
    assets/
      originals/
    exports/
    backups/
      project-r000012.json
```

The project folder ID is generated from the initial title plus a time-derived suffix. Renaming the project does not rename the folder.

`project.json` is written through a sibling temporary file and atomic rename. Each save keeps the previous JSON as one of up to 50 rolling revision backups. Media remains outside JSON under `assets/originals`.

Planned additions:

```text
    assets/
      originals/
      thumbnails/
    exports/
      2026-07-10-book-name.zip
```

## Project schema

The current local schema is `1.4` and is defined in `packages/core/src/schema.ts`. Schema `1.0`–`1.3` projects are migrated in memory when loaded and written as `1.4` on their next save. Former content topics become chapters; their former topics become optional subchapters. Schema `1.4` adds project-scoped reusable block templates.

```ts
type WorkPathProject = {
  schemaVersion: "1.4";
  id: string;
  title: string;
  unitCode: string;
  revision: number;
  createdAt: string;
  updatedAt: string;
  chapters: Chapter[];
  blockTemplates: BlockTemplate[];
  assets: AssetRecord[];
  theme: BookTheme;
};

type Chapter = {
  id: string;
  title: string;
  summary: string;
  order: number;
  enabled: boolean;
  blocks: ContentBlock[];
  subchapters: Subchapter[];
};

type Subchapter = {
  id: string;
  title: string;
  summary: string;
  order: number;
  blocks: ContentBlock[];
};
```

The content model is a discriminated union. TinyMCE content is stored as rich text, while structured widgets retain their definition key, version and parameters:

```ts
type WidgetBlock = {
  id: string;
  type: "widget";
  widgetKey: string;
  definitionVersion: string;
  params: Record<string, unknown>;
};

type RichTextBlock = {
  id: string;
  type: "richText";
  html: string;
};
```

Built-in widget definitions live in `packages/core/src/widgets.ts`. The registry currently adds Card grid, Responsive columns, Resource link card, Styled list group, Code snippet, True or false, Single-answer knowledge check, Multiple-answer knowledge check, Flip cards, Hotspot image, Custom HTML, Image gallery/carousel and Video embed to the original local block set. Definitions drive default data, the generic React editor, preview, validation, Excel Settings JSON and Moodle rendering.

Interactive blocks use semantic HTML and printable fallbacks rather than requiring JavaScript. Custom HTML removes scripts, iframes, inline event handlers and JavaScript URLs, and validation blocks export until unsafe source is removed. Dedicated Video embed is the supported iframe path and only converts approved provider URLs.

Every future schema change must include:

1. A new schema version.
2. A pure migration function in `packages/core`.
3. Fixtures for the previous version.
4. Round-trip and compiler tests.
5. No silent loss of unknown widget data.

## Revision and saving model

The server compares the incoming project revision with the current on-disk revision.

- Matching revision: save succeeds and revision increments.
- Different revision: save fails with a revision-conflict message.
- The browser must reload or explicitly resolve the conflict.

This is only the first concurrency safeguard. A later version should send focused patch commands or topic-specific documents rather than the complete project on every save.

## Current API

### `GET /api/projects`

Returns project summaries sorted by last update time.

### `POST /api/projects`

Request:

```json
{ "title": "My Moodle Book" }
```

Creates the project folder and initial `project.json`.

### `GET /api/projects/:id`

Loads the complete current project. This will eventually be replaced or supplemented by topic-level endpoints for large books.

### `PUT /api/projects/:id`

Saves a complete project after revision validation.

### `DELETE /api/projects/:id`

Permanently removes the validated project directory, including its content, assets and exports. The project must load successfully before deletion, and the ID is constrained to the project store root.

### `GET|POST /api/projects/:id/export`

Compiles and returns the Moodle Book ZIP.

### `POST /api/projects/:id/assets`

Uploads a PNG, JPEG, GIF or WebP request body. The request must include `Content-Type`, URL-encoded `X-Filename` and the current `X-Project-Revision`. The response contains the new asset and revision-incremented project.

### `GET /api/projects/:id/assets/:assetId`

Streams an original project image for local preview. Browser previews use this URL; compiled Moodle content uses the corresponding relative ZIP path.

### Storyboard endpoints

The canonical external workbook contract is documented in [EXCEL_WORKBOOKS.md](./EXCEL_WORKBOOKS.md). Keep it synchronized with parser, registry, image-fallback and template changes.

- `GET /api/storyboard/template.xlsx` returns the canonical three-sheet Excel template with a 21-option validated block dropdown.
- `POST /api/storyboard/verify?filename=...` accepts an XLSX or CSV body and returns parsed rows, previews, warnings and blocking errors without changing a project.
- `POST /api/projects/:id/storyboard/import` re-verifies submitted rows and creates one chapter or subchapter using optimistic revision checks.
- `GET /api/projects/:id/pages/:pageId/storyboard.xlsx` exports a lossless Excel storyboard.
- `GET /api/projects/:id/pages/:pageId/storyboard.csv` exports the compatible plain CSV representation.
- `GET /api/projects/:id/storyboard.xlsx` exports the complete editable book with one canonical worksheet per chapter and subchapter, followed by the shared Instructions and Block Types sheets.
- `POST /api/import/storyboard-book` validates a complete XLSX body and creates a new local project only when every content worksheet is valid.

Canonical block names are exact and are listed on the workbook's visible `Block Types` sheet. `Settings JSON` is authoritative when present. Mapping and suggested-image prompts live in block metadata and must never be passed to `renderContentBlock` output or Moodle reports.

The template's `Block Types` sheet has three columns: exact block name, block-library category and authoring guidance. The Storyboard validation list and Validation notes lookup derive their range from `STORYBOARD_BLOCK_TYPES.length`; never restore a hard-coded final row when adding another block. Keep `STORYBOARD_BLOCK_TYPES`, the widget registry, workbook guidance and the template regression test aligned.

The original eight structured storyboard types have readable Markdown import conventions. Newer blocks rely on `Settings JSON` because their nested data cannot be represented reliably in one Content cell. Spreadsheet export recursively removes every property ending in `AssetId`; assets must be selected again in the destination project.

Image rendering follows a three-level fallback: use the selected asset, otherwise show non-empty `altText` visibly in an image-shaped substitute, otherwise use a generated placeholder. Whole-book import creates a single trusted `placeholder-image.svg` asset only when a required image slot has neither an asset nor alternative text. `applyImportedImagePlaceholders` covers Image, Image + text, Hotspot image and every Image gallery entry while preserving existing selections, authored alt text and optional Card grid images. The SVG is stored under the imported project's `assets/originals` folder and is packaged normally if an author exports before replacing it.

The whole-book workbook includes disabled chapters because it is an editable-source handover. Moodle ZIP compilation continues to omit disabled chapters. Worksheet names are sanitised for Excel, limited to 31 characters and made unique without changing the Topic value stored in the sheet.

Whole-book exports include a `Book Structure` worksheet containing project metadata and the chapter/subchapter hierarchy. Import uses it to restore parentage, ordering, summaries and enabled state. For backward compatibility, a multi-sheet workbook without `Book Structure` imports each non-reference worksheet as a top-level chapter. Import is all-or-nothing: validation errors are returned before a project directory is created.

`loadWorkbook` first uses ExcelJS normally. On failure, `normalizeNamespacedWorkbook` provides compatibility with the GPTWork-generated OOXML dialect: it repairs workbook content types and absolute relationship targets, removes the `x:` namespace prefix, and strips decorative table package parts that ExcelJS cannot model. Normalisation occurs only in memory; semantic Storyboard and Book Structure validation is unchanged. Keep the compatibility regression test when updating ExcelJS or workbook generation.

The current API buffers JSON and ZIP output in memory. Media and large exports must move to streaming implementations before large-book readiness.

## Moodle compiler contract

The compiler currently produces:

```text
01-00-work-briefs.html
02-00-investigating-the-opportunity.html
02-01-evidence_sub.html
02-02-constraints_sub.html
assets/
workpath-import-report.txt
```

Compiler requirements for production readiness:

- Exactly one ordinary HTML file per enabled chapter, containing its authored blocks.
- Exactly one `_sub.html` file per optional subchapter.
- Deterministic ordering and collision-safe filenames.
- Valid `<title>` metadata.
- Moodle-safe, scoped HTML and CSS.
- Relative media references only.
- All referenced assets included.
- No `blob:`, `data:`, `file:` or local absolute paths.
- Broken links and missing assets block export.
- No scripts or unsafe event attributes unless explicitly supported by the target Moodle policy.
- Widgets remain readable if JavaScript is unavailable.
- An accurate human-readable and machine-readable validation report.

Moodle's HTML Book importer may retain the imported `<body>` while discarding or sanitising document-level `<head>` styles. Layout-critical export styling therefore belongs on the rendered body and widget elements as inline styles. The `<style>` block remains a progressive enhancement, not the only source of page framing or widget layout.

The current compiler scopes most typography under `.workpath-book`, which is preferable to styling Moodle globally. It still needs a dedicated sanitizer and institutional compatibility fixtures.

## Moodle compatibility questions to resolve

Before calling exports production-ready, record and test:

- The exact Chisholm Moodle version and upgrade schedule.
- Whether authors have `booktool/importhtml:import`.
- Whether imported `<style>` elements are retained.
- Which HTML elements and attributes are sanitised.
- Which iframe origins are allowed.
- Which Moodle/Bootstrap behaviours are available in Book content.
- Whether Book `Custom titles` is enabled to avoid duplicate H1 headings.
- Behaviour in Moodle's mobile app.
- Print-book styling.
- Whether repeated imports append, replace or duplicate chapters.

Keep test packages from the actual Moodle instance as regression fixtures where policy permits.

## Relationship to the original app

The reference application is currently located at:

```text
/home/dragon_code/projects/WorkPath Author
```

It contains:

- The original React/Vite browser implementation.
- YAML widget definitions and captured Moodle sample templates.
- DOCX storyboard import/export.
- `.workpath.json` and `.workpath.zip` support.
- IndexedDB asset storage.
- Existing Moodle Book export behaviour.
- Historical migration code.

Use it to understand expected behaviour and migrate assets deliberately. Do not copy its 6,000-line `App.tsx` into the rebuild.

Recommended migration order:

1. Project schema importer.
2. Asset extraction from legacy project ZIPs.
3. YAML widget schema and registry.
4. Pure widget renderer functions.
5. Widget editor components, one family at a time.
6. DOCX import/export after the local project model stabilises.

The old app's current working tree contains uncommitted feature work. Treat its files as reference material and do not modify them from this workspace unless explicitly requested.

## Performance direction

The rebuild exists partly to support larger books without browser lag. Preserve these rules:

- Load and render one topic at a time.
- Keep original media on disk.
- Generate small thumbnails in a background task.
- Stream uploads and exports.
- Never place base64 media in project JSON.
- Avoid cloning or saving the whole book on each keystroke.
- Virtualise long lists when necessary.
- Run DOCX parsing, validation and ZIP creation outside React.
- Keep compiler functions deterministic and testable.
- Cache derived preview HTML and invalidate it by topic/widget revision.

## Security direction

Although the service is local, imported content remains untrusted.

Required safeguards include:

- Validate project IDs and asset IDs.
- Never accept arbitrary filesystem paths from the browser.
- Prevent traversal through filenames and archive entries.
- Limit upload, request and decompressed archive sizes.
- Reject ZIP bombs and symlinks.
- Detect media types from content where practical.
- Sanitize imported and author-entered HTML.
- Escape titles and plain text during compilation.
- Avoid executing imported scripts in preview.
- Bind to localhost unless a reviewed authenticated mode is added.

## Known gaps and risks

These are known, not accidental omissions:

- Media deletion, thumbnails and duplicate-file detection are not implemented.
- Thumbnail generation is not implemented.
- The API buffers bodies and compiled ZIPs in memory.
- The web client loads and saves the complete project.
- Debounced autosave, save-before-preview/navigation/export and rolling JSON backups are implemented. A dedicated recovery UI is not yet available.
- Rich-text authoring uses TinyMCE; structured widget editors remain purpose-built React controls.
- HTML safety checks reject scripts, event handlers and JavaScript URLs, but institutional Moodle sanitisation compatibility still needs fixture-based certification.
- Image asset references are rewritten and packaged for Moodle; broader media types and media lifecycle operations are not implemented.
- The compiler creates collision-safe page filenames but does not yet validate authored internal links.
- The validation report is text-only and minimal.
- Original `.workpath.json` and `.uoclearn.json` migration exists; `.workpath.zip` media migration does not.
- Built-in typed widget definitions exist, but external YAML widget-pack discovery and validation are not implemented yet.
- No Moodle compatibility suite has been run against the institutional environment.
- CORS currently permits the fixed Vite development origin only.
- There is no installer, tray process or controlled shutdown UI. The included launcher provides automatic port discovery and terminal-based shutdown.
- There is no application authentication because the service is localhost-only.

## Recommended next implementation sequence

### Milestone 1 — durable local projects

1. Add explicit project close, duplicate, rename, archive and delete operations.
2. Add a user-facing backup recovery browser.
3. Split topic documents or add topic-level API operations.
4. Add interactive revision-conflict recovery.
5. Add recovery for interrupted temporary writes.

### Milestone 2 — asset pipeline

1. Add streamed multipart upload.
2. Validate filename, size and media type.
3. Store originals under generated asset IDs.
4. Generate thumbnails in a worker/background process.
5. Add asset usage tracking and safe deletion.
6. Compile and validate relative Moodle asset references.

### Milestone 3 — widget foundation

1. Port and tighten the YAML widget schema.
2. Add definition versioning.
3. Build a pure widget-to-Moodle-HTML renderer.
4. Add sanitisation and static fallbacks.
5. Build widget picker and editors outside the main app component.
6. Add fixtures for every supported widget.

### Milestone 4 — legacy migration

1. Import `.workpath.json`.
2. Import `.workpath.zip` with assets.
3. Map legacy Process/Knowledge groups to chapters with their learning objects preserved as subchapters.
4. Preserve unknown widgets as explicit migration placeholders.
5. Produce a migration report.

### Milestone 5 — Moodle certification

1. Define the supported Moodle version matrix.
2. Generate compatibility fixture books.
3. Test import, links, images, widgets, print and mobile behaviour.
4. Record sanitisation differences.
5. Make the compiler fail closed for unsupported output.

### Milestone 6 — local application distribution

1. Add a small launcher or desktop shell only after the server/browser workflow is stable.
2. Add controlled start, browser open, port selection and shutdown.
3. Decide whether Tauri is required or a signed local launcher is sufficient.
4. Add installers, signing and institutional deployment documentation.

## Definition of a useful first release

The first releasable local version should allow an author to:

- Install or launch WorkPath on an approved computer.
- Create, open, autosave and back up a local project.
- Build multiple chapters with optional subchapters.
- Add the agreed initial widget set.
- Upload and preview large media without embedding it in JSON.
- Import a project from the previous WorkPath format.
- Validate the entire book.
- Export a Moodle Book ZIP.
- Import that ZIP into the supported Moodle version with working structure, images, links, styling and accessible widget fallbacks.

## Handover checklist for the next workspace

1. Open `/home/dragon_code/projects/WorkPath Author Local` as the workspace root.
2. Read this file and `README.md`.
3. Run `npm install` if dependencies are unavailable.
4. Run `npm run typecheck` and `npm test`.
5. Run `npm run dev` and open `http://127.0.0.1:4173`.
6. Create a test project and export a Moodle ZIP.
7. Check `git status` and preserve any existing local work before editing.
8. Start with Milestone 1 or agree on a different milestone before adding widgets.

## Last verified state

Last verified on 13 July 2026:

- TypeScript checks across all workspaces.
- All 30 core and server tests, including missing-image Moodle export, the complete block registry, HTML/video safety, nested gallery media, visible alt-text fallback, imported placeholder assignment, Excel template, namespaced workflow compatibility, page round-trip and whole-book export/import coverage.
- Core, web and server production builds.

The production build reports a Vite size warning for the lazy-loaded TinyMCE editor chunk. This is a performance warning, not a build failure. Normal development starts with `npm run dev`.
