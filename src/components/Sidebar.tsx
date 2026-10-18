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

function PlusIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path
        d="M8 3.5v9M3.5 8h9"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </svg>
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

function RefreshIcon({ spinning }: { spinning?: boolean }) {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden
      className={spinning ? "animate-spin" : undefined}
    >
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
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden>
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
  const refresh = useStore((s) => s.refresh);
  const showHidden = useStore((s) => s.showHidden);
  const setShowHidden = useStore((s) => s.setShowHidden);
  const requestEditorFocus = useStore((s) => s.requestEditorFocus);

  const [query, setQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [folderMenu, setFolderMenu] = useState(false);
  const [width, setWidth] = useState(() => readWidth(SIDEBAR, localStorage));
  // The row the keyboard is on, and the row the ⌘P search is on. They are
  // separate: while the search box has focus the tree cannot take focus, so
  // the search carries its own highlight.
  const [focusedPath, setFocusedPath] = useState<string | null>(null);
  const [highlight, setHighlight] = useState<string | null>(null);
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
    if (!folderMenu) return;
    function onDown(event: MouseEvent) {
      if (!headerRef.current?.contains(event.target as Node)) {
        setFolderMenu(false);
      }
    }
    window.addEventListener("mousedown", onDown);
    return () => window.removeEventListener("mousedown", onDown);
  }, [folderMenu]);

  const filtered = useMemo(() => filterTree(tree, query), [tree, query]);
  const searching = query.trim().length > 0;
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
      <div
        ref={headerRef}
        className="relative flex h-11 shrink-0 items-center justify-between px-3"
      >
        <button
          type="button"
          title="Root folder"
          onClick={() => (folder ? setFolderMenu((open) => !open) : chooseFolder())}
          className="flex min-w-0 items-center gap-1.5 rounded-[var(--radius)] px-1.5 py-1 text-[13px] font-medium text-[var(--text-muted)] hover:bg-[var(--bg-hover)] hover:text-[var(--text)]"
        >
          <FolderIcon />
          <span className="truncate">{folder ? baseName(folder) : "Monocle"}</span>
        </button>
        <div className="flex items-center gap-0.5">
          <button
            type="button"
            title="Refresh"
            onClick={() => void refresh()}
            disabled={!folder || loading}
            className="grid h-6 w-6 place-items-center rounded text-[var(--text-muted)] hover:bg-[var(--bg-hover)] hover:text-[var(--text)] disabled:opacity-30 disabled:hover:bg-transparent"
          >
            <RefreshIcon spinning={loading} />
          </button>
          <button
            type="button"
            title="New note"
            onClick={() => createNote()}
            disabled={!folder}
            className="grid h-6 w-6 place-items-center rounded text-[var(--text-muted)] hover:bg-[var(--bg-hover)] hover:text-[var(--text)] disabled:opacity-30 disabled:hover:bg-transparent"
          >
            <PlusIcon />
          </button>
          <button
            type="button"
            title="Search notes"
            onClick={() => setSearchOpen((open) => !open)}
            disabled={!folder || tree.length === 0}
            className={`grid h-6 w-6 place-items-center rounded hover:bg-[var(--bg-hover)] hover:text-[var(--text)] disabled:opacity-30 disabled:hover:bg-transparent ${
              searchOpen
                ? "bg-[var(--bg-active)] text-[var(--text)]"
                : "text-[var(--text-muted)]"
            }`}
          >
            <SearchIcon />
          </button>
        </div>

        {folderMenu && folder && (
          <div className="block-menu" style={{ position: "absolute", left: 8, top: 40 }}>
            <button
              type="button"
              className="block-menu-item"
              onClick={() => {
                setFolderMenu(false);
                void chooseFolder();
              }}
            >
              Change root folder…
            </button>
            <button
              type="button"
              className="block-menu-item"
              onClick={() => {
                setFolderMenu(false);
                void revealItemInDir(folder);
              }}
            >
              Reveal in Finder
            </button>
            <div className="block-menu-sep" />
            <button
              type="button"
              className="block-menu-item"
              title="Also list files and folders whose name starts with a dot"
              onClick={() => {
                setFolderMenu(false);
                void setShowHidden(!showHidden);
              }}
            >
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
          <p className="mx-1 mb-2 rounded-[var(--radius)] bg-[var(--bg-active)] px-2 py-1.5 text-[12px] leading-snug text-[#e03e3e] [overflow-wrap:anywhere]">
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
          onToggle={toggleDir}
          onOpen={(path) => {
            // Picking a note answers the search.
            setSearchOpen(false);
            void openNote(path);
          }}
          onAddNote={(path) => void createNote(path)}
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
