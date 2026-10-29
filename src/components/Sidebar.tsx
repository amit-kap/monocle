import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from "react";
import { revealItemInDir } from "@tauri-apps/plugin-opener";
import { useStore } from "../store/useStore";
import { filterTree } from "../lib/fs";
import { SIDEBAR, clampWidth, readWidth, storeWidth } from "../lib/layout";
import { scrollDelta } from "../lib/scroll";
import { stepRow, visibleRows, type TreeRow } from "../lib/treeNav";
import { FileTree } from "./FileTree";
import { MenuCheck } from "./MenuCheck";
import { ResizeHandle } from "./ResizeHandle";

function baseName(path: string): string {
  return path.split("/").pop() ?? path;
}

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

function FolderIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path
        d="M1.5 4.5A1.5 1.5 0 0 1 3 3h3l1.5 1.8H13A1.5 1.5 0 0 1 14.5 6.3v5.2A1.5 1.5 0 0 1 13 13H3a1.5 1.5 0 0 1-1.5-1.5v-7Z"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function RefreshIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path
        d="M13 8a5 5 0 1 1-1.6-3.7"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
      />
      <path
        d="M13.3 2.4v2.7h-2.7"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
      <circle cx="7" cy="7" r="4.5" stroke="currentColor" strokeWidth="1.3" />
      <path
        d="M10.5 10.5 14 14"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
      />
    </svg>
  );
}

function MoreIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden>
      <circle cx="3.4" cy="8" r="1.15" />
      <circle cx="8" cy="8" r="1.15" />
      <circle cx="12.6" cy="8" r="1.15" />
    </svg>
  );
}

/** One icon slot for every menu row, matching the block menu's. */
function MenuIcon({ children }: { children: ReactNode }) {
  return <span className="block-menu-icon">{children}</span>;
}

function PlusMenuIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path
        d="M8 3.5v9M3.5 8h9"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </svg>
  );
}

function CollapseAllIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path
        d="m4 7.5 4-4 4 4M4 12.5l4-4 4 4"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ExpandAllIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path
        d="m4 3.5 4 4 4-4M4 8.5l4 4 4-4"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function RevealIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path
        d="M2.2 5.2a3 3 0 0 1 3-3H8v11.6H5.2a3 3 0 0 1-3-3V5.2Z"
        fill="currentColor"
        opacity=".16"
        stroke="none"
      />
      <rect
        x="2.2"
        y="2.2"
        width="11.6"
        height="11.6"
        rx="3"
        stroke="currentColor"
        strokeWidth="1.2"
      />
      <circle cx="5.9" cy="6.4" r="0.7" fill="currentColor" />
      <circle cx="10.1" cy="6.4" r="0.7" fill="currentColor" />
      <path
        d="M5.4 9.2c.6.9 1.5 1.4 2.6 1.4s2-.5 2.6-1.4"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function EyeIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path
        d="M1.8 8s2.4-4 6.2-4 6.2 4 6.2 4-2.4 4-6.2 4S1.8 8 1.8 8Z"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinejoin="round"
      />
      <circle cx="8" cy="8" r="1.8" stroke="currentColor" strokeWidth="1.3" />
    </svg>
  );
}


