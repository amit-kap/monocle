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
- [ ] **Missing spaces between words** — words in text paragraphs are sometimes
  rendered joined together with no space. Cause unknown; needs a repro first
  (likely markdown parsing of soft line breaks). (editor)
- [ ] **Markdown round-trip fixtures** — tests for headings, nested lists, tasks,
  code, quotes, links are still not written. (testing)

### Hard

- [ ] **Audit all markdown components** — verify every markdown element renders
  and round-trips correctly (headings, lists, nested lists, tasks, code, quotes,
  links, inline marks, dividers, etc.). May require new extensions (tables,
  images, strikethrough) and pairs with the fixtures item. (editor)
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
