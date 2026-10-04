# Monocle — Backlog

Tracks known issues, limitations, and deferred work. Add new items here as they
come up. Keep entries short: `- [ ] **Title** — what/why. (area)`.
Remove items once they're done; git history is the record.

## Open issues

Sorted by difficulty, easiest first.

### Needs a manual check

- [ ] **Confirm images actually paint** — implemented, but not verified in the
  running app. Notes now resolve their relative image paths against the note's
  own folder and serve them through Tauri's asset protocol, leaving the markdown
  untouched. Verified by unit tests: path resolution, the DOM rewrite, that the
  document is never mutated, and that the rewrite re-resolves after switching
  notes; the Rust side compiles and the config is valid. *Not* verified: the
  pixels. This machine has no screen-recording or accessibility permission, so I
  could not look at a window. Open a note with a local image and confirm it
  shows. (editor)

  Known limits, for whoever checks: the asset scope is `$HOME/**` and
  `/Volumes/**`, so a folder outside those round-trips its markdown but will not
  display its images. `https:` and `data:` sources always display. A failed load
  still shows the browser's broken-image glyph; styling that needs an `error`
  listener. (editor)

### Hard

- [ ] **Raw HTML is escaped, not parsed** — `<div>x</div>` becomes
  `&lt;div&gt;x&lt;/div&gt;`, and `<u>x</u>` likewise. This is deliberate, not an
  oversight: markdown has no underline syntax, and accepting raw HTML would let
  a note inject arbitrary markup and CSS into the app. Underline is disabled in
  the editor for the same reason — while it was live, ⌘U deleted the words around
  it on save. Revisit only alongside a sanitiser and a CSP; do not just flip
  `html: true`. (editor)

## Feature requests

- [ ] Autosave (currently explicit `⌘S` only).
- [ ] External file-change watching (e.g. `notify`).
- [ ] Multiple windows / tabs.
- [ ] Inserting images into a note (picking a file, drag-drop, paste).
  *Displaying* existing images is separate and now implemented.
- [ ] Databases, kanban, embeds. (Tables are supported; see `plan.md`.)
- [ ] Wiki-style `[[links]]` and backlinks.
- [ ] Code signing & notarization (not distributing yet).
- [ ] Windows / Linux builds.

## Closed

Recently finished, kept here until the next release so the reasoning survives.

- **Markdown round-trip fixtures** — 100+ fixtures in
  `src/editor/markdownRoundTrip.test.ts` covering every node and mark, with
  exact-output, idempotency and word-integrity assertions.
- **Words welded together across soft line breaks** — a wrapped line ending in
  an inline mark lost the only space between two words, and the damage was saved
  to disk. Fixed in `SoftBreakSpace`.
- **⌘U deleted text** — StarterKit's underline mark cannot be serialized, so the
  mark and the spaces around it were dropped on save. Mark disabled.
- **Images deleted from files** — `![alt](img.png)` was dropped on load. Fixed
  by registering the Image extension *inline*.
- **Tables flattened to `ab`** — no table extension was registered. Fixed, along
  with two serializer defects it exposed: bare pipes split one cell into two,
  and column alignment was parsed but never written back.
- **Task lists loosened on every save** — `tightLists` never reached
  prosemirror-markdown and `taskList` was missing from `MarkdownTightLists`.
  Fixed by `TaskListTight`.
- **Code blocks not highlighted** — lowlight with a CSS-variable theme for
  light and dark.
- **Narrow content column** — resizable, persisted, default 860px.
- **Drag handles on nested items** — every list item at any depth is its own
  draggable block.
- **IPC fallback warning** — verified not to occur. The message comes from
  Tauri's own `scripts/ipc-protocol.js`, which warns that the custom-protocol IPC
  failed and is falling back to `postMessage`; it is a `console.warn` and IPC
  keeps working. A full `tauri dev` run produces zero occurrences, so the entry
  was stale. Nothing to fix.