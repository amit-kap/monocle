# Monocle — a simple macOS markdown editor (Notion style)

## 1. Goal

A small, fast, native-feeling macOS app for writing markdown in a Notion-like
block editor, backed by plain `.md` files in a local folder the user picks.

**Definition of v1 done:** you can open a folder, see its markdown files in a
sidebar, create/open/rename/delete notes, write in a block editor with slash
commands and markdown shortcuts, and your edits save to disk as `.md`.
The app builds to a `.app`/`.dmg` under ~25 MB.

## Status

Phases 0–8 implemented. `Monocle.app` (4.5 MB) and `Monocle_0.1.0_aarch64.dmg`
(2.2 MB) build and launch. Notable deltas from the plan:

- TipTap **v3** (not v2) — `tiptap-markdown` requires it.
- Save is **explicit (⌘S)** per the locked decision; autosave deferred.
- Smoke + markdown round-trip tests added (`npm test`).
- Fixed: `BlockHandles` accessed `editor.view` before mount (blank window). It now
  receives the editor DOM element and guards `editor.isInitialized`; an
  `ErrorBoundary` prevents future component errors from blanking the app.
- Added missing `core:window:allow-set-title` capability.
- Sidebar upgraded from a flat list to a **recursive directory tree** (folders
  first, only `.md` files, dirs with no markdown pruned). Header now has two icon
  buttons: folder (dropdown: Change root folder… / Reveal in Finder) and plus.
  New notes are created in the selected folder (root if none). Folders are
  read-only. Search auto-expands matching branches.
- Fixed folder selection doing nothing: the fs scope `$HOME/**` did not include
  `$HOME` itself, so picking the home folder was forbidden. Scope now allows `**`
  (a local editor lets the user pick any folder); also removed the per-file
  `join` IPC call, parallelized the scan with a 32-way concurrency cap, skip
  `Library`/`node_modules`/symlinks, tolerate unreadable subdirs, and show a
  "Scanning…" state. Home (1403 dirs) scans in ~460 ms.
- Sidebar is now horizontally resizable by dragging its right edge (180–480 px,
  width persisted) and has a refresh button that re-scans the tree.
- Still open: signing/notarization and a custom icon (Phase 8).

## 2. Stack and rationale

| Concern | Choice | Why |
|---|---|---|
| Shell | **Tauri v2** | Native WKWebView, ~15 MB app, low RAM, no bundled browser |
| UI | **React 19 + TypeScript + Vite** | Fast iteration, huge editor ecosystem |
| Editor engine | **TipTap v3** (ProseMirror) | Block model, input rules, slash menus, undo, nesting out of the box |
| Markdown I/O | **tiptap-markdown** | Parse `.md` → TipTap JSON and serialize back |
| State | **Zustand** | Tiny, no boilerplate |
| Styling | **Tailwind CSS v4** (`@tailwindcss/vite`) | Fast UI work, minimal config |
| File access | **@tauri-apps/plugin-fs** + **plugin-dialog** | Do file I/O from JS; near-zero Rust |
| Rust surface | Minimal | Only plugin registration; no custom commands |

## 3. Architecture

```
React (renderer)
  ├─ Sidebar        folder tree, create/rename/delete, search, active note
  ├─ EditorPane     TipTap instance, title, save status
  ├─ SlashMenu      suggestion popup for "/" commands
  └─ BlockHandles   hover gutter: drag-to-reorder, block menu
        │
   Zustand store (workspace path, file list, active doc, save status)
        │
   lib/fs.ts  ── invoke ──▶  Tauri plugin-fs / plugin-dialog
   lib/markdown.ts  (serialize helper)
        │
   src-tauri/ (Rust)  plugin registration only
```

**Source of truth in memory:** TipTap document JSON.
**On disk:** markdown. Serialize on save, parse on load.

## 4. Project structure

```
monocle/
├── plan.md
├── package.json
├── vite.config.ts
├── tsconfig.json
├── index.html
├── src/
│   ├── main.tsx
│   ├── App.tsx
│   ├── styles.css
│   ├── types.ts
│   ├── components/
│   │   ├── Sidebar.tsx
│   │   ├── EditorPane.tsx
│   │   ├── SlashMenu.tsx
│   │   └── BlockHandles.tsx
│   ├── editor/
│   │   ├── slashItems.tsx
│   │   ├── blockUtils.ts
│   │   └── extensions/
│   │       └── SlashCommand.ts
│   ├── lib/
│   │   ├── fs.ts
│   │   └── markdown.ts
│   └── store/
│       └── useStore.ts
└── src-tauri/
    ├── Cargo.toml
    ├── tauri.conf.json
    ├── capabilities/default.json
    ├── icons/
    └── src/
        ├── main.rs
        └── lib.rs
```

## 5. Work plan

### Phase 0 — Prerequisites
- [x] Install Rust (`rustup`)
- [x] Verify `rustc -V`, `cargo -V`; Xcode CLT present
- **Done when:** toolchain checks pass.

### Phase 1 — Scaffold
- [x] `npm create tauri-app` → React + TS + Vite
- [x] Install deps; `npm run tauri dev` opens a window
- [x] App identifier `com.monocle.app`, product name "Monocle", window title + min size
- **Done when:** blank native window runs in dev and hot-reloads.

