---
name: Monocle
status: develop
track: personal
platform: macos
interest: 
next: Fix bugs
repo: github.com/amit-kap/monocle
updated: 2026-10-29
---

# Monocle

> A simple macOS markdown editor with a Notion-style block editor over plain .md files.

## About
Open any folder and edit its markdown files in a block editor, with a file tree, search (⌘P) and plain .md files on disk, so the notes stay usable by any other tool or agent. Built with Tauri v2, React, TypeScript, TipTap and Tailwind. See README.md for development and build steps, and BACKLOG.md and plan.md for what's next.

## Decisions
- 2026-10-29: Built the appearance popover from the Paper design — one titlebar button (sliders glyph) opening Theme / Page tint / Page width, replacing the standalone 3-way theme control. Page tint is app-wide (`monocle:pageTint`), and `contentWidth` moved from `EditorPane` local state into the store so the slider and the column's drag handles drive one value. The page is a full-bleed tinted band with a tint-aware hairline, and the deep tints get a darker faint/muted ink pair so text stays above 4.5:1. The slider is the previous panel design: bone pill, 1px border, 10px dark thumb, five ticks inside the track.
- 2026-10-29: Dropped the editor's save-status label to match the frames, which have no toast and put the popover where the label used to sit. Save failures still surface in the bottom-right error toast; there is now no visible "unsaved changes" indicator, since autosave closes that window in under a second.
- 2026-10-29: Rebuilt the window shell to the frame's layout: the sidebar runs to the top edge (traffic lights over it), each column carries its own top row, and the note's title moved out of a centred titlebar into a left-aligned 40px toolbar above the page. The sidebar's search/refresh/more moved up to the window row, leaving the root folder its own row. Toolbar height is 40px rather than the frame's 36, at Amit's request.
