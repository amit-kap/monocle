# Monocle — Backlog

Tracks known issues, limitations, and deferred work. Add new items here as they
come up. Keep entries short: `- [ ] **Title** — what/why. (area)`.
Remove items once they're done; git history is the record, and `plan.md` holds
the reasoning behind the decisions.

## Open issues

Nothing open.

## Feature requests

Ordered by effort, smallest first. `(area)` is the code the work lands in.

### Small

- [ ] **Spell-check underlines** — misspellings are not flagged today: nothing sets
  `spellcheck` on the editor, and the title field turns it off. If the webview's
  native checker can't be switched on, this grows into a custom decoration.
  Right-click suggestions come from macOS. (editor)
- [ ] **Autosave** — debounce edits into the existing save path. Needs a decision:
  explicit `⌘S` was a locked decision, so this would change the save model.

### Medium

- [ ] **Selection text styling** — a floating toolbar over a selection: bold,
  italic, strikethrough, code, headings. (editor)
- [ ] **Outline** — a slim rail of the note's headings that jumps to a section.
  The proportional mini map is a separate, larger piece. (editor)
- [ ] **Inserting images** — pick a file (or drag-drop, or paste), copy it beside
  the note, insert a relative `![]()`. *Displaying* existing images already
  works. (editor)
- [ ] **External file-change watching** — plugin-fs ships `watch` (needs the cargo
  `watch` feature and a permission), then re-scan on outside edits while ignoring
  our own saves. (workspace)

### Large

- [ ] **Word autocomplete** — IntelliSense-style suggestions as you type, from the
  words already in the note and folder. (editor)
- [ ] **Wiki-style `[[links]]` and backlinks** — a new node, markdown round-trip
  for it, a note index, and a backlinks view. (editor)
- [ ] **Multiple windows / tabs** — the store is one module-level instance, so this
  starts with per-window state. (app)

### Blocked, or out of scope

- [ ] Code signing & notarization — needs Apple Developer credentials.
- [ ] Windows / Linux builds — a platform port plus CI.
- [ ] Databases, kanban, embeds. — outside a markdown editor's model (tables are
  supported, and anything richer would break round-trip fidelity).
