# Brief gap plan

Closes the gaps between the current Monocle build and the Brief spec and prototype (`~/Desktop/brief`). Compared 2026-11-11.

## Status

G0 to G7 are built on `feature/ui-improvements`. `src/plan.test.tsx` has one test per plan item, run against the whole app. G8 (signing and notarisation) stays blocked on Apple credentials.

## Decisions

1. **Keep the current search.** The `⌘P` filename filter in the sidebar stays. The spec's `⌘K` overlay (5.12) is not built.
2. **Keep the current visuals.** Tailwind, the theme, page tint, the appearance menu, current fonts and the 40px toolbar stay. The prototype is a behavioural reference only. New UI is built from the existing tokens. Spec rule 12.3 (match the prototype's colours and spacing) does not apply.
3. **Appearance moves into Settings.** The titlebar appearance button and popover go. Theme, Page tint and Page width become an Appearance section in the `⌘,` Settings modal, beside Files. This extends spec 5.13 (one page) and is recorded there. The prototype's modal already has Files, Editor and Appearance in its nav.
4. Keep the current stack (plugin-fs, `tiptap-markdown`, Tailwind). Add Rust only for `write`, `trash`, `watch`, `save_asset`, `create_dir`.
5. Open: product name, Mermaid (defer past v1).

## Consequences of keeping search

1. Scenarios 4 (audit `claude` files with token total), 8 (`⌘K` then Enter to go back) and 9 (reach global files from a project) are not met by search.
2. Search does not match headings, include hidden files by default, or show tokens.
3. Possible light fixes, only if wanted: make `⌘P` list recent files when empty, and show tokens next to results.

## Gaps and work

| Area | Gap | Work |
|---|---|---|
| Layout | No right panel, status bar, breadcrumb, view switch or copy menu. No pane toggles | Three-pane shell in current styling. `⌘\`, `⌥⌘\`. Right pane resize 220-460, left 200-440 |
| Root | Starts empty. Root button at top. Root change closes the note | Open on home. Root button and menu at the bottom (Go up to, Recent x4, Choose). Keep the open file on root change |
| Tree | Folders first. No merged rows, folder page or right-click menu. Arrow opens notes. Expansion not saved | Files first. Merge single-child chains. Arrow vs name split. Dots and right-click menus. Per-root expansion. `F2`, `⌘⌫` |
| Folder page, breadcrumb | Missing | New components |
| New and delete | `Untitled.md`, permanent delete, no folders | `untitled.md`, inline rename, New folder, Move to Trash (Rust), count prompt for folders |
| Editor | Rich only. HTML escaped. Frontmatter unverified | Source and split views (CodeMirror 6). Properties block. Unknown syntax kept as a plain block |
| Editing | No selection toolbar, no image paste | Floating toolbar. Trim slash menu to Table, Task list, Code block. Paste or drop to `assets/` |
| Saving | Plain `writeTextFile`, byte-identity untested | Atomic write (Rust). Test A and Test B on real agent files |
| Tokens, right panel | None | chars / 3.5 constant. Outline with section tokens, Checks, Context |
| Changes | None | `watch`, dot, notice, Changes tab, Keep and Revert |
| Settings, copy | Hidden toggle in folder menu. Appearance in a titlebar popover. No copy menu | `⌘,` modal with two sections: Files (hidden toggle, start-folder note) and Appearance (Theme, Page tint, Page width, moved from `AppearanceMenu`). Remove the titlebar button. Copy path, full contents, current section |

## Milestones

One branch per milestone. Estimates in days.

1. **G0 Decisions** (0.5). Name, Mermaid, confirm the stack.
2. **G1 Shell** (2). Three panes, top bar, status bar frame, toggles, shortcuts, resize ranges. Current visuals.
3. **G2 Root and tree** (4). Root, menu, sort, merged rows, menus, folder page, breadcrumb, persistence, hidden toggle moved to Settings.
4. **G3 Editor and fidelity** (4). Source and split views, frontmatter, HTML passthrough, atomic write, Tests A and B.
5. **G4 Editing** (3). Selection toolbar, slash menu, image paste, tables and tasks checked.
6. **G5 Tokens and right panel** (4). Outline, Checks, Context, status bar numbers.
7. **G6 Changes** (3). Watch, dot, Changes tab, Keep and Revert.
8. **G7 Remaining** (3). Trash, New folder, copy menu, Settings modal with Files and Appearance sections, `F2`, `⌘⌫`.
9. **G8 Ship**. Blocked on Apple credentials.

Total about 23.5 days, plus G8.

## Done when

Spec sections 5 and 13 pass by hand, except 5.12 and scenarios 4, 8 and 9.
