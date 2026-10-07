# Monocle — Backlog

Tracks known issues, limitations, and deferred work. Add new items here as they
come up. Keep entries short: `- [ ] **Title** — what/why. (area)`.
Remove items once they're done; git history is the record, and `plan.md` holds
the reasoning behind the decisions.

## Open issues

### Medium

- [ ] **Failed image loads look broken** — an image whose file is missing shows
  the browser's broken-image glyph. CSS can only detect an empty `src`, not a
  failed load, so this needs an `error` listener on the image node that swaps in
  a placeholder carrying the path, so a typo'd filename is visible and fixable.
  (editor)
- [ ] **List item drag handle hidden by bullet** — while block-dragging a list
  item, its drag handle sits under the item's bullet/number marker, so it can't
  be seen. (editor)
- [ ] **Hover label missing on some blocks** — every block type should show its
  element name on the left when hovered; make sure none are left out. (editor)

## Feature requests

- [ ] **Notion-style code blocks** — code blocks already have a background and
  border; make them work like Notion's: syntax highlighting per language, plus a
  language picker in the block's corner (dropdown with search) that reads and
  writes the fence's info string (e.g. ```` ```js ````). (editor)
- [ ] Autosave (currently explicit `⌘S` only).
- [ ] External file-change watching (e.g. `notify`).
- [ ] Multiple windows / tabs.
- [ ] Inserting images into a note (picking a file, drag-drop, paste).
  *Displaying* existing images already works.
- [ ] Databases, kanban, embeds. (Tables are supported.)
- [ ] Wiki-style `[[links]]` and backlinks.
- [ ] Code signing & notarization (not distributing yet).
- [ ] Windows / Linux builds.