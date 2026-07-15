# WorkPath Author Local

A local-first rebuild of WorkPath Author. A Node service owns project files, media and Moodle compilation; a React browser interface is the editing client.

This is a new architectural direction, not a desktop wrapper around the previous browser application. The editable source lives on disk, processing belongs outside React, and the primary release artifact is a Moodle Book chapter-import ZIP.

## Run

Requirements: Node.js 24 and npm 11.

```bash
npm install
npm run dev
```

Open `http://127.0.0.1:4173`. The API runs on `http://127.0.0.1:4174`.

Projects are stored outside the source tree. The project screen can also import original `.workpath.json` and `.uoclearn.json` files. The default storage location is:

```text
~/WorkPath Projects/
```

Each project appears on the project screen with a delete control. Deletion requires confirmation and permanently removes that project's saved content, assets and generated exports from this folder.

Override it with `WORKPATH_PROJECTS_DIR`.

### Shared local launcher

The launcher resolves the repository from its own file location, so the folder can be moved or shared without editing paths.

For a pilot handover, send the complete release ZIP rather than copying an existing development folder. The recipient needs Node.js 24 with npm 11, internet access on first launch, and permission to run local PowerShell and npm commands. WorkPath verifies these versions and installs the exact dependency versions recorded in `package-lock.json`. See [PILOT_GUIDE.md](./PILOT_GUIDE.md) for recipient instructions and current packaging limitations.

- On Windows, double-click **Run WorkPath.cmd**. If the folder is under `\\wsl.localhost`, the wrapper delegates to that WSL distribution instead of running Windows npm against Linux files. Native Windows folders use Windows Node normally.
- In WSL or Linux, run `./run-workpath.sh`.
- On any supported environment, run `node run-workpath.mjs` or `npm run launch`.

The launcher requires Node.js. It installs dependencies when `node_modules` is absent, creates a production build, selects an available port from `4174` to `4199`, starts WorkPath and opens it in the appropriate Windows, WSL or Linux browser. Keep the launcher terminal open while using WorkPath; press `Ctrl+C` to stop it.

Run the complete verification suite with:

```bash
npm run typecheck
npm test
npm run build
```

## Product contract

- A WorkPath **chapter** contains blocks and compiles to a normal Moodle Book chapter.
- A chapter may optionally contain WorkPath **subchapters**, compiled as `_sub.html` files.
- The compiler produces the HTML/media ZIP accepted by Moodle Book's **Import chapter** tool.
- The editable project remains local and separate from the Moodle delivery ZIP.

See [DEVELOPERS.md](./DEVELOPERS.md) for the architecture and rebuild roadmap.

## Current maturity

The repository is a working early rebuild, not yet a complete replacement for the original application. Project storage, revision-safe saving, original JSON migration, top-down block authoring, TinyMCE rich text, image upload, a categorized block library, structured Excel exchange, Moodle preview and Moodle compilation work. Media ZIP migration, external YAML widget packs, autosave and institutional Moodle compatibility testing remain future work.

## Block library

Select **Add block** to open the searchable, categorized block library. It currently includes 21 authoring options across Text, Content, Layout, Media, Interactive, Knowledge check, Resources, Data and Advanced categories.

Alongside rich text, notes, accordions, checklists, quotes, images and tables, the expanded library includes card grids, responsive columns, resource cards, styled lists, code snippets, three knowledge-check formats, flip cards, image hotspots, custom HTML, image galleries and video embeds. Custom HTML rejects executable markup. Video embeds accept approved YouTube, Vimeo, Microsoft Stream and SharePoint URLs, with a linked fallback when embedding is unavailable.

Flip cards use an image on the front and rich text on the back. Selecting a card rotates it in 3D, while its native disclosure state keeps the interaction keyboard accessible and readable when animation is reduced. Each card requires alternative text when an image is selected; an unfinished image uses the normal visible alt-text or placeholder fallback during Moodle export.

## Excel storyboards

See [EXCEL_WORKBOOKS.md](./EXCEL_WORKBOOKS.md) for the complete chapter and whole-book `.xlsx` contract, generation rules, block names, image behavior and troubleshooting guidance.

Use **Excel template** in the top banner to download the validated `.xlsx` template. A workbook represents one chapter or one subchapter. Import it with **Import chapter** at Book level or **Import Excel** beneath a chapter. WorkPath verifies exact block names, ordering, Markdown content, Settings JSON and required fields before enabling creation.

The generated template contains three sheets:

- **Storyboard** contains the chapter rows and a dropdown containing all 21 supported block types.
- **Instructions** explains ordering, mappings, structured settings, image handling, safe HTML and whole-book behavior.
- **Block Types** lists every exact block name, its library category and its required content format or guidance.

Rich text, Note / callout, Accordion, Checklist, Quote, Image, Image + text and Table can be drafted using the documented Markdown conventions. The newer structured blocks use `Settings JSON` for lossless round trips. The easiest workflow is to create those blocks in WorkPath, export the chapter or book, and retain the generated settings while reviewing or transferring content.

Existing chapters and subchapters can be exported to Excel or CSV from their page header. The Mapping column is author-only metadata and is never included in learner preview or Moodle output. Image rows preserve prompt, alternative text, caption and settings metadata; upload the actual image after import.

Project-local image IDs are intentionally cleared in spreadsheet exports. This prevents an imported workbook from referring to files that do not exist in its new project. After whole-book import, an empty image slot displays its authored alternative text on a white image substitute. If neither an image nor alternative text exists, WorkPath assigns one shared white **Placeholder image** asset. Replace text substitutes and placeholders with the intended images during review. Optional card images remain empty unless an author selects one.

Use **Export Excel Book** in the top banner to save the entire editable book as one `.xlsx` file. Each chapter and subchapter receives its own titled worksheet in book order. Every worksheet uses the same canonical columns as chapter import, and the workbook includes the standard **Instructions** and **Block Types** sheets. Disabled chapters are included because this export represents editable source, while **Export Moodle Book** includes only enabled chapters.

Use **Import Excel Book** on the project selection screen to create a new local project from a whole-book workbook. WorkPath validates every chapter worksheet before creating anything. Current exports include a **Book Structure** sheet that preserves chapter/subchapter hierarchy, order, enabled state, summaries, project title and unit code. Older multi-sheet workbooks without this metadata can still be imported, with each content sheet treated as a top-level chapter.

WorkPath also accepts the namespace-prefixed `.xlsx` packages produced by the established GPTWork workbook workflow. If normal ExcelJS loading fails, the server repairs that package structure in memory before applying the same strict sheet and content validation. The source file is never modified.

## Authoring workflow

1. Create, open or import a project from the project screen.
2. Add chapters and optional subchapters from the structure sidebar.
3. Add and arrange rich text or structured blocks, then use **Save**.
4. Use **Preview** to inspect the learner-facing book structure.
5. Use **Export Excel Book** for a structured whole-book handover or **Export Moodle Book** for the Moodle chapter-import ZIP.

Projects are not currently autosaved. Save before leaving a project or exporting. Revision checks prevent one stale browser session from silently overwriting a newer saved revision.
