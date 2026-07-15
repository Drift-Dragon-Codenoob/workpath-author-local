# WorkPath Excel Workbook Contract

This document defines the `.xlsx` formats accepted and produced by WorkPath Author Local. Use it when creating workbooks manually, generating them in GPTWork, or diagnosing an import failure.

## Import entry points

WorkPath supports two spreadsheet workflows:

| Workflow | UI entry point | Result |
|---|---|---|
| Chapter or subchapter | **Import chapter** or **Import Excel** inside an open project | Adds one page to the current project |
| Whole book | **Import Excel Book** on the project selection screen | Creates and opens a new local project |

Imports are validated before project data is changed. A whole-book import is all-or-nothing: WorkPath creates no project when any content sheet has a blocking error.

## Chapter workbook

Download the current chapter template with **Excel template** in the application header. It contains exactly three worksheets:

1. `Storyboard`
2. `Instructions`
3. `Block Types`

`Storyboard` represents one chapter or one subchapter.

### Storyboard columns

The first row must contain these exact headings:

| Column | Heading | Rule |
|---|---|---|
| A | `Topic` | Put the page title in the first populated content row. Later blank cells inherit it. A different non-blank title is an error. |
| B | `Block order` | Unique positive whole number within the worksheet. |
| C | `Block type` | Exact name from the `Block Types` dropdown. Names are case-sensitive. |
| D | `Content` | Markdown or human-readable content following the guidance for that block type. |
| E | `Mapping` | Optional author-only curriculum or requirements mapping. Never exported to learners or Moodle. |
| F | `Settings JSON` | Optional structured block data. When present, it is authoritative. |
| G | `Validation notes` | Formula-driven guidance. Do not use this column as authored content. |

Do not rename or reorder the first six headings. Additional formatting and formulas are ignored as long as the required data remains readable.

## Whole-book workbook

A whole-book workbook contains:

- one Storyboard-shaped worksheet per chapter or subchapter;
- `Book Structure`;
- `Instructions`; and
- `Block Types`.

Every content worksheet uses the seven Storyboard columns defined above. Its first `Topic` value should match the page `Title` in `Book Structure`.

### Book Structure columns

The first row must contain these exact headings:

| Column | Heading | Rule |
|---|---|---|
| A | `Project title` | New WorkPath project title. Repeat it on each row. The first data row is authoritative. |
| B | `Unit code` | Optional unit or subject code. Repeat it on each row. |
| C | `Worksheet` | Exact name of the page's content worksheet. |
| D | `Page type` | Exactly `chapter` or `subchapter`. |
| E | `Parent worksheet` | Blank for chapters. For a subchapter, the exact worksheet name of its parent chapter. |
| F | `Order` | Positive whole number within the relevant level. |
| G | `Enabled` | `TRUE` or `FALSE`. Disabled chapters remain editable but are omitted from Moodle export. |
| H | `Title` | Learner-facing chapter or subchapter title. |
| I | `Summary` | Optional learner-facing page purpose or introduction. |

Worksheet names must:

- be unique, including reference-sheet names;
- be no longer than 31 characters;
- exclude `\`, `/`, `?`, `*`, `[`, `]`, and `:`; and
- match `Worksheet` and `Parent worksheet` values exactly.

The names `Book Structure`, `Instructions`, and `Block Types` are reserved.

If `Book Structure` is absent, WorkPath treats every non-reference worksheet as a top-level chapter. This compatibility behavior cannot reconstruct subchapter relationships, summaries, enabled state, project title, or unit code.

### Example hierarchy

| Project title | Unit code | Worksheet | Page type | Parent worksheet | Order | Enabled | Title | Summary |
|---|---|---|---|---|---:|---|---|---|
| Example Book | UNIT001 | Getting started | chapter | | 1 | TRUE | Getting started | Introduces the unit. |
| Example Book | UNIT001 | Understanding the task | subchapter | Getting started | 1 | TRUE | Understanding the task | Reviews the workplace task. |
| Example Book | UNIT001 | Planning the work | chapter | | 2 | TRUE | Planning the work | Develops the work plan. |

## Supported block names

The following 21 names are accepted in `Block type`:

| Category | Exact block name |
|---|---|
| Text | `Rich text` |
| Content | `Note / callout` |
| Interactive | `Accordion` |
| Interactive | `Checklist` |
| Content | `Quote` |
| Media | `Image` |
| Media | `Image + text` |
| Data | `Table` |
| Layout | `Card grid` |
| Layout | `Responsive columns` |
| Resources | `Resource link card` |
| Content | `Styled list group` |
| Resources | `Code snippet` |
| Knowledge check | `True or false` |
| Knowledge check | `Single-answer knowledge check` |
| Knowledge check | `Multiple-answer knowledge check` |
| Interactive | `Flip cards` |
| Interactive | `Hotspot image` |
| Advanced | `Custom HTML` |
| Media | `Image gallery / carousel` |
| Media | `Video embed` |

Always use the template's `Block Types` worksheet as the live list. The application generates its dropdown range from this registry rather than a hard-coded final row.

## Content conventions

These original block types can be created from readable `Content` without `Settings JSON`:

### Rich text

Use Markdown headings, paragraphs, emphasis, numbered lists, and bullet lists.

```text
## Heading