export function Sidebar() {
  const folder = useStore((s) => s.folder);
  const tree = useStore((s) => s.tree);
  const loading = useStore((s) => s.loading);
  const error = useStore((s) => s.error);
  const expanded = useStore((s) => s.expanded);
  const selectedDir = useStore((s) => s.selectedDir);
  const activePath = useStore((s) => s.activePath);
  const chooseFolder = useStore((s) => s.chooseFolder);
  const createNote = useStore((s) => s.createNote);
  const openNote = useStore((s) => s.openNote);
  const renameNote = useStore((s) => s.renameNote);
  const deleteNote = useStore((s) => s.deleteNote);
  const toggleDir = useStore((s) => s.toggleDir);
  const collapseAll = useStore((s) => s.collapseAll);
  const expandAll = useStore((s) => s.expandAll);
  const refresh = useStore((s) => s.refresh);
  const showHidden = useStore((s) => s.showHidden);
  const setShowHidden = useStore((s) => s.setShowHidden);
  const requestEditorFocus = useStore((s) => s.requestEditorFocus);

  const [query, setQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
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
  const searching = query.trim().length > 0;
  const anyExpanded = expanded.size > 0;
  const rows = useMemo(
    () => visibleRows(filtered, { expanded, forceExpand: searching }),
    [filtered, expanded, searching],
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

  function moveTo(row: TreeRow, open: boolean) {
    setFocusedPath(row.path);
    rowElement(navRef.current, row.path)?.focus({ preventScroll: true });
    revealRow(navRef.current, row.path);
    if (open) void openFromTree(row.path);
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

    if (event.key === "Enter" || event.key === " ") {
      if (!focused) return;
      event.preventDefault();
      if (focused.kind === "dir") toggleDir(focused.path);
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
    moveTo(row, row.kind === "file");
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

  return (
    <aside
      className="relative flex h-full shrink-0 flex-col bg-[var(--bg-sidebar)]"
      style={{ width }}
    >
      {/* The window row, 40px like the note's toolbar beside it. The traffic
          lights are drawn over its left end, so it holds only the drag region
          and the sidebar's own actions. */}
      <div className="relative flex h-10 shrink-0 items-center justify-end gap-0.5 px-3">
        <div data-tauri-drag-region className="absolute inset-0" />
        <button
          type="button"
          title="Search notes"
          onClick={() => setSearchOpen((open) => !open)}
          disabled={!folder || tree.length === 0}
          className={`relative grid h-7 w-7 place-items-center rounded-[6px] hover:bg-[var(--bg-hover)] hover:text-[var(--text)] disabled:opacity-30 disabled:hover:bg-transparent ${
            searchOpen
              ? "bg-[var(--bg-active)] text-[var(--text)]"
              : "text-[var(--text-muted)]"
          }`}
        >
          <SearchIcon />
        </button>
        <button
          type="button"
          title="Refresh"
          onClick={() => void refresh()}
          disabled={!folder || loading}
          className="relative grid h-7 w-7 place-items-center rounded-[6px] text-[var(--text-muted)] hover:bg-[var(--bg-hover)] hover:text-[var(--text)] disabled:opacity-30 disabled:hover:bg-transparent"
        >
          <RefreshIcon />
        </button>
        <button
          type="button"
          title="More"
          onClick={() => setMenuOpen((open) => !open)}
          className={`relative grid h-7 w-7 place-items-center rounded-[6px] hover:bg-[var(--bg-hover)] hover:text-[var(--text)] ${
            menuOpen
              ? "bg-[var(--bg-active)] text-[var(--text)]"
              : "text-[var(--text-muted)]"
          }`}
        >
          <MoreIcon />
        </button>
      </div>

      {/* The root folder keeps a row of its own; the menu hangs off it. */}
      <div
        ref={headerRef}
        className="relative flex h-9 shrink-0 items-center px-3"
      >
        <button
          type="button"
          title={folder ? "Change root folder" : "Choose a folder"}
          onClick={() => void chooseFolder()}
          className="flex min-w-0 items-center gap-1.5 rounded-[var(--radius)] px-1.5 py-1 text-[13px] font-medium text-[var(--text-muted)] hover:bg-[var(--bg-hover)] hover:text-[var(--text)]"
        >
          <FolderIcon />
          <span className="truncate">{folder ? baseName(folder) : "Monocle"}</span>
        </button>

        {menuOpen && (
          <div className="block-menu" style={{ position: "absolute", right: 8, top: 32 }}>
            <button
              type="button"
              className="block-menu-item"
              disabled={!folder}
              onClick={() => {
                setMenuOpen(false);
                void createNote();
              }}
            >
              <MenuIcon>
                <PlusMenuIcon />
              </MenuIcon>
              Add file
            </button>
            <button
              type="button"
              className="block-menu-item"
              disabled={!folder || loading}
              onClick={() => {
                setMenuOpen(false);
                void refresh();
              }}
            >
              <MenuIcon>
                <RefreshIcon />
              </MenuIcon>
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
              <MenuIcon>
                {anyExpanded ? <CollapseAllIcon /> : <ExpandAllIcon />}
              </MenuIcon>
              {anyExpanded ? "Collapse all" : "Expand all"}
            </button>
            <div className="block-menu-sep" />
            <button
              type="button"
              className="block-menu-item"
              disabled={!folder}
              onClick={() => {
                setMenuOpen(false);
                if (folder) void revealItemInDir(folder);
              }}
            >
              <MenuIcon>
                <RevealIcon />
              </MenuIcon>
              Reveal in Finder
            </button>
            <button
              type="button"
              className="block-menu-item"
              onClick={() => {
                setMenuOpen(false);
                void setShowHidden(!showHidden);
              }}
            >
              <MenuIcon>
                <EyeIcon />
              </MenuIcon>
              Show hidden files
              {showHidden && <MenuCheck />}
            </button>
          </div>
        )}
      </div>

      {searchOpen && folder && tree.length > 0 && (
        <div className="px-2 pb-2">
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
            No notes yet
          </p>
        )}
        {folder && !loading && tree.length > 0 && filtered.length === 0 && (
          <p className="px-2 py-6 text-center text-[13px] text-[var(--text-faint)]">
            No matches
          </p>
        )}

        <FileTree
          nodes={filtered}
          activePath={activePath}
          selectedDir={selectedDir}
          expanded={expanded}
          forceExpand={searching}
          tabbablePath={focusedPath ?? activePath}
          highlightPath={highlight}
          keyboardRing={keyboardRing}
          onToggle={toggleDir}
          onOpen={(path) => {
            // Picking a note answers the search.
            setSearchOpen(false);
            void openNote(path);
          }}
          onAddNote={(path) => void createNote(path)}
          onReveal={(path) => void revealItemInDir(path)}
          onRename={(path, name) => void renameNote(path, name)}
          onDelete={(path) => void deleteNote(path)}
          onFocusRow={setFocusedPath}
        />
      </nav>

      <ResizeHandle
        style={{ left: "100%" }}
        onResizeStart={(event) => startResize(event.clientX)}
        onReset={() => setWidth(SIDEBAR.default)}
      />
    </aside>
  );
}
