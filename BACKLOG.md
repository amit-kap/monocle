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

## Feature requests

- [ ] Autosave (currently explicit `⌘S` only).
- [ ] External file-change watching (e.g. `notify`).
- [ ] Multiple windows / tabs.
- [ ] Inserting images into a note (picking a file, drag-drop, paste).
  *Displaying* existing images already works.
- [ ] Databases, kanban, embeds. (Tables are supported.)
- [ ] Wiki-style `[[links]]` and backlinks.
- [ ] Code signing & notarization (not distributing yet).
- [ ] Windows / Linux builds.