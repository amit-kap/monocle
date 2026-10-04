# Monocle — Backlog

Tracks known issues, limitations, and deferred work. Add new items here as they
come up. Keep entries short: `- [ ] **Title** — what/why. (area)`.
Remove items once they're done; git history is the record.

## Open issues

Sorted by difficulty, easiest first.

### Easy

- [ ] **IPC fallback warning** — `IPC custom protocol failed … postMessage` is
  logged by Tauri itself, not our code. Harmless; look into it only if IPC
  misbehaves. (cleanup)

### Medium

- [ ] **Code blocks not styled as code** — code blocks don't render in a mono
  font and have no syntax highlighting. The mono font renders in the Chromium
  dev preview, so check the Tauri (WebKit) build specifically. Needs a lowlight-based code block
  extension, a highlight theme for light/dark, and a check that the language
  survives markdown round-trip. (editor)
  *Round-trip fixtures now confirm the language attribute does survive
  (`` ```ts `` in, `` ```ts `` out), so highlighting has what it needs.*

### Hard

- [ ] **Audit all markdown components** — the round-trip fixtures in
  `src/editor/markdownRoundTrip.test.ts` now cover every node and mark and pin
  the remaining gaps. Confirmed losses, worst first:
  - **Images are deleted from the file.** `![alt](img.png)` loads as an empty
    document; there is no Image extension. Real content loss.
  - **Tables are flattened to bare text.** `| a | b |` loads as the paragraph
    `ab`. Real content loss. Needs a table extension.
  - **Task lists loosen on every save.** `- [ ] a` / `- [x] b` round-trips
    with a blank line inserted between the items, so the list becomes loose and
    every save churns the diff.
  - **Raw HTML is escaped, not parsed.** `<div>x</div>` becomes
    `&lt;div&gt;x&lt;/div&gt;` and `<u>x</u>` likewise; markdown has no
    underline syntax. Underline is disabled in the editor for the same reason.
  (editor)
- [ ] **Drag handles on nested items** — only top-level blocks are draggable, so
  a whole list moves as one; every block, including individual list items,
  should get its own handle and be draggable. Needs hover detection, drop
  targets, and move logic rewritten for nested positions. (editor)

## Feature requests

- [ ] **Wider / adjustable content column** — the center column in the main viewer
  feels narrow; make it wider and/or let the user control its width. (UI)

## Deferred features

- [ ] Autosave (currently explicit `⌘S` only).
- [ ] External file-change watching (e.g. `notify`).
- [ ] Multiple windows / tabs.
- [ ] Inline image upload.
- [ ] Tables, databases, kanban, embeds.
- [ ] Wiki-style `[[links]]` and backlinks.
- [ ] Code signing & notarization (not distributing yet).
- [ ] Windows / Linux builds.
