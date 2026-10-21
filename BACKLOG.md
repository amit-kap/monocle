# Monocle — Backlog

Tracks known issues, limitations, and deferred work. Add new items here as they
come up. Keep entries short: `- [ ] **Title** — what/why. (area)`.
Remove items once they're done; git history is the record, and `plan.md` holds
the reasoning behind the decisions.

## Open issues

- [ ] **Spell-check underlines never appear** — `spellcheck="true"` sits on the
  editor element, but WKWebView does not run the macOS checker inside a
  contenteditable, so a misspelling gets no underline. The shortcut is closed:
  setting `continuousSpellCheckingEnabled` on the web view through KVC raises an
  "not key value coding-compliant" exception and aborts the app at launch (tried
  in v0.4.2, reverted). What's left is a decoration built on a JS spell checker,
  or reaching the checker through WebKit's private content view. (editor/app)

## Feature requests

Ordered by effort, smallest first. `(area)` is the code the work lands in.

### Medium

- [ ] **Notion-style code blocks** — syntax highlighting already ships (lowlight
  with the common grammars, colours from our theme tokens); what is missing is a
  searchable language picker in the block's corner that reads and writes the
  fence's info string (```` ```js ````). (editor)
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
- [ ] **Collapsible items** — fold a block's children away: a toggle beside
  headings and list items that have nested content, and the folded state
  remembered per note. Markdown has nowhere to keep that state, so it has to live
  outside the file (per-note UI state) or in an HTML comment. (editor)

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
