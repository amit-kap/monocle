# Start here

This folder checks that Monocle's editor is finished. Open each note, try the actions below, and tick them off.

Add this folder as a Place (the sidebar's **Add place…**) to open it.

## The notes

1. *01 Headings and text*: headings 1–6, paragraphs, hard break, divider
2. *02 Inline formatting*: bold, italic, strike, code, escapes
3. *03 Lists and tasks*: bullets, numbers, tasks, nesting
4. *04 Quotes*: quotes, nested quotes, a list inside a quote
5. *05 Code blocks*: languages, highlighting, the language picker
6. *06 Tables*: alignment, inline marks, the column and row grips
7. *07 Links and images*: links, autolinks, local and missing images
8. *08 Footnotes*: references, definitions, jump on click
9. *09 HTML and escapes*: raw HTML kept, never rendered
10. *10 Frontmatter*: the Properties block
11. *11 Everything*: all of it in one note

## Fidelity

- [ ] Open every note and close it without typing: `git status` shows no change in `demo/`.
- [ ] Change one word in a note: the diff touches only that line.

## Selection toolbar

Select some text to see it.

- [ ] Bold, italic, strikethrough and inline code toggle on and off, and the pressed ones show filled.
- [ ] Link: add one, edit it, and clear it (empty the field and press Enter).
- [ ] Turn into: Text, Heading 1–6, bullet, `numbered and task` list, quote, code block.
- [ ] Clear formatting removes every mark from the selection.

## Block handle

Hover a block and use the ⋮⋮ handle to its left.

- [ ] The handle sits level with the block's first line.
- [ ] Drag a block up and down, including into and out of a list; the drop line stays inside the note.
- [ ] Menu: turn into [each type, duplicate, move up a](Https://amitkap.com)nd down, delete.

## Slash menu

Type `/` at the start of an empty line.

- [ ] Every block type is listed: Text, Heading 1–6, lists, quote, code, table, image, divider, footnote.
- [ ] Typing filters the list (`/h3`, `/todo`, `/img`); ↑ ↓ and Enter pick an item.

## Markdown shortcuts

- [ ] `#`–`######` then space make headings; `-`, `1.`, `1)`, `[ ]`, `>`, ```` ``` ```` and `---` make their blocks.
- [ ] `**x**`, `*x*`, `~~x~~` and `` `x` `` become marks as you type.

## Tables

- [ ] Column grip: insert left and right, align left, center and right, delete the column.
- [ ] Row grip: insert above and below, delete the row.
- [ ] The + strips add a column at the right and a row at the bottom.
- [ ] Alignment shows in the file as `:---`, `:---:` and `---:`.
- [ ] Tab and Shift-Tab move between cells; Tab in the last cell adds a row.

## Images and footnotes

- [ ] `/image` picks a file and saves it into `assets/` next to the note.
- [ ] Pasting or dropping an image does the same.
- [ ] `/footnote` adds the next number and puts the caret in its note.

## Title

- [ ] Renaming the note in its title updates its row in the sidebar as you type, and renames the file when you press Enter or click away.
