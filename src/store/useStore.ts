import { create } from "zustand";
import { dirname, homeDir } from "@tauri-apps/api/path";
import {
  RIGHT_TABS,
  type ChangeNotice,
  type NoteFile,
  type RightTab,
  type SaveStatus,
  type TreeNode,
  type ViewMode,
} from "../types";
import * as fs from "../lib/fs";
import { bufferMarkdown } from "../lib/editorBuffer";
import {
  CONTENT,
  LEFT_OPEN_KEY,
  RIGHT_OPEN_KEY,
  RIGHT_TAB_KEY,
  clampWidth,
  readOpen,
  readWidth,
  storeOpen,
  storeWidth,
} from "../lib/layout";
import { getStoredTint, storeTint, type Tint } from "../lib/tint";
import { countFiles, findNode, parentDir, trailTo } from "../lib/treeView";
import { DISMISS, askModal, askUnsavedChanges } from "./useModalPrompt";

const LAST_FOLDER_KEY = "monocle:lastFolder";
const SHOW_HIDDEN_KEY = "monocle:showHidden";
const RECENT_ROOTS_KEY = "monocle:recentRoots";
const VIEW_KEY = "monocle:view";
const EXPANDED_KEY = "monocle:expanded:";
export const MAX_RECENT_ROOTS = 4;

type HeadingRequest = { line: number; index: number; n: number };

type State = {
  /** The root folder. The tree shows only what is inside it. */
  folder: string | null;
  home: string | null;
  recentRoots: string[];
  tree: TreeNode[];
  notes: NoteFile[];
  expanded: Set<string>;
  selectedDir: string | null;
  /** The folder whose page is open in the centre, if any. */
  folderPage: string | null;
  activePath: string | null;
  activeContent: string;
  // Bumped whenever activeContent is (re)loaded into the editor. Renames
  // change activePath without bumping it, so they don't reset the buffer.
  loadId: number;
  status: SaveStatus;
  error: string | null;
  loading: boolean;
  // Whether the tree includes hidden (dot-prefixed) files and folders. Off by
  // default and remembered across launches, like the last folder.
  showHidden: boolean;
  // The editor column's width. Live state, not a ref, because two controls
  // drive it: the column's drag handles and the slider in Settings.
  contentWidth: number;
  // The page's tint, app-wide and remembered.
  tint: Tint;
  // Bumped to ask the editor to take focus.
  editorFocusRequest: number;
  leftOpen: boolean;
  rightOpen: boolean;
  rightTab: RightTab;
  view: ViewMode;
  settingsOpen: boolean;
  /** The row being renamed in the tree, if any. */
  renamingPath: string | null;
  /** Folders made in the app: they stay in the tree while empty. */
  madeDirs: Set<string>;
  /** The open note's text as it is now, for tokens, the outline and checks. */
  liveText: string;
  /** What the open note's file held when we last read or wrote it. */
  diskText: string;
  /** Outside edits not yet reviewed, by path. */
  changes: Record<string, ChangeNotice>;
  headingRequest: HeadingRequest;
  toggleLeft: () => void;
  toggleRight: () => void;
  setRightTab: (tab: RightTab) => void;
  setView: (view: ViewMode) => void;
  openSettings: () => void;
  closeSettings: () => void;
  init: () => Promise<void>;
  chooseFolder: () => Promise<void>;
  setRoot: (path: string) => Promise<void>;
  refresh: (silent?: boolean) => Promise<void>;
  toggleDir: (path: string) => void;
  expandTo: (path: string) => void;
  collapseAll: () => void;
  expandAll: () => void;
  openNote: (path: string) => Promise<void>;
  openFolder: (path: string) => Promise<void>;
  openExternalNote: (path: string) => Promise<void>;
  createNote: (dir?: string) => Promise<void>;
  createFolder: (dir?: string) => Promise<void>;
  startRename: (path: string | null) => void;
  renameNote: (path: string, name: string) => Promise<void>;
  renameEntry: (path: string, name: string) => Promise<void>;
  trashEntry: (path: string) => Promise<void>;
  markDirty: () => void;
  save: (markdown: string) => Promise<void>;
  setError: (message: string | null) => void;
  setShowHidden: (value: boolean) => Promise<void>;
  setContentWidth: (value: number) => void;
  setTint: (tint: Tint) => void;
  requestEditorFocus: () => void;
  setLiveText: (text: string) => void;
  goToHeading: (line: number, index: number) => void;
  handleFsChange: (paths: string[]) => Promise<void>;
  keepChange: (path: string) => Promise<void>;
  revertChange: (path: string) => Promise<void>;
};

