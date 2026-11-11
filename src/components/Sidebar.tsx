import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import { revealItemInDir } from "@tauri-apps/plugin-opener";
import { useStore } from "../store/useStore";
import { filterTree } from "../lib/fs";
import { SIDEBAR, clampWidth, readWidth, storeWidth } from "../lib/layout";
import { scrollDelta } from "../lib/scroll";
import { stepRow, visibleRows, type TreeRow } from "../lib/treeNav";
import { ancestorsUpToHome, baseName, foldTree } from "../lib/treeView";
import { copyPathReference } from "../lib/agentActions";
import type { TreeNode } from "../types";
import { ContextMenu, type MenuItem } from "./ContextMenu";
import { FileTree, renameTarget } from "./FileTree";
import {
  ChevronsUpDown,
  ClockIcon,
  CopyIcon,
  EllipsisIcon,
  FolderIcon,
  FolderRootIcon,
  FolderSearchIcon,
  PlusIcon,
  RefreshGlyph,
  RevealGlyph,
  SearchGlyph,
  SettingsIcon,
  TrashGlyph,
  TypeIcon,
} from "./icons";
import { PaneToggle } from "./PaneToggle";
import { ResizeHandle } from "./ResizeHandle";

/** The tree renders its rows in visual order, so the DOM is the row list. */
function rowElement(nav: HTMLElement | null, path: string): HTMLElement | null {
  const rows = Array.from(
    nav?.querySelectorAll<HTMLElement>("[data-tree-row]") ?? [],
  );
  return rows.find((row) => row.dataset.treeRow === path) ?? null;
}

/** Bring a row into view, moving the sidebar's scroller and nothing else. */
function revealRow(nav: HTMLElement | null, path: string): void {
  const row = rowElement(nav, path);
  if (!nav || !row) return;
  nav.scrollTop += scrollDelta(
    nav.getBoundingClientRect(),
    row.getBoundingClientRect(),
  );
}

function where(path: string, home: string | null): string {
  if (home && path === home) return "Home folder";
  if (home && path.startsWith(`${home}/`)) return `~/${path.slice(home.length + 1)}`;
  return path;
}

/**
 * The root folder: a button at the foot of the sidebar that shows only the
 * folder's name, and a menu that opens upward with every folder above it up to
 * home, the last four roots, and the system folder picker.
 */
