import { useEffect, useMemo, useRef, useState } from "react";
import { revealItemInDir } from "@tauri-apps/plugin-opener";
import { useStore } from "../store/useStore";
import { filterTree } from "../lib/fs";
import { FileTree } from "./FileTree";

function baseName(path: string): string {
  return path.split("/").pop() ?? path;
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

const MIN_WIDTH = 180;
const MAX_WIDTH = 480;
const WIDTH_KEY = "monocle:sidebarWidth";

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

  const [query, setQuery] = useState("");
  const [folderMenu, setFolderMenu] = useState(false);
  const [width, setWidth] = useState(() => {
    const saved = Number(localStorage.getItem(WIDTH_KEY));
    return saved >= MIN_WIDTH && saved <= MAX_WIDTH ? saved : 240;
  });
  const headerRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    localStorage.setItem(WIDTH_KEY, String(width));
  }, [width]);

  function startResize(startX: number) {
    const startWidth = width;
    function onMove(event: MouseEvent) {
      const next = startWidth + (event.clientX - startX);
      setWidth(Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, next)));
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
        searchRef.current?.focus();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

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

  return (
    <aside
      className="relative flex h-full shrink-0 flex-col border-r border-[var(--border)] bg-[var(--bg-sidebar)]"
      style={{ width }}
    >
      <div
        ref={headerRef}
        className="relative flex h-11 shrink-0 items-center justify-between px-3"
      >
        <span className="truncate text-[13px] font-medium text-[var(--text-muted)]">
          {folder ? baseName(folder) : "Monocle"}
        </span>
        <div className="flex items-center gap-0.5">
          <button
            type="button"
            title="Root folder"
            onClick={() => (folder ? setFolderMenu((open) => !open) : chooseFolder())}
            className="grid h-6 w-6 place-items-center rounded text-[var(--text-muted)] hover:bg-[var(--bg-hover)] hover:text-[var(--text)]"
          >
            <FolderIcon />
          </button>
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
        </div>

        {folderMenu && folder && (
          <div className="block-menu" style={{ position: "absolute", right: 8, top: 40 }}>
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
          </div>
        )}
      </div>

      {folder && tree.length > 0 && (
        <div className="px-2 pb-2">
          <input
            ref={searchRef}
            value={query}
            onChange={(event) => setQuery(event.currentTarget.value)}
            placeholder="Search notes"
            className="w-full rounded-[var(--radius)] border border-transparent bg-[var(--bg-active)] px-2 py-1 text-[13px] text-[var(--text)] outline-none placeholder:text-[var(--text-faint)] focus:border-[var(--accent)]"
          />
        </div>
      )}

      <nav className="flex-1 overflow-y-auto px-2 pb-3">
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
          onToggle={toggleDir}
          onOpen={(path) => void openNote(path)}
          onRename={(path, name) => void renameNote(path, name)}
          onDelete={(path) => void deleteNote(path)}
        />
      </nav>

      <div
        onMouseDown={(event) => startResize(event.clientX)}
        className="absolute right-0 top-0 z-20 h-full w-1 translate-x-1/2 cursor-col-resize hover:bg-[var(--accent)]"
        aria-hidden
      />
    </aside>
  );
}
