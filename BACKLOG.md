# Monocle — Backlog

Tracks known issues, limitations, and deferred work. Add new items here as they
come up. Keep entries short: `- [ ] **Title** — what/why. (area)`.
Remove items once they're done; git history is the record.

## Open issues

Nothing outstanding. Newly discovered items go below.

### Hard

_(none)_

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

- **Image rendering confirmed** — verified by hand in the installed 0.4.0 app
  against a note with images in the same folder, a subfolder, mid-sentence, an
  absolute path and a remote URL; all render, and the inline one sits on the
  text baseline. Then ⌘S, and the file on disk still held `diagram.png` and
  friends — the asset-protocol rewrite touches only the rendered element, never
  the document. Note-switching (a stale asset URL pointing at the previous
  note's folder) is covered by unit test but was not exercised by hand.
  Limits that remain, by design: the asset scope is `$HOME/**` and
  `/Volumes/**`, so a folder outside those round-trips its markdown but will not
  display its images; `https:` and `data:` always display; a failed load shows
  the browser's broken-image glyph, and styling that needs an `error` listener.

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