function readRightTab(store: Storage): RightTab {
  try {
    const saved = store.getItem(RIGHT_TAB_KEY);
    return RIGHT_TABS.includes(saved as RightTab) ? (saved as RightTab) : "outline";
  } catch {
    return "outline";
  }
}

function readView(store: Storage): ViewMode {
  try {
    const saved = store.getItem(VIEW_KEY);
    return saved === "source" || saved === "split" ? saved : "rich";
  } catch {
    return "rich";
  }
}

function readRecentRoots(): string[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(RECENT_ROOTS_KEY) ?? "[]");
    return Array.isArray(parsed)
      ? parsed.filter((p): p is string => typeof p === "string").slice(0, MAX_RECENT_ROOTS)
      : [];
  } catch {
    return [];
  }
}

function readExpanded(root: string): Set<string> {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(EXPANDED_KEY + root) ?? "[]");
    return new Set(
      Array.isArray(parsed) ? parsed.filter((p): p is string => typeof p === "string") : [],
    );
  } catch {
    return new Set();
  }
}

function storeExpanded(root: string | null, expanded: Set<string>): void {
  if (!root) return;
  try {
    localStorage.setItem(EXPANDED_KEY + root, JSON.stringify([...expanded]));
  } catch {
    // Not remembered; the tree still works.
  }
}

/** `path` moved from `from` to `to`: where it is now. */
function rebase(path: string | null, from: string, to: string): string | null {
  if (!path) return path;
  if (path === from) return to;
  return path.startsWith(`${from}/`) ? to + path.slice(from.length) : path;
}

function isWithin(path: string | null, dir: string): boolean {
  return Boolean(path) && (path === dir || path!.startsWith(`${dir}/`));
}

function noteLabel(path: string | null): string | null {
  if (!path) return null;
  return path.split(/[\\/]/).pop() || null;
}

// What each note held the last time we read or wrote it, so an outside edit to
// a note that is not open can still be shown as a diff.
const lastSeen = new Map<string, string>();

/**
 * Settle unsaved edits before replacing or closing the open note. Returns
 * whether the caller may proceed. Choosing "save" saves the editor's buffer, and
 * a failed save holds the note open rather than dropping the edits.
 */
async function confirmDiscard(): Promise<boolean> {
  const state = useStore.getState();
  const choice = await askUnsavedChanges(noteLabel(state.activePath));
  if (choice === DISMISS) return false;
  if (choice === "discard") return true;
  const markdown = bufferMarkdown();
  // No editor mounted means nothing can write the buffer: keep the note.
  if (markdown === null) return false;
  await state.save(markdown);
  return useStore.getState().status !== "error";
}

async function startWatching(root: string): Promise<void> {
  try {
    await fs.startWatch(root);
  } catch {
    // Not running under Tauri, or the folder can't be watched: the tree still
    // works, it just doesn't update by itself.
  }
}

