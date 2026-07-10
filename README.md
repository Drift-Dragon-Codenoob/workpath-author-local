# WorkPath Author Local

A local-first rebuild of WorkPath Author. A Node service owns project files, media and Moodle compilation; a React browser interface is the editing client.

This is a new architectural direction, not a desktop wrapper around the previous browser application. The editable source lives on disk, processing belongs outside React, and the primary release artifact is a Moodle Book chapter-import ZIP.

## Run

```bash
npm install
npm run dev
```

Open `http://127.0.0.1:4173`. The API runs on `http://127.0.0.1:4174`.

Projects are stored outside the source tree. The project screen can also import original `.workpath.json` and `.uoclearn.json` files. The default storage location is:

```text
~/WorkPath Projects/
```

Override it with `WORKPATH_PROJECTS_DIR`.

## Product contract

- A WorkPath **chapter** contains blocks and compiles to a normal Moodle Book chapter.
- A chapter may optionally contain WorkPath **subchapters**, compiled as `_sub.html` files.
- The compiler produces the HTML/media ZIP accepted by Moodle Book's **Import chapter** tool.
- The editable project remains local and separate from the Moodle delivery ZIP.

See [DEVELOPERS.md](./DEVELOPERS.md) for the architecture and rebuild roadmap.

## Current maturity

The repository is a working early rebuild, not yet a complete replacement for the original application. Project storage, revision-safe saving, original JSON migration, top-down block authoring, TinyMCE rich text, image upload, dynamic tables, a separate Moodle preview and Moodle compilation work. Media ZIP migration, external YAML widget packs, autosave and institutional Moodle compatibility testing are the next major milestones.

## Excel storyboards

Use **Excel template** in the top banner to download the validated `.xlsx` template. A workbook represents one chapter or one subchapter. Import it with **Import chapter** at Book level or **Import Excel** beneath a chapter. WorkPath verifies exact block names, ordering, Markdown content, Settings JSON and required fields before enabling creation.

Existing chapters and subchapters can be exported to Excel or CSV from their page header. The Mapping column is author-only metadata and is never included in learner preview or Moodle output. Image rows preserve prompt, alternative text, caption and settings metadata; upload the actual image after import.