### Phase 2 — Design foundation & shell
- [x] Design tokens (colors, spacing, radii, type scale) as CSS variables
- [x] App layout: title bar, sidebar (~240px), editor pane (centered ~720px column)
- [x] Light theme first; dark theme tokens following the system
- **Done when:** shell looks like a clean Notion-style frame.

### Phase 3 — Workspace & sidebar
- [x] "Open folder" via dialog; persist last folder (localStorage)
- [x] List `.md`/`.markdown` files via plugin-fs `readDir`; sort by name
- [x] Create note, rename, delete (with confirm)
- [x] Active-note highlight; empty states ("No folder", "No notes")
- [x] New-note naming collision handling (`Untitled`, `Untitled 1`, …)
- **Done when:** full file lifecycle works against a real folder on disk.

### Phase 4 — Editor core
- [x] TipTap with StarterKit (headings, bold/italic/strike/code, lists, blockquote, code block, hr, history)
- [x] TaskList + TaskItem (checkboxes)
- [x] Placeholder extension ("Write something…")
- [x] Notion-like typography styling (headings, lists, spacing, selection, caret)
- **Done when:** typing, formatting, lists, checkboxes all feel right.

### Phase 5 — Markdown load/save
- [x] Parse `.md` → TipTap JSON on open (`tiptap-markdown`)
- [x] Serialize TipTap JSON → `.md` on save
- [x] **Explicit save** via `⌘S`; dirty indicator when the buffer differs from disk
- [x] Guard before switching notes or quitting (unsaved-changes guard)
- [ ] Round-trip test fixtures (headings, nested lists, tasks, code, quotes, links)
- **Done when:** `⌘S` writes valid markdown and edits survive reload.

### Phase 6 — Notion affordances
- [x] Input rules: `# `, `- `, `1. `, `> `, ``` ``` ``, `[] `, `---`
- [x] Slash menu: `/` opens filterable, keyboard-navigable block-type picker
- [x] Block hover gutter with drag-to-reorder
- [x] Block menu (turn into, duplicate, move up/down, delete)
- [x] Enter/Backspace behaviors at block boundaries (from StarterKit)
- **Done when:** core Notion editing gestures work smoothly.

### Phase 7 — Polish & shortcuts
- [x] Shortcuts: `⌘N` new, `⌘S` save now, `⌘P` search notes
- [x] Unsaved-changes guard on quit/switch
- [x] Dark mode following system
- [x] Window title reflects active note
- [x] Empty-note placeholder and focus-on-open
- **Done when:** app feels finished for daily writing.

### Phase 8 — Package & verify
- [x] Default Tauri icon set
- [x] `npm run tauri build` → `Monocle.app` (4.5 MB) + `.dmg` (2.2 MB)
- [x] Smoke test the packaged app against a real notes folder
- [ ] (Optional) custom icon, signing/notarization notes
- **Done when:** installable app runs standalone.

## 6. Data model

```ts
type NoteFile = { name: string; path: string };
type SaveStatus = "idle" | "dirty" | "saving" | "saved" | "error";

type Store = {
  folder: string | null;
  notes: NoteFile[];
  activePath: string | null;
  activeContent: string;   // raw markdown loaded from disk
  status: SaveStatus;
  error: string | null;
};
```

In-memory document: TipTap JSON. Disk: markdown string.

## 7. Non-goals (v1)

- Cloud sync, accounts, collaboration
- Databases/tables, kanban, embeds
- Inline image upload
- Multiple windows, tabs, mobile
- Wiki-style `[[links]]` and backlinks
- Nested folder tree (flat sidebar for v1)

## 8. Risks & mitigations

| Risk | Mitigation |
|---|---|
| Markdown ↔ TipTap round-trip fidelity | Fixture tests (still TODO); restricted to StarterKit node set |
| Drag-to-reorder block handles are custom ProseMirror work | Isolated in `blockUtils.ts` + `BlockHandles.tsx` |
| Rust first-build time | One-time cost; UI hot-reloads without recompiling |
| WKWebView (Safari engine) quirks | Tested in `tauri dev`; avoided Chromium-only CSS |
| External file changes / file watching | Deferred; add `notify`-based watcher later |
| `dmg` bundling fails headlessly | Build with `CI=true` (skips Finder AppleScript step) |

## 9. Verification

- **Unit:** Vitest for `lib/markdown.ts` round-trips and store reducers — *not yet written*.
- **Manual QA:** sidebar lifecycle, editing gestures, slash menu, block handles, save.
- **Build check:** `npm run tauri build` succeeds and the app opens a real folder.

## 10. Dependencies

```
@tauri-apps/api @tauri-apps/plugin-fs @tauri-apps/plugin-dialog
@tiptap/react @tiptap/starter-kit @tiptap/pm @tiptap/extensions
@tiptap/extension-task-list @tiptap/extension-task-item @tiptap/suggestion
tiptap-markdown zustand
tailwindcss @tailwindcss/vite
dev: typescript vite @vitejs/plugin-react vitest
```

## 11. Decisions (locked)

1. **Sidebar: flat list** for v1. Nested tree deferred.
2. **Explicit save via `⌘S`** only. No autosave in v1; dirty indicator and
   guard against losing unsaved changes on note switch/quit.
3. **User-chosen folder.** Monocle reads/writes `.md` files in a folder the user
   picks; it does not manage its own hidden library.