export const useStore = create<State>((set, get) => ({
  folder: null,
  home: null,
  recentRoots: readRecentRoots(),
  tree: [],
  notes: [],
  expanded: new Set<string>(),
  selectedDir: null,
  folderPage: null,
  activePath: null,
  activeContent: "",
  loadId: 0,
  status: "idle",
  error: null,
  loading: false,
  showHidden: false,
  // Read once at module load so the column and the tint are right on the very
  // first paint, before init() runs.
  contentWidth: readWidth(CONTENT, localStorage),
  tint: getStoredTint(),
  editorFocusRequest: 0,
  leftOpen: readOpen(LEFT_OPEN_KEY, localStorage),
  rightOpen: readOpen(RIGHT_OPEN_KEY, localStorage),
  rightTab: readRightTab(localStorage),
  view: readView(localStorage),
  settingsOpen: false,
  renamingPath: null,
  madeDirs: new Set<string>(),
  liveText: "",
  diskText: "",
  changes: {},
  headingRequest: { line: 0, index: 0, n: 0 },

  toggleLeft: () => {
    const open = !get().leftOpen;
    storeOpen(LEFT_OPEN_KEY, localStorage, open);
    set({ leftOpen: open });
  },

  toggleRight: () => {
    const open = !get().rightOpen;
    storeOpen(RIGHT_OPEN_KEY, localStorage, open);
    set({ rightOpen: open });
  },

  setRightTab: (tab) => {
    try {
      localStorage.setItem(RIGHT_TAB_KEY, tab);
    } catch {
      // Not remembered; the tab still switches.
    }
    set({ rightTab: tab });
  },

  setView: (view) => {
    try {
      localStorage.setItem(VIEW_KEY, view);
    } catch {
      // Not remembered; the view still switches.
    }
    set({ view });
  },

  openSettings: () => set({ settingsOpen: true }),
  closeSettings: () => set({ settingsOpen: false }),

  init: async () => {
    const showHidden = localStorage.getItem(SHOW_HIDDEN_KEY) === "1";
    set({ showHidden });
    let home: string | null = null;
    try {
      home = await homeDir();
    } catch {
      home = null;
    }
    // First launch opens the home folder; after that, wherever it was left.
    const folder = localStorage.getItem(LAST_FOLDER_KEY) ?? home;
    set({ home });
    if (!folder) return;
    set({
      folder,
      expanded: readExpanded(folder),
      folderPage: null,
    });
    await get().refresh();
    void startWatching(folder);
  },

  chooseFolder: async () => {
    try {
      const folder = await fs.pickFolder();
      if (folder) await get().setRoot(folder);
    } catch (error) {
      set({ error: String(error) });
    }
  },

  // Changing the root never closes the open note, even when the note is now
  // outside the tree.
  setRoot: async (path) => {
    const { folder, recentRoots, activePath } = get();
    if (path === folder) return;
    localStorage.setItem(LAST_FOLDER_KEY, path);
    const recent = [folder, ...recentRoots]
      .filter((p): p is string => Boolean(p) && p !== path)
      .filter((p, i, all) => all.indexOf(p) === i)
      .slice(0, MAX_RECENT_ROOTS);
    try {
      localStorage.setItem(RECENT_ROOTS_KEY, JSON.stringify(recent));
    } catch {
      // Not remembered.
    }
    set({
      folder: path,
      recentRoots: recent,
      tree: [],
      notes: [],
      expanded: readExpanded(path),
      selectedDir: null,
      madeDirs: new Set<string>(),
      // With a note open it stays; with nothing open, show the new root.
      folderPage: activePath ? null : path,
    });
    await get().refresh();
    void startWatching(path);
  },

  refresh: async (silent = false) => {
    const { folder, showHidden, madeDirs } = get();
    if (!folder) return;
    if (!silent) set({ loading: true });
    try {
      const tree = await fs.readTree(folder, showHidden, madeDirs);
      set({ tree, notes: fs.flattenTree(tree), error: null, loading: false });
    } catch (error) {
      set({ error: String(error), loading: false });
    }
  },

  setShowHidden: async (value) => {
    localStorage.setItem(SHOW_HIDDEN_KEY, value ? "1" : "0");
    set({ showHidden: value });
    await get().refresh();
  },

  // Both controls land here, so the bounds and the stored value stay in one
  // place: the drag handles clamp as they move, the slider clamps on change.
  setContentWidth: (value) => {
    const next = clampWidth(Math.round(value), CONTENT.min, CONTENT.max);
    storeWidth(CONTENT, localStorage, next);
    set({ contentWidth: next });
  },

  setTint: (tint) => {
    storeTint(tint);
    set({ tint });
  },

  // The chevron only folds and unfolds: it never changes what is open.
  toggleDir: (path) => {
    const expanded = new Set(get().expanded);
    if (expanded.has(path)) expanded.delete(path);
    else expanded.add(path);
    storeExpanded(get().folder, expanded);
    set({ expanded });
  },

  expandTo: (path) => {
    const { folder } = get();
    if (!folder) return;
    const expanded = new Set(get().expanded);
    for (const dir of trailTo(folder, path)) expanded.add(dir);
    storeExpanded(folder, expanded);
    set({ expanded });
  },

  collapseAll: () => {
    storeExpanded(get().folder, new Set());
    set({ expanded: new Set<string>() });
  },

  expandAll: () => {
    const dirs = new Set<string>();
    function walk(nodes: TreeNode[]) {
      for (const node of nodes) {
        if (node.kind !== "dir") continue;
        dirs.add(node.path);
        if (node.children) walk(node.children);
      }
    }
    walk(get().tree);
    storeExpanded(get().folder, dirs);
    set({ expanded: dirs });
  },

  openNote: async (path) => {
    if (get().status === "dirty" && !(await confirmDiscard())) return;
    try {
      const content = await fs.readNote(path);
      lastSeen.set(path, content);
      const { folder, expanded, changes } = get();
      const next = new Set(expanded);
      if (folder) {
        for (const dir of fs.ancestorDirs(folder, path)) next.add(dir);
        storeExpanded(folder, next);
      }
      // A change we never saw the "before" of has nothing to review.
      const rest = { ...changes };
      if (rest[path] && rest[path].before === null) delete rest[path];
      set({
        activePath: path,
        activeContent: rest[path] ? rest[path].after : content,
        diskText: content,
        liveText: content,
        loadId: get().loadId + 1,
        status: "idle",
        error: null,
        expanded: next,
        folderPage: null,
        selectedDir: null,
        changes: rest,
      });
    } catch (error) {
      set({ error: String(error) });
    }
  },

  openFolder: async (path) => {
    if (get().status === "dirty" && !(await confirmDiscard())) return;
    const { folder, expanded } = get();
    const next = new Set(expanded);
    if (folder && isWithin(path, folder)) {
      for (const dir of trailTo(folder, path)) next.add(dir);
      storeExpanded(folder, next);
    }
    set({
      activePath: null,
      activeContent: "",
      diskText: "",
      liveText: "",
      loadId: get().loadId + 1,
      status: "idle",
      folderPage: path,
      selectedDir: path,
      expanded: next,
    });
  },

  openExternalNote: async (path) => {
    const { folder } = get();
    if (!folder || !fs.isInside(folder, path)) {
      if (get().status === "dirty" && !(await confirmDiscard())) return;
      const dir = await dirname(path);
      await get().setRoot(dir);
    } else if (!get().notes.some((note) => note.path === path)) {
      // A file the last scan didn't see opens fine by path, but rescan first
      // so it shows up in the sidebar too.
      await get().refresh();
    }
    await get().openNote(path);
    // Opened from outside the app: the user came here to write in it.
    if (get().activePath === path) get().requestEditorFocus();
  },

  createNote: async (dir) => {
    const { folder, selectedDir, folderPage, activePath } = get();
    if (!folder) return;
    if (get().status === "dirty" && !(await confirmDiscard())) return;
    // Inside the selected folder, or next to the open file, or in the root.
    const next =
      dir ??
      folderPage ??
      selectedDir ??
      (activePath ? parentDir(activePath) : folder);
    const target = isWithin(next, folder) ? next : folder;
    try {
      const path = await fs.createNoteFile(target);
      lastSeen.set(path, "");
      const expanded = new Set(get().expanded);
      for (const d of trailTo(folder, target)) expanded.add(d);
      storeExpanded(folder, expanded);
      await get().refresh();
      set({
        activePath: path,
        activeContent: "",
        diskText: "",
        liveText: "",
        loadId: get().loadId + 1,
        status: "idle",
        folderPage: null,
        selectedDir: null,
        expanded,
        // The name is the first thing to set, so the row opens for typing.
        renamingPath: path,
      });
    } catch (error) {
      set({ error: String(error) });
    }
  },

  createFolder: async (dir) => {
    const { folder, selectedDir, folderPage, activePath } = get();
    if (!folder) return;
    const next =
      dir ??
      folderPage ??
      selectedDir ??
      (activePath ? parentDir(activePath) : folder);
    const target = isWithin(next, folder) ? next : folder;
    try {
      const path = await fs.createDirectory(target);
      const madeDirs = new Set(get().madeDirs).add(path);
      const expanded = new Set(get().expanded);
      for (const d of trailTo(folder, target)) expanded.add(d);
      storeExpanded(folder, expanded);
      set({ madeDirs, expanded });
      await get().refresh();
      set({ renamingPath: path });
    } catch (error) {
      set({ error: String(error) });
    }
  },

  startRename: (path) => set({ renamingPath: path }),

  renameNote: async (path, name) => {
    try {
      const newPath = await fs.renameNoteFile(path, name);
      const seen = lastSeen.get(path);
      if (seen !== undefined) {
        lastSeen.delete(path);
        lastSeen.set(newPath, seen);
      }
      await get().refresh();
      if (get().activePath === path) set({ activePath: newPath });
      if (get().renamingPath === path) set({ renamingPath: null });
    } catch (error) {
      set({ error: String(error), renamingPath: null });
    }
  },

  renameEntry: async (path, name) => {
    const node = findNode(get().tree, path);
    if (node?.kind !== "dir") {
      await get().renameNote(path, name);
      return;
    }
    try {
      const to = await fs.renameDirectory(path, name);
      if (to === path) {
        set({ renamingPath: null });
        return;
      }
      const state = get();
      const expanded = new Set([...state.expanded].map((p) => rebase(p, path, to)!));
      const madeDirs = new Set([...state.madeDirs].map((p) => rebase(p, path, to)!));
      storeExpanded(state.folder, expanded);
      set({
        expanded,
        madeDirs,
        activePath: rebase(state.activePath, path, to),
        folderPage: rebase(state.folderPage, path, to),
        selectedDir: rebase(state.selectedDir, path, to),
        renamingPath: null,
      });
      await get().refresh();
    } catch (error) {
      set({ error: String(error), renamingPath: null });
    }
  },

  // Everything goes to the system Trash, so nothing is lost for good.
  trashEntry: async (path) => {
    const { folder, tree } = get();
    if (!folder || path === folder) return;
    const node = findNode(tree, path);
    const count = node ? countFiles(node) : 0;
    // A file goes straight away; a folder with files in it asks first.
    if (node?.kind === "dir" && count > 0) {
      const choice = await askModal<"trash">({
        title: "Move to Trash",
        body: `"${noteLabel(path)}" and the ${count} ${
          count === 1 ? "file" : "files"
        } inside it will be moved to the Trash.`,
        actions: [{ value: "trash", label: "Move to Trash", tone: "danger" }],
        dismissLabel: "Cancel",
      });
      if (choice !== "trash") return;
    }
    try {
      await fs.trashPath(path);
      const state = get();
      const madeDirs = new Set([...state.madeDirs].filter((p) => !isWithin(p, path)));
      const expanded = new Set([...state.expanded].filter((p) => !isWithin(p, path)));
      storeExpanded(folder, expanded);
      const changes = Object.fromEntries(
        Object.entries(state.changes).filter(([p]) => !isWithin(p, path)),
      );
      set({ madeDirs, expanded, changes });
      // If what was open went with it, show the parent folder's page.
      const gone = isWithin(state.activePath, path) || isWithin(state.folderPage, path);
      await get().refresh();
      if (gone) {
        set({
          activePath: null,
          activeContent: "",
          diskText: "",
          liveText: "",
          loadId: get().loadId + 1,
          status: "idle",
          folderPage: isWithin(parentDir(path), folder) ? parentDir(path) : folder,
          selectedDir: null,
        });
      }
    } catch (error) {
      set({ error: String(error) });
    }
  },

  markDirty: () => set({ status: "dirty" }),

  requestEditorFocus: () =>
    set((state) => ({ editorFocusRequest: state.editorFocusRequest + 1 })),

  // A note that was not edited is never rewritten: when the text equals what
  // is on disk there is nothing to write.
  save: async (markdown) => {
    const { activePath, diskText } = get();
    if (!activePath) return;
    if (markdown === diskText) {
      set({ status: "idle" });
      return;
    }
    set({ status: "saving" });
    try {
      await fs.writeNote(activePath, markdown);
      lastSeen.set(activePath, markdown);
      set({ status: "saved", error: null, diskText: markdown });
    } catch (error) {
      set({ status: "error", error: String(error) });
    }
  },

  setError: (message) => set({ error: message }),

  setLiveText: (text) => set({ liveText: text }),

  goToHeading: (line, index) =>
    set((state) => ({
      headingRequest: { line, index, n: state.headingRequest.n + 1 },
    })),

  // The watcher reports paths that changed under the root. Our own writes are
  // filtered out before they get here.
  handleFsChange: async (paths) => {
    // Only rescan when the tree could have changed: a markdown file, or a
    // folder (no extension) that is visible. Dotfile churn in a home folder
    // must not trigger a scan.
    const { folder, showHidden } = get();
    const relevant = paths.some((p) => {
      const rel = folder && p.startsWith(folder) ? p.slice(folder.length) : p;
      if (!showHidden && rel.split(/[\\/]/).some((part) => part.startsWith("."))) return false;
      return true;
    });
    if (!relevant) return;
    await get().refresh(true);
    const notices: Record<string, ChangeNotice> = {};
    let reload: { path: string; text: string } | null = null;

    for (const path of paths) {
      if (!/\.(md|markdown)$/i.test(path)) continue;
      let text: string;
      try {
        text = await fs.readNote(path);
      } catch {
        continue;
      }
      const state = get();
      if (path === state.activePath) {
        if (text === state.diskText) continue;
        notices[path] = { before: state.diskText, after: text, at: Date.now() };
        // Untouched in the editor: show the new text. With unsaved edits the
        // buffer stays, and the notice offers the choice.
        if (state.status !== "dirty" && state.status !== "saving") {
          reload = { path, text };
        }
      } else {
        const before = lastSeen.get(path) ?? null;
        if (before === text) continue;
        notices[path] = { before, after: text, at: Date.now() };
        lastSeen.set(path, text);
      }
    }

    if (Object.keys(notices).length === 0) return;
    set((state) => ({ changes: { ...state.changes, ...notices } }));
    if (reload) {
      lastSeen.set(reload.path, reload.text);
      set({
        activeContent: reload.text,
        diskText: reload.text,
        liveText: reload.text,
        loadId: get().loadId + 1,
      });
    }
  },

  // Accept the outside edit. If the editor never took it (unsaved edits were
  // in the way) this loads it, replacing those edits.
  keepChange: async (path) => {
    const notice = get().changes[path];
    if (!notice) return;
    const rest = { ...get().changes };
    delete rest[path];
    if (path === get().activePath && get().diskText !== notice.after) {
      lastSeen.set(path, notice.after);
      set({
        changes: rest,
        activeContent: notice.after,
        diskText: notice.after,
        liveText: notice.after,
        loadId: get().loadId + 1,
        status: "idle",
      });
      return;
    }
    set({ changes: rest });
  },

  // Undo the outside edit: put the earlier text back on disk. If the editor
  // still holds unsaved edits, they are saved over the outside edit instead.
  revertChange: async (path) => {
    const notice = get().changes[path];
    if (!notice) return;
    const rest = { ...get().changes };
    delete rest[path];
    const state = get();
    try {
      if (path === state.activePath && state.diskText !== notice.after) {
        set({ changes: rest });
        const buffer = bufferMarkdown();
        if (buffer !== null) await state.save(buffer);
        return;
      }
      if (notice.before === null) {
        set({ changes: rest });
        return;
      }
      await fs.writeNote(path, notice.before);
      lastSeen.set(path, notice.before);
      if (path === state.activePath) {
        set({
          changes: rest,
          activeContent: notice.before,
          diskText: notice.before,
          liveText: notice.before,
          loadId: get().loadId + 1,
          status: "idle",
        });
      } else {
        set({ changes: rest });
      }
    } catch (error) {
      set({ error: String(error) });
    }
  },
}));