function RootBar() {
  const folder = useStore((s) => s.folder);
  const home = useStore((s) => s.home);
  const recentRoots = useStore((s) => s.recentRoots);
  const setRoot = useStore((s) => s.setRoot);
  const chooseFolder = useStore((s) => s.chooseFolder);
  const openSettings = useStore((s) => s.openSettings);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDown(event: MouseEvent) {
      if (!ref.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    window.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const ups = folder && home ? ancestorsUpToHome(folder, home) : [];
  const recents = recentRoots.filter((p) => p !== folder && !ups.includes(p));

  return (
    <div
      ref={ref}
      className="relative flex shrink-0 items-center gap-1 border-t border-[var(--border)] p-2"
    >
      <button
        type="button"
        title="Change root folder"
        aria-haspopup="menu"
        aria-expanded={open}
        data-root-button
        onClick={() => setOpen((v) => !v)}
        className="flex h-[30px] min-w-0 flex-1 items-center gap-2 rounded-[var(--radius)] px-2 text-left text-[13px] text-[var(--text-muted)] hover:bg-[var(--bg-hover)]"
      >
        <FolderRootIcon />
        <span className="min-w-0 flex-1 truncate font-semibold text-[var(--text)]">
          {folder ? baseName(folder) : "Choose a folder"}
        </span>
        <ChevronsUpDown className="size-3.5" />
      </button>
      <button
        type="button"
        title="Settings (⌘,)"
        aria-label="Settings"
        onClick={openSettings}
        className="grid size-[30px] shrink-0 place-items-center rounded-[var(--radius)] text-[var(--text-muted)] hover:bg-[var(--bg-hover)] hover:text-[var(--text)]"
      >
        <SettingsIcon />
      </button>

      {open && (
        <div
          role="menu"
          data-root-menu
          className="block-menu"
          style={{ position: "absolute", left: 8, right: 8, bottom: 48, zIndex: 40 }}
        >
          {ups.length > 0 && (
            <>
              <div className="block-menu-label">Go up to</div>
              {ups.map((dir) => (
                <button
                  key={dir}
                  type="button"
                  role="menuitem"
                  className="block-menu-item"
                  onClick={() => {
                    setOpen(false);
                    void setRoot(dir);
                  }}
                >
                  <span className="grid w-[18px] place-items-center">
                    <FolderIcon className="size-4" />
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate">{baseName(dir)}</span>
                    <span className="block truncate text-[11px] text-[var(--text-faint)]">
                      {where(dir, home)}
                    </span>
                  </span>
                </button>
              ))}
              <div className="block-menu-sep" />
            </>
          )}
          {recents.length > 0 && (
            <>
              <div className="block-menu-label">Recent</div>
              {recents.map((dir) => (
                <button
                  key={dir}
                  type="button"
                  role="menuitem"
                  className="block-menu-item"
                  onClick={() => {
                    setOpen(false);
                    void setRoot(dir);
                  }}
                >
                  <span className="grid w-[18px] place-items-center">
                    <ClockIcon className="size-4" />
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate">{baseName(dir)}</span>
                    <span className="block truncate text-[11px] text-[var(--text-faint)]">
                      {where(dir, home)}
                    </span>
                  </span>
                </button>
              ))}
              <div className="block-menu-sep" />
            </>
          )}
          <button
            type="button"
            role="menuitem"
            className="block-menu-item"
            onClick={() => {
              setOpen(false);
              void chooseFolder();
            }}
          >
            <span className="grid w-[18px] place-items-center">
              <FolderSearchIcon className="size-4" />
            </span>
            Choose another folder…
          </button>
        </div>
      )}
    </div>
  );
}

export function Sidebar() {
  const folder = useStore((s) => s.folder);
  const home = useStore((s) => s.home);
  const tree = useStore((s) => s.tree);
  const loading = useStore((s) => s.loading);
  const error = useStore((s) => s.error);
  const expanded = useStore((s) => s.expanded);
  const folderPage = useStore((s) => s.folderPage);
  const activePath = useStore((s) => s.activePath);
  const renamingPath = useStore((s) => s.renamingPath);
  const changes = useStore((s) => s.changes);
  const createNote = useStore((s) => s.createNote);
  const openNote = useStore((s) => s.openNote);
  const openFolder = useStore((s) => s.openFolder);
  const renameEntry = useStore((s) => s.renameEntry);
  const startRename = useStore((s) => s.startRename);
  const trashEntry = useStore((s) => s.trashEntry);
  const setRoot = useStore((s) => s.setRoot);
  const toggleDir = useStore((s) => s.toggleDir);
  const collapseAll = useStore((s) => s.collapseAll);
  const expandAll = useStore((s) => s.expandAll);
  const refresh = useStore((s) => s.refresh);
  const requestEditorFocus = useStore((s) => s.requestEditorFocus);
  const leftOpen = useStore((s) => s.leftOpen);
  const toggleLeft = useStore((s) => s.toggleLeft);

  const [query, setQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [rowMenu, setRowMenu] = useState<{ node: TreeNode; x: number; y: number } | null>(
    null,
  );
  const [width, setWidth] = useState(() => readWidth(SIDEBAR, localStorage));
  // The row the keyboard is on, and the row the ⌘P search is on. They are
  // separate: while the search box has focus the tree cannot take focus, so
  // the search carries its own highlight.
  const [focusedPath, setFocusedPath] = useState<string | null>(null);
  const [highlight, setHighlight] = useState<string | null>(null);
  // WebKit focuses the first row on its own at launch; the brass ring is for
  // the keyboard, so it follows the last input rather than focus alone.
  const [keyboardRing, setKeyboardRing] = useState(false);
  const headerRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const navRef = useRef<HTMLElement>(null);

  useEffect(() => {
    storeWidth(SIDEBAR, localStorage, width);
  }, [width]);

  function startResize(startX: number) {
    const startWidth = width;
    function onMove(event: MouseEvent) {
      const next = startWidth + (event.clientX - startX);
      setWidth(clampWidth(next, SIDEBAR.min, SIDEBAR.max));
    }
    function onUp() {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    }
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  }

  useEffect(() => {
    function onKeyDown() {
      setKeyboardRing(true);
    }
    function onMouseDown() {
      setKeyboardRing(false);
    }
    window.addEventListener("keydown", onKeyDown, true);
    window.addEventListener("mousedown", onMouseDown, true);
    return () => {
      window.removeEventListener("keydown", onKeyDown, true);
      window.removeEventListener("mousedown", onMouseDown, true);
    };
  }, []);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "p") {
        event.preventDefault();
        setSearchOpen(true);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    if (searchOpen) searchRef.current?.focus();
    else setQuery("");
  }, [searchOpen]);

  useEffect(() => {
    if (!menuOpen) return;
    function onDown(event: MouseEvent) {
      if (!headerRef.current?.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    }
    window.addEventListener("mousedown", onDown);
    return () => window.removeEventListener("mousedown", onDown);
  }, [menuOpen]);

  const filtered = useMemo(() => filterTree(tree, query), [tree, query]);
  // The sidebar draws the folded tree: single-child folders merge into one row.
  const shown = useMemo(() => foldTree(filtered), [filtered]);
  const searching = query.trim().length > 0;
  const anyExpanded = expanded.size > 0;
  const rows = useMemo(
    () => visibleRows(shown, { expanded, forceExpand: searching }),
    [shown, expanded, searching],
  );
  const files = useMemo(() => rows.filter((row) => row.kind === "file"), [rows]);
  // A value to depend on: the results, as one string.
  const fileKey = files.map((row) => row.path).join("\n");

  useEffect(() => {
    // A new set of results starts on its first note.
    setHighlight(searching ? (files[0]?.path ?? null) : null);
  }, [searching, fileKey]);

  useEffect(() => {
    if (highlight) revealRow(navRef.current, highlight);
  }, [highlight]);

  /** Find a row's node in the folded tree. */
  function nodeAt(path: string): TreeNode | null {
    function walk(nodes: TreeNode[]): TreeNode | null {
      for (const node of nodes) {
        if (node.path === path) return node;
        if (node.kind === "dir" && node.children) {
          const hit = walk(node.children);
          if (hit) return hit;
        }
      }
      return null;
    }
    return walk(shown);
  }

  /** Open a note from the tree, keeping the focus where the keyboard is. */
  async function openFromTree(path: string) {
    const before = useStore.getState().activePath;
    if (path === before) return;
    await openNote(path);
    // A dismissed unsaved-changes prompt leaves the old note open: send the
    // focus back to it, so the tree and the editor don't disagree.
    if (useStore.getState().activePath !== path) {
      setFocusedPath(before);
      rowElement(navRef.current, before ?? "")?.focus({ preventScroll: true });
    }
  }

  async function openFolderRow(node: TreeNode) {
    // The name unfolds the folder and opens its page.
    const state = useStore.getState();
    if (!state.expanded.has(node.path)) toggleDir(node.path);
    await openFolder(node.openPath ?? node.path);
  }

  function moveTo(row: TreeRow) {
    setFocusedPath(row.path);
    rowElement(navRef.current, row.path)?.focus({ preventScroll: true });
    revealRow(navRef.current, row.path);
  }

  function menuItems(node: TreeNode): MenuItem[] {
    const target = renameTarget(node);
    if (node.kind === "dir") {
      const dir = node.openPath ?? node.path;
      return [
        {
          label: "New file here",
          icon: <PlusIcon className="size-4" />,
          onSelect: () => void createNote(dir),
        },
        { separator: true },
        {
          label: "Rename",
          icon: <TypeIcon className="size-4" />,
          onSelect: () => startRename(target),
        },
        {
          label: "Set as root folder",
          icon: <FolderRootIcon className="size-4" />,
          onSelect: () => void setRoot(dir),
        },
        { separator: true },
        {
          label: "Move to Trash",
          icon: <TrashGlyph className="size-4" />,
          danger: true,
          onSelect: () => void trashEntry(dir),
        },
      ];
    }
    return [
      {
        label: "Rename",
        icon: <TypeIcon className="size-4" />,
        onSelect: () => startRename(target),
      },
      {
        label: "Copy path for agent",
        icon: <CopyIcon className="size-4" />,
        onSelect: () => {
          if (home) void copyPathReference(node.path, home);
        },
      },
      { separator: true },
      {
        label: "Move to Trash",
        icon: <TrashGlyph className="size-4" />,
        danger: true,
        onSelect: () => void trashEntry(node.path),
      },
    ];
  }

  function onTreeKeyDown(event: ReactKeyboardEvent<HTMLElement>) {
    const target = event.target as HTMLElement;
    // A row can hold a control of its own — the rename field — and its keys
    // are its own.
    if (target.closest("input, textarea")) return;
    // The key came from the focused row, so that is the row to move from. (The
    // focus state cannot be relied on for this: a window that isn't frontmost
    // still moves the caret but fires no focus events.)
    const from = target.closest<HTMLElement>("[data-tree-row]")?.dataset.treeRow
      ?? focusedPath;
    const focused = rows.find((row) => row.path === from);
    const node = from ? nodeAt(from) : null;

    // F2 renames the selected row; ⌘⌫ moves it to the Trash.
    if (event.key === "F2" && node) {
      event.preventDefault();
      startRename(renameTarget(node));
      return;
    }
    if (event.key === "Backspace" && (event.metaKey || event.ctrlKey) && node) {
      event.preventDefault();
      void trashEntry(node.kind === "dir" ? (node.openPath ?? node.path) : node.path);
      return;
    }

    // Enter opens: a file in the editor, a folder as its page.
    if (event.key === "Enter" || event.key === " ") {
      if (!focused || !node) return;
      event.preventDefault();
      if (focused.kind === "dir") void openFolderRow(node);
      else void openFromTree(focused.path);
      return;
    }

    const index = rows.findIndex((row) => row.path === from);
    const step = stepRow(rows, index, event.key, { canToggle: !searching });
    if (!step) return;
    const row = rows[step.index];
    if (!row) return;
    event.preventDefault();
    if (step.toggle) {
      toggleDir(row.path);
      return;
    }
    // Arrows move; they never open.
    moveTo(row);
  }

  function onSearchKeyDown(event: ReactKeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") {
      setSearchOpen(false);
      return;
    }
    if (event.key === "Enter") {
      const target = highlight ?? files[0]?.path;
      if (!target) return;
      event.preventDefault();
      setSearchOpen(false);
      void openNote(target).then(() => {
        // Only take the caret if the note actually opened.
        if (useStore.getState().activePath === target) requestEditorFocus();
      });
      return;
    }
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
    const index = files.findIndex((row) => row.path === highlight);
    const step = stepRow(files, index, event.key, { canToggle: false });
    if (!step) return;
    event.preventDefault();
    const row = files[step.index];
    if (row) setHighlight(row.path);
  }

  const canNavigate = Boolean(folder);

  return (
    // Hidden, not unmounted: the search box and the tree's focus survive a
    // collapse.
    <aside
      className="relative flex h-full shrink-0 flex-col bg-[var(--bg-sidebar)]"
      style={{ width, display: leftOpen ? undefined : "none" }}
    >
      {/* The window row, 40px like the note's toolbar beside it. The traffic
          lights are drawn over its left end. */}
      <div
        ref={headerRef}
        className="relative flex h-10 shrink-0 items-center justify-end gap-0.5 px-3"
      >
        <div data-tauri-drag-region className="absolute inset-0" />
        {/* Clear of the traffic lights, and at the x the top bar uses for the
            same button once the sidebar is closed (12 + 72 = 84). */}
        <div className="relative ml-[72px] mr-auto">
          <PaneToggle side="left" open onClick={toggleLeft} />
        </div>
        <button
          type="button"
          title="More"
          aria-label="More"
          onClick={() => setMenuOpen((open) => !open)}
          className={`relative grid h-7 w-7 place-items-center rounded-[6px] hover:bg-[var(--bg-hover)] hover:text-[var(--text)] ${
            menuOpen
              ? "bg-[var(--bg-active)] text-[var(--text)]"
              : "text-[var(--text-muted)]"
          }`}
        >
          <EllipsisIcon />
        </button>

        {menuOpen && (
          <div className="block-menu" style={{ position: "absolute", right: 8, top: 36, zIndex: 40 }}>
            <button
              type="button"
              className="block-menu-item"
              disabled={!folder || loading}
              onClick={() => {
                setMenuOpen(false);
                void refresh();
              }}
            >
              <span className="grid w-[18px] place-items-center">
                <RefreshGlyph className="size-4" />
              </span>
              Refresh
            </button>
            <button
              type="button"
              className="block-menu-item"
              onClick={() => {
                setMenuOpen(false);
                if (anyExpanded) collapseAll();
                else expandAll();
              }}
            >
              <span className="grid w-[18px] place-items-center">
                <ChevronsUpDown className="size-4" />
              </span>
              {anyExpanded ? "Collapse all" : "Expand all"}
            </button>
            <button
              type="button"
              className="block-menu-item"
              disabled={!folder}
              onClick={() => {
                setMenuOpen(false);
                if (folder) void revealItemInDir(folder);
              }}
            >
              <span className="grid w-[18px] place-items-center">
                <RevealGlyph className="size-4" />
              </span>
              Reveal in Finder
            </button>
          </div>
        )}
      </div>

      <div className="flex shrink-0 flex-col px-2 pt-1">
        <button
          type="button"
          data-nav="new"
          disabled={!canNavigate}
          onClick={() => void createNote()}
          className="flex h-[30px] items-center gap-2.5 rounded-[var(--radius)] px-2 text-[13px] font-medium text-[var(--text)] hover:bg-[var(--bg-hover)] disabled:opacity-40"
        >
          <PlusIcon />
          New file
          <kbd className="ml-auto font-sans text-[11px] font-medium text-[var(--text-muted)]">
            ⌘N
          </kbd>
        </button>
        <button
          type="button"
          data-nav="search"
          disabled={!canNavigate || tree.length === 0}
          onClick={() => setSearchOpen((open) => !open)}
          className={`flex h-[30px] items-center gap-2.5 rounded-[var(--radius)] px-2 text-[13px] font-medium text-[var(--text)] hover:bg-[var(--bg-hover)] disabled:opacity-40 ${
            searchOpen ? "bg-[var(--bg-active)]" : ""
          }`}
        >
          <SearchGlyph />
          Search
          <kbd className="ml-auto font-sans text-[11px] font-medium text-[var(--text-muted)]">
            ⌘P
          </kbd>
        </button>
      </div>

      {searchOpen && folder && tree.length > 0 && (
        <div className="px-2 pt-1">
          <input
            ref={searchRef}
            value={query}
            onChange={(event) => setQuery(event.currentTarget.value)}
            onKeyDown={onSearchKeyDown}
            placeholder="Search notes"
            className="w-full rounded-[var(--radius)] border border-transparent bg-[var(--bg-active)] px-2 py-1 text-[13px] text-[var(--text)] outline-none placeholder:text-[var(--text-faint)] focus:border-[var(--accent)]"
          />
        </div>
      )}

      <div className="shrink-0 px-4 pb-1.5 pt-4 text-[11px] font-semibold tracking-[0.06em] text-[var(--text-muted)]">
        FILES
      </div>

      <nav
        ref={navRef}
        onKeyDown={onTreeKeyDown}
        className="flex-1 overflow-y-auto px-2 pb-3"
      >
        {folder && error && (
          <p className="mx-1 mb-2 rounded-[var(--radius)] bg-[var(--bg-active)] px-2 py-1.5 text-[12px] leading-snug text-[var(--danger)] [overflow-wrap:anywhere]">
            {error}
          </p>
        )}
        {!folder && (
          <p className="px-2 py-6 text-center text-[13px] text-[var(--text-faint)]">
            No folder open
          </p>
        )}
        {folder && loading && (
          <p className="px-2 py-6 text-center text-[13px] text-[var(--text-faint)]">
            Scanning…
          </p>
        )}
        {folder && !loading && tree.length === 0 && (
          <p className="px-2 py-6 text-center text-[13px] text-[var(--text-faint)]">
            No markdown files here
          </p>
        )}
        {folder && !loading && tree.length > 0 && filtered.length === 0 && (
          <p className="px-2 py-6 text-center text-[13px] text-[var(--text-faint)]">
            No matches
          </p>
        )}

        <FileTree
          nodes={shown}
          activePath={activePath}
          folderPage={folderPage}
          expanded={expanded}
          forceExpand={searching}
          tabbablePath={focusedPath ?? activePath}
          highlightPath={highlight}
          keyboardRing={keyboardRing}
          renamingPath={renamingPath}
          changes={changes}
          onToggle={toggleDir}
          onOpenFolder={(node) => void openFolderRow(node)}
          onOpen={(path) => {
            // Picking a note answers the search.
            setSearchOpen(false);
            void openNote(path);
          }}
          onMenu={(node, x, y) => setRowMenu({ node, x, y })}
          onRename={(path, name) => {
            const clean = name.trim();
            if (!clean || clean === baseName(path)) {
              startRename(null);
              return;
            }
            void renameEntry(path, clean);
          }}
          onCancelRename={() => startRename(null)}
          onFocusRow={setFocusedPath}
        />
      </nav>

      <RootBar />

      {rowMenu && (
        <ContextMenu
          x={rowMenu.x}
          y={rowMenu.y}
          items={menuItems(rowMenu.node)}
          onClose={() => setRowMenu(null)}
        />
      )}

      <ResizeHandle
        style={{ left: "100%" }}
        onResizeStart={(event) => startResize(event.clientX)}
        onReset={() => setWidth(SIDEBAR.default)}
      />
    </aside>
  );
}
