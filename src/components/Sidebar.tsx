import { revealItemInDir } from "@tauri-apps/plugin-opener";
import {
  useEffect,
  useDeferredValue,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import { useStore, type Favorite } from "../store/useStore";
import { SEARCH_LIMIT, SEARCH_MIN, searchTree } from "../lib/fs";
import { SIDEBAR, clampWidth, readWidth, storeWidth } from "../lib/layout";
import { scrollDelta } from "../lib/scroll";
import { stepRow, visibleRows, type TreeRow } from "../lib/treeNav";
import { baseName, findNode, foldTree, parentDir, placeOf } from "../lib/treeView";
import { copyPathReference } from "../lib/agentActions";
import type { TreeNode } from "../types";
import { ContextMenu, type MenuItem } from "./ContextMenu";
import { FileTree, renameTarget } from "./FileTree";
import {
  ArrowDownIcon,
  ArrowUpIcon,
  ChevronsDownUp,
  CopyIcon,
  FileTextIcon,
  FolderIcon,
  FolderPlusIcon,
  MinusCircleIcon,
  PlusIcon,
  SquarePenIcon,
  RevealGlyph,
  SearchGlyph,
  StarIcon,
  StarOffIcon,
  TrashGlyph,
  TypeIcon,
  XIcon,
} from "./icons";
import { PaneToggle } from "./PaneToggle";
import { TrafficLightsSlot } from "./TrafficLightsSlot";
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

/**
 * The foot of the sidebar: "Add place…" opens the system folder picker, and
 * the button beside it folds every open folder shut. There is no "expand all":
 * with every folder listed, it would draw thousands of rows at once.
 */
function PlacesBar() {
  const chooseFolder = useStore((s) => s.chooseFolder);
  const expanded = useStore((s) => s.expanded);
  const collapseAll = useStore((s) => s.collapseAll);
  const anyExpanded = expanded.size > 0;

  return (
    <div
      data-places-bar
      className="foot-enter relative flex shrink-0 items-center gap-1 border-t border-[var(--border)] p-2"
    >
      <button
        type="button"
        title="Add a folder to the sidebar"
        data-add-place-button
        onClick={() => void chooseFolder()}
        className="flex h-8 min-w-0 flex-1 items-center gap-2 rounded-[var(--radius)] px-2 text-left text-[13px] text-[var(--text-muted)] hover:bg-[var(--bg-hover)] hover:text-[var(--accent)]"
      >
        <FolderPlusIcon />
        <span className="min-w-0 flex-1 truncate font-medium">Add place…</span>
      </button>
      <button
        type="button"
        title="Collapse all folders"
        aria-label="Collapse all folders"
        data-fold-all
        disabled={!anyExpanded}
        onClick={collapseAll}
        className="grid size-8 shrink-0 place-items-center rounded-[var(--radius)] text-[var(--text-muted)] hover:bg-[var(--bg-hover)] hover:text-[var(--accent)] disabled:pointer-events-none disabled:opacity-40"
      >
        <ChevronsDownUp />
      </button>
    </div>
  );
}

export function Sidebar() {
  const places = useStore((s) => s.places);
  const collapsedPlaces = useStore((s) => s.collapsedPlaces);
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
  const addPlace = useStore((s) => s.addPlace);
  const removePlace = useStore((s) => s.removePlace);
  const movePlace = useStore((s) => s.movePlace);
  const favorites = useStore((s) => s.favorites);
  const toggleFavorite = useStore((s) => s.toggleFavorite);
  const createFolder = useStore((s) => s.createFolder);
  const toggleDir = useStore((s) => s.toggleDir);
  const requestEditorFocus = useStore((s) => s.requestEditorFocus);
  const leftOpen = useStore((s) => s.leftOpen);
  const toggleLeft = useStore((s) => s.toggleLeft);

  const [query, setQuery] = useState("");
  const [rowMenu, setRowMenu] = useState<{
    node: TreeNode;
    x: number;
    y: number;
  } | null>(null);
  const [width, setWidth] = useState(() => readWidth(SIDEBAR, localStorage));
  const [resizing, setResizing] = useState(false);
  // The row the keyboard is on, and the row the ⌘P search is on. They are
  // separate: while the search box has focus the tree cannot take focus, so
  // the search carries its own highlight.
  const [focusedPath, setFocusedPath] = useState<string | null>(null);
  const [highlight, setHighlight] = useState<string | null>(null);
  // WebKit focuses the first row on its own at launch; the brass ring is for
  // the keyboard, so it follows the last input rather than focus alone.
  const [keyboardRing, setKeyboardRing] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  useEffect(() => {
    if (searchOpen) searchRef.current?.focus();
  }, [searchOpen]);
  function closeSearch() {
    setQuery("");
    setSearchOpen(false);
  }
  const navRef = useRef<HTMLElement>(null);

  useEffect(() => {
    storeWidth(SIDEBAR, localStorage, width);
  }, [width]);

  function startResize(startX: number) {
    const startWidth = width;
    setResizing(true);
    function onMove(event: MouseEvent) {
      const next = startWidth + (event.clientX - startX);
      setWidth(clampWidth(next, SIDEBAR.min, SIDEBAR.max));
    }
    function onUp() {
      setResizing(false);
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
        searchRef.current?.focus();
        searchRef.current?.select();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  // Typing updates the box at once; the filter follows a beat behind, so a
  // large tree never holds up the keys.
  // Below SEARCH_MIN characters the tree stays as it is.
  const deferred = useDeferredValue(query);
  const deferredQuery = deferred.trim().length >= SEARCH_MIN ? deferred : "";
  const tooShort = query.trim().length > 0 && query.trim().length < SEARCH_MIN;
  const search = useMemo(() => searchTree(tree, deferredQuery), [tree, deferredQuery]);
  const filtered = search.nodes;
  // The sidebar draws the folded tree: single-child folders merge into one row.
  const shown = useMemo(() => foldTree(filtered), [filtered]);
  const searching = deferredQuery.trim().length > 0;
  // While searching, the folders leading to a matching file open; the user can
  // still open or shut any folder, remembered until the query changes.
  const [searchToggled, setSearchToggled] = useState<Set<string>>(new Set());
  useEffect(() => {
    setSearchToggled(new Set());
  }, [deferredQuery]);
  const effectiveExpanded = useMemo(() => {
    // Places start open: they are open unless folded shut.
    if (!searching) {
      return new Set([...expanded, ...places.filter((p) => !collapsedPlaces.has(p))]);
    }
    const open = new Set([...search.open].filter((p) => !searchToggled.has(p)));
    for (const p of searchToggled) if (!search.open.has(p)) open.add(p);
    return open;
  }, [searching, expanded, search, searchToggled, places, collapsedPlaces]);
  const toggleRow = (path: string) => {
    if (!searching) {
      toggleDir(path);
      return;
    }
    setSearchToggled((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  };
  const rows = useMemo(
    () => visibleRows(shown, { expanded: effectiveExpanded }),
    [shown, effectiveExpanded],
  );
  const files = useMemo(
    () => rows.filter((row) => row.kind === "file"),
    [rows],
  );
  // ⌘P with nothing typed lists the starred notes, so the ones you go back to
  // are an arrow and Enter away. Stars whose file is gone are left out.
  const starred = useMemo(
    () =>
      favorites
        .map((favorite) => findNode(tree, favorite.path))
        .filter((node): node is TreeNode => node !== null),
    [favorites, tree],
  );
  const showStarred = searchOpen && query.trim().length === 0 && starred.length > 0;
  // What the arrows and Enter move through: the stars, or the matches.
  const picks = useMemo<TreeRow[]>(
    () =>
      showStarred
        ? starred.map((node) => ({ path: node.path, kind: node.kind, depth: 0, open: false, parent: null }))
        : files,
    [showStarred, starred, files],
  );
  // A value to depend on: the results, as one string.
  const pickKey = picks.map((row) => row.path).join("\n");

  useEffect(() => {
    // A new set of results starts on its first note.
    setHighlight(searching || showStarred ? (picks[0]?.path ?? null) : null);
  }, [searching, showStarred, pickKey]);

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
    // The name shows the folder's page and leaves the tree as it is; the
    // chevron (or a double-click) is what expands.
    await openFolder(node.openPath ?? node.path, false);
  }

  function moveTo(row: TreeRow) {
    setFocusedPath(row.path);
    rowElement(navRef.current, row.path)?.focus({ preventScroll: true });
    revealRow(navRef.current, row.path);
  }

  function favoriteItem(path: string, kind: Favorite["kind"]): MenuItem {
    const starred = favorites.some((f) => f.path === path);
    return {
      label: starred ? "Remove from favorites" : "Add to favorites",
      icon: starred ? <StarOffIcon className="size-4" /> : <StarIcon className="size-4" />,
      onSelect: () => toggleFavorite(path, kind),
    };
  }

  function menuItems(node: TreeNode): MenuItem[] {
    const target = renameTarget(node);
    if (node.place) {
      const index = places.indexOf(node.path);
      return [
        {
          label: "New file here",
          icon: <PlusIcon className="size-4" />,
          onSelect: () => void createNote(node.path),
        },
        {
          label: "New folder here",
          icon: <FolderPlusIcon className="size-4" />,
          onSelect: () => void createFolder(node.path),
        },
        {
          label: "Reveal in Finder",
          icon: <RevealGlyph className="size-4" />,
          onSelect: () => void revealItemInDir(node.path),
        },
        { separator: true },
        ...(index > 0
          ? [{ label: "Move up", icon: <ArrowUpIcon className="size-4" />, onSelect: () => movePlace(node.path, -1) }]
          : []),
        ...(index < places.length - 1
          ? [{ label: "Move down", icon: <ArrowDownIcon className="size-4" />, onSelect: () => movePlace(node.path, 1) }]
          : []),
        {
          label: "Remove from sidebar",
          icon: <MinusCircleIcon className="size-4" />,
          onSelect: () => removePlace(node.path),
        },
      ];
    }
    if (node.kind === "dir") {
      // A folded `a / b / c` row stars the folder it opens, not the outer one.
      const dir = node.openPath ?? node.path;
      return [
        favoriteItem(dir, "folder"),
        { separator: true },
        {
          label: "New file here",
          icon: <PlusIcon className="size-4" />,
          onSelect: () => void createNote(dir),
        },
        {
          label: "New folder here",
          icon: <FolderPlusIcon className="size-4" />,
          onSelect: () => void createFolder(dir),
        },
        { separator: true },
        {
          label: "Rename",
          icon: <TypeIcon className="size-4" />,
          onSelect: () => startRename(target),
        },
        {
          label: "Add as place",
          icon: <FolderPlusIcon className="size-4" />,
          onSelect: () => void addPlace(dir),
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
      favoriteItem(node.path, "note"),
      { separator: true },
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
    const from =
      target.closest<HTMLElement>("[data-tree-row]")?.dataset.treeRow ??
      focusedPath;
    const focused = rows.find((row) => row.path === from);
    const node = from ? nodeAt(from) : null;

    // F2 renames the selected row; ⌘⌫ moves it to the Trash. A Place header
    // is neither renamed nor trashed from here.
    if ((event.key === "F2" || event.key === "Backspace") && node?.place) return;
    if (event.key === "F2" && node) {
      event.preventDefault();
      startRename(renameTarget(node));
      return;
    }
    if (event.key === "Backspace" && (event.metaKey || event.ctrlKey) && node) {
      event.preventDefault();
      void trashEntry(
        node.kind === "dir" ? (node.openPath ?? node.path) : node.path,
      );
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
    const step = stepRow(rows, index, event.key, { canToggle: true });
    if (!step) return;
    const row = rows[step.index];
    if (!row) return;
    event.preventDefault();
    if (step.toggle) {
      toggleRow(row.path);
      return;
    }
    // Arrows move; they never open.
    moveTo(row);
  }

  function onSearchKeyDown(event: ReactKeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") {
      closeSearch();
      return;
    }
    if (event.key === "Enter") {
      const target = highlight ?? picks[0]?.path;
      if (!target) return;
      event.preventDefault();
      if (showStarred) {
        const node = starred.find((n) => n.path === target);
        if (node?.kind === "dir") {
          void openFolder(node.path, false);
          return;
        }
      }
      void openNote(target).then(() => {
        // Only take the caret if the note actually opened.
        if (useStore.getState().activePath === target) requestEditorFocus();
      });
      return;
    }
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
    const index = picks.findIndex((row) => row.path === highlight);
    const step = stepRow(picks, index, event.key, { canToggle: false });
    if (!step) return;
    event.preventDefault();
    const row = picks[step.index];
    if (row) setHighlight(row.path);
  }

  return (
    // Collapsed, not unmounted: the search box and the tree's focus survive. The
    // aside animates its width; the content keeps its own, so it slides under
    // the edge instead of squashing.
    <aside
      className="relative h-full shrink-0 bg-[var(--bg-sidebar)] motion-reduce:!transition-none"
      style={{
        width: leftOpen ? width : 0,
        visibility: leftOpen ? "visible" : "hidden",
        transition: resizing
          ? "none"
          : `width 200ms ease, visibility 0s linear ${leftOpen ? 0 : 200}ms`,
      }}
      aria-hidden={!leftOpen}
      inert={!leftOpen}
    >
      <div className="h-full overflow-hidden">
        <div className="flex h-full flex-col" style={{ width }}>
          {/* The window row, 40px like the note's toolbar beside it. The traffic
          lights are drawn over its left end. */}
          <div className="relative flex h-10 shrink-0 items-center justify-start gap-0.5 px-3">
            <div data-tauri-drag-region className="absolute inset-0" />
            <div className="relative">
              <TrafficLightsSlot />
            </div>
            <div className="relative">
              <PaneToggle side="left" open onClick={toggleLeft} />
            </div>
          </div>

          {places.length > 0 && (
            <div className="px-2 pb-2 pt-2">
              {/* Searching shows only the search and its results. */}
              {!searching && !showStarred && (
                <button
                  type="button"
                  data-new-note
                  title="New note (⌘N)"
                  onClick={() => void createNote()}
                  className="mb-0.5 flex h-8 w-full items-center gap-2 rounded-[var(--radius)] px-2 text-left text-[13px] text-[var(--text-muted)] hover:bg-[var(--bg-hover)] hover:text-[var(--accent)]"
                >
                  <SquarePenIcon className="size-4 shrink-0" />
                  <span className="min-w-0 flex-1 truncate">New note</span>
                  <kbd className="font-sans text-[11px] text-[var(--text-faint)]">⌘N</kbd>
                </button>
              )}
              {!searchOpen ? (
                <button
                  type="button"
                  data-search-button
                  title="Search (⌘P)"
                  onClick={() => setSearchOpen(true)}
                  className="flex h-8 w-full items-center gap-2 rounded-[var(--radius)] px-2 text-left text-[13px] text-[var(--text-muted)] hover:bg-[var(--bg-hover)] hover:text-[var(--accent)]"
                >
                  <SearchGlyph className="size-4 shrink-0" />
                  <span className="min-w-0 flex-1 truncate">Search</span>
                </button>
              ) : (
                <div className="flex items-center gap-1">
                  <div className="relative min-w-0 flex-1">
                    <SearchGlyph className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-[var(--text-faint)]" />
                    <input
                      ref={searchRef}
                      data-search
                      spellCheck={false}
                      autoCorrect="off"
                      autoCapitalize="off"
                      autoComplete="off"
                      value={query}
                      onChange={(event) => setQuery(event.currentTarget.value)}
                      onKeyDown={onSearchKeyDown}
                      placeholder="Search"
                      aria-label="Search"
                      className="h-8 w-full rounded-[var(--radius)] border border-transparent bg-[var(--bg-active)] pl-8 pr-8 text-[13px] text-[var(--text)] outline-none placeholder:text-[var(--text-faint)] focus:border-[var(--accent)]"
                    />
                    {query && (
                      <button
                        type="button"
                        title="Clear search"
                        aria-label="Clear search"
                        data-search-clear
                        onClick={() => {
                          setQuery("");
                          searchRef.current?.focus();
                        }}
                        className="absolute right-1 top-1/2 grid size-6 -translate-y-1/2 place-items-center rounded text-[var(--text-muted)] hover:bg-[var(--bg-hover)] hover:text-[var(--text)]"
                      >
                        <XIcon className="size-3.5" />
                      </button>
                    )}
                  </div>
                  <button
                    type="button"
                    data-search-close
                    onClick={closeSearch}
                    className="h-8 shrink-0 rounded-[var(--radius)] px-2 text-[13px] font-medium text-[var(--text-muted)] hover:bg-[var(--bg-hover)] hover:text-[var(--text)]"
                  >
                    Close
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Starred notes, above Places; only shown once something is starred. */}
          {favorites.length > 0 && !loading && !searching && !showStarred && (
            <div data-favorites className="shrink-0 px-2 pb-2">
              <div className="px-2 pb-1 pt-1 text-[11px] font-semibold uppercase leading-[14px] tracking-[0.06em] text-[var(--text-muted)]">
                Favorites
              </div>
              <div className="flex max-h-[30vh] flex-col gap-0.5 overflow-y-auto">
                {favorites.map(({ path, kind }) => {
                  const isFolder = kind === "folder";
                  const active = isFolder ? path === folderPage && !activePath : path === activePath;
                  // A folder's page lists what the tree holds, so a folder
                  // outside every Place (its Place was removed) has nothing to
                  // show. A note still opens by path.
                  const missing = isFolder && !placeOf(places, path);
                  const node: TreeNode = isFolder
                    ? (findNode(tree, path) ?? { name: baseName(path), path, kind: "dir", children: [] })
                    : { name: baseName(path), path, kind: "file" };
                  return (
                    <button
                      key={path}
                      type="button"
                      data-favorite={path}
                      data-favorite-kind={kind}
                      title={missing ? `${path} (not in any place)` : path}
                      disabled={missing}
                      onClick={() => void (isFolder ? openFolder(path, false) : openNote(path))}
                      onContextMenu={(event) => {
                        event.preventDefault();
                        if (missing) {
                          // Only unstarring makes sense for a folder that is gone.
                          toggleFavorite(path, kind);
                          return;
                        }
                        setRowMenu({ node, x: event.clientX, y: event.clientY });
                      }}
                      className={`flex h-8 w-full items-center gap-2 rounded-[var(--radius)] px-2 text-left text-[13px] disabled:text-[var(--text-faint)] ${
                        active
                          ? "bg-[var(--bg-active)] font-medium text-[var(--text)]"
                          : "text-[var(--text-muted)] hover:bg-[var(--bg-hover)] hover:text-[var(--text)]"
                      }`}
                    >
                      {isFolder ? (
                        <FolderIcon className="size-3.5 shrink-0 text-[var(--text-faint)]" />
                      ) : (
                        <FileTextIcon className="size-4 shrink-0 text-[var(--text-faint)]" />
                      )}
                      <span className="min-w-0 flex-1 truncate">{baseName(path)}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* The label heads the full list and stays put while it scrolls;
              while searching, the results stand alone. */}
          {showStarred && (
            <div
              data-search-favorites-label
              className="shrink-0 px-4 pb-1 pt-1 text-[11px] font-semibold uppercase leading-[14px] tracking-[0.06em] text-[var(--text-muted)]"
            >
              Favorites
            </div>
          )}
          {places.length > 0 && !loading && !searching && !showStarred && (
            <div
              data-places-label
              className="shrink-0 px-4 pb-1 pt-1 text-[11px] font-semibold uppercase leading-[14px] tracking-[0.06em] text-[var(--text-muted)]"
            >
              Places
            </div>
          )}

          <nav
            ref={navRef}
            onKeyDown={onTreeKeyDown}
            className="flex-1 overflow-y-auto px-2 pb-3"
          >
            {places.length > 0 && error && (
              <p className="mx-1 mb-2 rounded-[var(--radius)] bg-[var(--bg-active)] px-2 py-1.5 text-[12px] leading-snug text-[var(--danger)] [overflow-wrap:anywhere]">
                {error}
              </p>
            )}
            {places.length === 0 && (
              <div data-no-places className="px-2 py-6 text-center text-[13px] text-[var(--text-faint)]">
                <p>No places yet</p>
                <p className="mt-1">Add a folder that holds your notes.</p>
              </div>
            )}
            {places.length > 0 && loading && (
              <p className="px-2 py-6 text-center text-[13px] text-[var(--text-faint)]">
                Scanning…
              </p>
            )}
            {tooShort && (
              <p data-search-short className="px-2 pb-2 text-[12px] text-[var(--text-faint)]">
                Type one more letter to search.
              </p>
            )}
            {places.length > 0 && !loading && searching && filtered.length === 0 && (
              <div data-no-matches className="px-3 pt-6 text-center">
                <p className="text-[13px] font-medium text-[var(--text-muted)] [overflow-wrap:anywhere]">
                  No file or folder named “{deferredQuery.trim()}”
                </p>
                <p className="mt-1 text-[12px] leading-[18px] text-[var(--text-faint)]">
                  Check the spelling, or try fewer letters.
                </p>
                <button
                  type="button"
                  data-no-matches-clear
                  onClick={() => {
                    setQuery("");
                    searchRef.current?.focus();
                  }}
                  className="mt-3 h-7 rounded-[var(--radius)] px-2.5 text-[12px] font-medium text-[var(--text-muted)] hover:bg-[var(--bg-hover)] hover:text-[var(--text)]"
                >
                  Clear search
                </button>
              </div>
            )}

            {showStarred && (
              <ul data-search-favorites role="listbox" aria-label="Favorites">
                {starred.map((node) => (
                  <li
                    key={node.path}
                    role="option"
                    aria-selected={node.path === highlight}
                    data-search-favorite={node.path}
                    data-kind={node.kind}
                    // The search box keeps the focus, so a click mustn't take it.
                    onMouseDown={(event) => event.preventDefault()}
                    onMouseEnter={() => setHighlight(node.path)}
                    onClick={() => {
                      if (node.kind === "dir") void openFolder(node.path, false);
                      else void openNote(node.path);
                    }}
                    className={`flex h-8 cursor-default items-center gap-2 rounded-[var(--radius)] px-2 text-[13px] ${
                      node.path === highlight
                        ? "bg-[var(--bg-hover)] text-[var(--text)]"
                        : "text-[var(--text-muted)]"
                    }${node.path === activePath ? " font-medium" : ""}`}
                  >
                    {node.kind === "dir" ? (
                      <FolderIcon className="size-3.5 shrink-0" />
                    ) : (
                      <FileTextIcon className="size-4 shrink-0 text-[var(--text-faint)]" />
                    )}
                    <span className="min-w-0 shrink truncate">{node.name}</span>
                    <span className="min-w-0 flex-1 truncate text-[12px] text-[var(--text-faint)]">
                      {baseName(parentDir(node.path))}
                    </span>
                  </li>
                ))}
              </ul>
            )}

            {!showStarred && (
            <FileTree
              nodes={shown}
              activePath={activePath}
              folderPage={folderPage}
              expanded={effectiveExpanded}
              forceExpand={false}
              tabbablePath={focusedPath ?? activePath}
              highlightPath={highlight}
              keyboardRing={keyboardRing}
              renamingPath={renamingPath}
              changes={changes}
              onToggle={toggleRow}
              onOpenFolder={(node) => void openFolderRow(node)}
              onOpen={(path) => {
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
              onNewNote={(dir) => void createNote(dir)}
            />
            )}
            {searching && search.capped && (
              <p data-search-capped className="px-2 py-3 text-center text-[12px] text-[var(--text-faint)]">
                Showing the first {SEARCH_LIMIT} matches. Type more to narrow it down.
              </p>
            )}
          </nav>

          {/* Searching is about finding what is here: the foot bar steps aside. */}
          {!searching && !showStarred && <PlacesBar />}

          {rowMenu && (
            <ContextMenu
              x={rowMenu.x}
              y={rowMenu.y}
              items={menuItems(rowMenu.node)}
              onClose={() => setRowMenu(null)}
            />
          )}
        </div>
      </div>

      {leftOpen && (
        <ResizeHandle
          style={{ left: "100%" }}
          onResizeStart={(event) => startResize(event.clientX)}
          onReset={() => setWidth(SIDEBAR.default)}
        />
      )}
    </aside>
  );
}
