# Monocle

A simple macOS markdown editor with a Notion-style block editor, backed by plain
`.md` files in a folder you choose.

## Stack

Tauri v2 + React + TypeScript + Vite, with TipTap for the block editor and
Tailwind v4 for styling. File I/O goes through Tauri's `fs` and `dialog` plugins.

## Develop

```sh
npm install
npm run tauri dev
```

## Build

```sh
npm run tauri build -- --bundles app   # Monocle.app
CI=true npm run tauri build -- --bundles dmg   # Monocle_*.dmg
```

Artifacts land in `src-tauri/target/release/bundle/`.

## Features

- Open any folder and browse its `.md` files in a recursive tree; resize the
  sidebar, refresh, and search notes with ⌘P
- Create, rename, and delete notes; hover a folder to add a note inside it
- Open `.md` files from Finder via "Open With" (switches the workspace to the
  file's folder and selects it)
- Block editor: headings, bold/italic/strike/code, bullet/numbered/to-do lists,
  tables, quotes, images, code blocks, dividers, and markdown input shortcuts
  (`# `, `- `, `[] `, `> `)
- Syntax-highlighted code blocks (lowlight, common languages), with the language
  written in the fence preserved on save
- Slash (`/`) menu to insert and convert blocks
- Hover block handle: drag to reorder, or open the menu to turn into, duplicate,
  move, or delete a block. Every list item gets its own handle at any nesting
  depth, and dragging across a list boundary converts the block
- Resizable content column; drag its right edge, double-click to reset
- Local images resolve against the note's own folder and display through Tauri's
  asset protocol, without the note's markdown being rewritten
- Explicit save with ⌘S, dirty indicator, and unsaved-changes guard on switch/quit
- Light, dark, or system theme via a selector in the custom title bar

`npm test` runs 340 tests, including markdown round-trip fixtures that pin every
block type and mark so nothing is silently dropped on save.

See `plan.md` for the full design and phase breakdown.
