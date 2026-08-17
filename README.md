# WorkPath Author Local

[![CI](https://github.com/Drift-Dragon-Codenoob/workpath-author-local/actions/workflows/ci.yml/badge.svg)](https://github.com/Drift-Dragon-Codenoob/workpath-author-local/actions/workflows/ci.yml)
![Project status: alpha](https://img.shields.io/badge/status-alpha-orange)

WorkPath Author Local is a local-first visual authoring application for creating accessible Moodle Books. A Node service owns project files, media and Moodle compilation; a React browser interface provides structured block editing, preview and project management.

The editable source remains on the author's computer, while Moodle ZIP files and Excel workbooks are explicit export formats. The portable Windows build includes its own runtime and does not require Node.js to be installed system-wide.

> **Alpha software:** use WorkPath with review and backups. Moodle policies vary between institutions, and the portable executable is not currently code-signed.

## Run

Development requirements: Node.js 24 and npm 11.

```bash
npm install
npm run dev
```

Open `http://127.0.0.1:4173`. The API runs on `http://127.0.0.1:4174`.

Projects are stored outside the source tree. The project screen can also import Moodle Book `.zip`/`.mbz` packages, whole-book Excel workbooks, and original `.workpath.json`/`.uoclearn.json` files. The default storage location is:

```text
~/WorkPath Projects/
```

Each project appears on the project screen with a delete control. Deletion requires confirmation and permanently removes that project's saved content, assets and generated exports from this folder.

Override it with `WORKPATH_PROJECTS_DIR`.

### Shared local launcher

The launcher resolves the repository from its own file location, so the folder can be moved or shared without editing paths.

For a Windows pilot handover, create and send the complete portable release ZIP with `npm run release:windows`. It includes the Windows Node.js runtime, the compiled application and all runtime dependencies. The recipient does not install Node.js, npm or packages and does not need internet access to launch WorkPath. See [PILOT_GUIDE.md](./PILOT_GUIDE.md).

- On Windows, extract the portable ZIP and double-click **Run WorkPath.cmd**. The launcher prefers the included runtime, including when opened through a `\\wsl.localhost` path.
- In WSL or Linux, run `./run-workpath.sh`.
- On any supported environment, run `node run-workpath.mjs` or `npm run launch`.

Portable Windows releases start the precompiled app directly. Source checkouts retain the developer launcher, which verifies Node/npm, installs missing dependencies and builds before starting. Both choose an available port from `4174` to `4199` and open the browser.

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

The repository is a working alpha. Project storage, revision-safe autosaving and backups, legacy JSON migration, top-down block authoring, reusable project block templates, rich text, image upload, structured Excel exchange, Moodle preview and Moodle compilation work. Media ZIP migration, external YAML widget packs and broader institutional Moodle compatibility testing remain future work.

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

Use **Export Excel Book** in the top banner to save the entire editable book as one `.xlsx` file. Each chapter and subchapter receives its own titled worksheet in book order. The workbook also includes **Block Templates**, preserving reusable blocks for re-import, plus the standard **Instructions** and **Block Types** sheets. Disabled chapters are included because this export represents editable source, while **Export Moodle Book** includes only enabled chapters.

Use **Import Excel Book** on the project selection screen to create a new local project from a whole-book workbook. WorkPath validates every chapter worksheet before creating anything. Current exports include a **Book Structure** sheet that preserves chapter/subchapter hierarchy, order, enabled state, summaries, project title and unit code. Older multi-sheet workbooks without this metadata can still be imported, with each content sheet treated as a top-level chapter.

WorkPath also accepts the namespace-prefixed `.xlsx` packages produced by the established GPTWork workbook workflow. If normal ExcelJS loading fails, the server repairs that package structure in memory before applying the same strict sheet and content validation. The source file is never modified.

## Moodle ZIP and MBZ import

Use **Import Moodle ZIP / MBZ** on the home screen to recover a Moodle Book chapter-import ZIP or a ZIP/TGZ-based Moodle backup. WorkPath creates a new local project, reconstructs the chapter/subchapter hierarchy, copies packaged assets into the project, and rewrites their links for local preview and later Moodle export.

New WorkPath Moodle exports include a `workpath-source.json` manifest inside the ZIP. Re-importing one restores the exact editable blocks, project templates, theme, unit code and asset identities. The Moodle HTML remains the learner-facing delivery format.

For older ZIP/MBZ files without that manifest, WorkPath recognises its exported `workpath-*` HTML classes and reconstructs the corresponding structured blocks in page order. Ordinary or unrecognised HTML is retained in smaller rich-text blocks between them, rather than flattening the whole page. Imported executable markup is removed. The upload limit is 250 MB compressed and 500 MB after expansion.

## Authoring workflow

1. Create, open or import a project from the project screen.
2. Add chapters and optional subchapters from the structure sidebar.
3. Add and arrange rich text or structured blocks. Use the plus controls between blocks to insert at a specific position, and optionally save useful blocks as project templates.
4. Use **Preview** to inspect the learner-facing book structure.
5. Use **Export Excel Book** for a structured whole-book handover or **Export Moodle Book** for the Moodle chapter-import ZIP.

Projects autosave locally after editing. **Close project** saves and returns to the home menu so another project can be opened. Preview, project navigation and exports wait for a successful save, while each save retains rolling JSON backups alongside the locally stored assets. The Save button remains available for an immediate save.

## Security and privacy

- The service binds to `127.0.0.1` and is intended for one user on one computer. Do not expose it directly to a network or the public internet.
- Projects and uploaded assets stay in the local `WorkPath Projects` folder unless the author explicitly exports or copies them.
- Treat imported Moodle, Excel and legacy project files as untrusted. WorkPath applies file-count, size, path and executable-markup controls, but security reports are still welcome.
- See [SECURITY.md](./SECURITY.md) for responsible disclosure instructions.

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for development setup, checks and contribution expectations. Public release criteria are tracked in [PUBLIC_RELEASE_CHECKLIST.md](./PUBLIC_RELEASE_CHECKLIST.md).

## Licence

Copyright © 2026 David Last.

WorkPath Author Local is free software licensed under the [GNU General Public License v3.0 or later](./LICENSE). You may use, study, modify and redistribute it under those terms. Distributed modified versions must preserve the licence and make their corresponding source available.

GPL permissions already granted for a published version cannot be withdrawn. The copyright holder may separately license original WorkPath code under other terms, but contributed code and GPL dependencies cannot be included in a proprietary edition without the necessary additional permissions.

Bundled dependencies retain their own licences—see [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md).
