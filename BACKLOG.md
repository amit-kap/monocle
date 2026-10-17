# Monocle — Backlog

Tracks known issues, limitations, and deferred work. Add new items here as they
come up. Keep entries short: `- [ ] **Title** — what/why. (area)`.
Remove items once they're done; git history is the record, and `plan.md` holds
the reasoning behind the decisions.

## Open issues

- [ ] **Sidebar resize handle is invisible until hover** — the content column
  now has a persistent hairline on both edges; give the sidebar's right-edge
  handle the same treatment (hairline at rest, accent on hover). (sidebar)
- [ ] **Arrow keys ignore focus** — the editor takes focus every time a note
  opens, and ↑/↓/←/→ act only there, so they always drive the main view even
  when the pointer (or a click) is in the sidebar. Arrows should drive whatever
  has focus: move the tree selection, ←/→ collapse and expand folders, and walk
  the ⌘P search results without leaving the box. (keyboard / sidebar)
- [ ] **Block gutter collides with the column hairline** — on hover the handle
  and its block-type label sit 26px left of the text, and the label is
  right-aligned, so a longer name ("Heading 1", "Bullet list") runs out past the
  content column's left hairline and sits on top of it. Keep the gutter inside
  the hairline, or clip the label at it. (editor pane)

## Feature requests

- [ ] **Notion-style code blocks** — code blocks already have a background and
  border; make them work like Notion's: syntax highlighting per language, plus a
  language picker in the block's corner (dropdown with search) that reads and
  writes the fence's info string (e.g. ```` ```js ````). (editor)
- [ ] **Selection text styling** — when text is selected, show a way to format
  the selection (floating toolbar / bubble menu: bold, italic, strikethrough,
  code, headings, etc.). (editor)
- [ ] **Auto numbered lists** — when a row starts with a number (`1. `, `2) `,
  etc.), auto-convert the line into a numbered list item, continuing the
  sequence. (editor)
- [ ] **Word autocomplete** — IntelliSense-style suggestions as you type
  (complete words already used in the note / vault). (editor)
- [ ] **Spell-check underlines** — flag misspelled words inline (squiggly
  underline, suggestions on right-click / hover). (editor)
- [ ] **Outline / mini map** — a slim rail down the right side of the editor
  reflecting the note's structure: a heading outline to jump between sections,
  optionally a proportional mini map of the document with a viewport indicator
  for long notes. (editor)
- [ ] Autosave (currently explicit `⌘S` only).
- [ ] External file-change watching (e.g. `notify`).
- [ ] Multiple windows / tabs.
- [ ] Inserting images into a note (picking a file, drag-drop, paste).
  *Displaying* existing images already works.
- [ ] Databases, kanban, embeds. (Tables are supported.)
- [ ] Wiki-style `[[links]]` and backlinks.
- [ ] Code signing & notarization (not distributing yet).
- [ ] Windows / Linux builds.