A paragraph with **bold** and *emphasised* text.

- first item
- second item
```

### Note / callout

The first bold segment becomes the title. Remaining Markdown becomes the body.

```text
**Important reminder**

Add the learner-facing reminder here.
```

### Accordion

Use repeated bold headings followed by each section body.

```text
**First section**

First section content.

**Second section**

Second section content.
```

### Checklist

Use an optional title followed by a Markdown bullet list.

```text
Preparation checklist

- confirm the scope
- identify stakeholders
- record evidence
```

### Quote

Enter the quote followed by an attribution beginning with `-` or `—`.

```text
The quotation text.
— Person or source
```

### Image

```text
**Suggested image:** Description for the future image.

**Alternative text:** Meaningful equivalent text.

**Caption:** Optional visible caption.
```

### Image + text

```text
**Heading**

Supporting body content.

**Suggested image:** Description for the future image.

**Alternative text:** Meaningful equivalent text.
```

### Table

Use an optional caption followed by a Markdown table.

```text
Comparison table

| Option | Benefit | Limitation |
|---|---|---|
| A | Fast | Expensive |
| B | Simple | Limited |
```

## Settings JSON

Newer nested blocks cannot be represented reliably in one `Content` cell. Use `Settings JSON` for lossless creation and round trips:

```json
{
  "definitionVersion": "1.0.0",
  "params": {
    "property": "value"
  }
}
```

Rules:

- The JSON must contain an object.
- `params` must match the selected block's parameter structure.
- `definitionVersion` is optional for hand-authored workbooks but retained by exports.
- When `Settings JSON` exists, it takes precedence over inferred `Content` values.
- The safest method is to create a representative block in WorkPath, export it, and preserve the generated JSON structure.
- Do not invent project-local asset IDs.

WorkPath exports every structured block with exact `Settings JSON`, including newer block types. This makes chapter and whole-book exports suitable as generation templates.

A flip card uses an image-only front and a rich-text back. Its structured shape is:

```json
{
  "definitionVersion": "2.0.0",
  "params": {
    "cards": [
      {
        "imageAssetId": "",
        "altText": "Describe the intended front image",
        "backTitle": "Card heading",
        "backBody": "<p>Text revealed when the card flips.</p>"
      }
    ]
  }
}
```

Leave `imageAssetId` empty in a workbook and select or upload the image after import. Alternative text remains visible as the fallback until then.

## Images

Spreadsheet workbooks do not embed WorkPath project assets. Export recursively clears every setting whose name ends in `AssetId`.

After whole-book import, image display follows this order:

1. display the uploaded image when an asset exists;
2. otherwise display non-empty alternative text visibly on a white image substitute; or
3. when both image and alternative text are absent, assign the project's shared `Placeholder image` asset.

This applies to Image, Image + text, Hotspot image, and Image gallery/carousel. Optional Card grid images remain empty. Replace text substitutes and placeholders with intended images during author review.

Single-page chapter imports do not create the shared project placeholder; select images after import.

## HTML and video safety

`Custom HTML` rejects:

- `<script>` elements;
- `<iframe>` elements;
- inline event handlers such as `onclick`;
- `javascript:` URLs.

Use `Video embed` instead of Custom HTML for video. Supported provider URLs include approved YouTube, Vimeo, Microsoft Stream, and SharePoint locations. Unsupported providers produce a validation error rather than an unrestricted iframe.

## GPTWork-generated workbook compatibility

WorkPath normally loads `.xlsx` files through ExcelJS. It also supports the namespace-prefixed OOXML packages produced by the established GPTWork workflow.

When standard loading fails, the server normalizes that package in memory by repairing workbook content types and relationship targets, removing the `x:` namespace prefix, and discarding decorative table package metadata that ExcelJS cannot model. The uploaded file is never changed. Normal Storyboard and Book Structure validation still applies after normalization.

The preferred generation approach remains:

1. start with a template or whole-book export produced by WorkPath;
2. preserve required sheet names and headings;
3. duplicate Storyboard-shaped content sheets as needed;
4. populate `Book Structure` with exact worksheet references;
5. preserve generated `Settings JSON` for structured blocks; and
6. import through **Import Excel Book**.

## Validation and common failures

WorkPath rejects or reports:

- missing required headings;
- unknown or incorrectly capitalized block names;
- blank, duplicate, non-integer, or negative block orders;
- multiple different Topic titles in one content sheet;
- invalid Settings JSON;
- unsafe HTML;
- missing content when Settings JSON is also empty;
- missing worksheets referenced by Book Structure;
- invalid Page type values;
- subchapters without a valid parent chapter;
- unsupported video providers; and
- invalid structured block parameters.

Image-selection messages may be warnings during spreadsheet verification. The imported project still shows validation until required production images and accessible descriptions are complete.

## Export behavior

- **Export Excel** exports the selected page as `.xlsx`.
- **Export CSV** exports the selected page without workbook reference sheets.
- **Export Excel Book** exports every chapter and subchapter, including disabled chapters, because it is an editable-source handover.
- **Export Moodle Book** exports only enabled chapters and their subchapters.

The spreadsheet is editable source and is not itself a Moodle Book import package.
