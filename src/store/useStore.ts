import { create } from "zustand";
import { homeDir } from "@tauri-apps/api/path";
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
import {
  countFiles,
  dirsToRescan,
  findNode,
  isShown,
  outermost,
  parentDir,
  placeNodes,
  placeOf,
  replaceDir,
  trailTo,
} from "../lib/treeView";
import { DISMISS, askModal, askUnsavedChanges } from "./useModalPrompt";

const LAST_FOLDER_KEY = "monocle:lastFolder";
const SHOW_HIDDEN_KEY = "monocle:showHidden";
const PLACES_KEY = "monocle:places";
const COLLAPSED_KEY = "monocle:collapsedPlaces";
const VIEW_KEY = "monocle:view";
const EXPANDED_KEY = "monocle:expanded";

type HeadingRequest = { line: number; index: number; n: number };

type State = {
  /**
   * The Places: the folders the sidebar is built from, in the order shown. The
   * tree holds one top-level row for each.
   */
  places: string[];
  /** Places folded shut in the sidebar. Places start open. */
  collapsedPlaces: Set<string>;
  home: string | null;
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
  /** Pick a folder with the system picker and add it as a Place. */
  chooseFolder: () => Promise<void>;
  addPlace: (path: string) => Promise<void>;
  removePlace: (path: string) => void;
  movePlace: (path: string, by: -1 | 1) => void;
  refresh: (silent?: boolean) => Promise<void>;
  refreshDirs: (dirs: string[]) => Promise<void>;
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

function readList(key: string): string[] | null {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return null;
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((p): p is string => typeof p === "string") : null;
  } catch {
    return null;
  }
}

function storeList(key: string, list: Iterable<string>): void {
  try {
    localStorage.setItem(key, JSON.stringify([...list]));
  } catch {
    // Not remembered; the sidebar still works.
  }
}

/**
 * The open folders, for every Place at once (paths are absolute, so one list
 * serves them all). Before Places the list was kept per root folder.
 */
function readExpanded(legacyRoot: string | null): Set<string> {
  const list =
    readList(EXPANDED_KEY) ?? (legacyRoot ? readList(`${EXPANDED_KEY}:${legacyRoot}`) : null);
  return new Set(list ?? []);
}

function storeExpanded(expanded: Set<string>): void {
  storeList(EXPANDED_KEY, expanded);
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

async function startWatching(roots: string[]): Promise<void> {
  try {
    await fs.startWatch(roots);
  } catch {
    // Not running under Tauri, or the folder can't be watched: the tree still
    // works, it just doesn't update by itself.
  }
}

/**
 * What opens to show `path`: every folder from its Place down, and the Place
 * itself if it was folded shut. Remembered for the next launch.
 */
function openTrail(
  state: Pick<State, "places" | "expanded" | "collapsedPlaces">,
  path: string,
): { expanded: Set<string>; collapsedPlaces: Set<string> } {
  const place = placeOf(state.places, path);
  if (!place) return { expanded: state.expanded, collapsedPlaces: state.collapsedPlaces };
  const expanded = new Set(state.expanded);
  for (const dir of trailTo(place, parentDir(path))) expanded.add(dir);
  storeExpanded(expanded);
  let collapsedPlaces = state.collapsedPlaces;
  if (collapsedPlaces.has(place)) {
    collapsedPlaces = new Set(collapsedPlaces);
    collapsedPlaces.delete(place);
    storeList(COLLAPSED_KEY, collapsedPlaces);
  }
  return { expanded, collapsedPlaces };
}

export const useStore = create<State>((set, get) => ({
  places: [],
  collapsedPlaces: new Set<string>(),
  home: null,
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
    // Places carry over from the single root folder of earlier versions; the
    // very first launch starts with the home folder and opens its first note.
    const legacy = localStorage.getItem(LAST_FOLDER_KEY);
    const saved = readList(PLACES_KEY);
    const firstLaunch = saved === null && legacy === null;
    const places = saved ?? (legacy ? [legacy] : home ? [home] : []);
    storeList(PLACES_KEY, places);
    set({
      home,
      places,
      collapsedPlaces: new Set(readList(COLLAPSED_KEY) ?? []),
      expanded: readExpanded(legacy),
      folderPage: null,
    });
    if (places.length === 0) return;
    await get().refresh();
    void startWatching(places);
    if (firstLaunch) {
      const first = get().notes[0];
      if (first && !get().activePath) {
        get().expandTo(first.path);
        await get().openNote(first.path);
      }
    }
  },

  chooseFolder: async () => {
    try {
      const path = await fs.pickFolder();
      if (path) await get().addPlace(path);
    } catch (error) {
      set({ error: String(error) });
    }
  },

  // Adding a Place that is already there just shows it. Nothing ever closes
  // the open note.
  addPlace: async (path) => {
    const { places, collapsedPlaces } = get();
    if (!places.includes(path)) {
      const next = [...places, path];
      storeList(PLACES_KEY, next);
      set({ places: next });
      try {
        const children = await fs.readTree(path, get().showHidden);
        set((state) => {
          const tree = placeNodes(
            state.places,
            state.places.map((p) =>
              p === path ? children : (state.tree.find((n) => n.path === p)?.children ?? []),
            ),
          );
          return { tree, notes: fs.listNotes(tree) };
        });
      } catch {
        await get().refresh(true);
      }
      void startWatching(get().places);
    } else if (collapsedPlaces.has(path)) {
      get().toggleDir(path);
    }
    if (!get().activePath) set({ folderPage: path, selectedDir: path });
  },

  // Only the sidebar forgets it: the folder and its files stay where they are.
  removePlace: (path) => {
    const state = get();
    const places = state.places.filter((p) => p !== path);
    const collapsedPlaces = new Set(state.collapsedPlaces);
    collapsedPlaces.delete(path);
    storeList(PLACES_KEY, places);
    storeList(COLLAPSED_KEY, collapsedPlaces);
    const tree = state.tree.filter((n) => n.path !== path);
    const lost = (p: string | null) => isWithin(p, path) && !placeOf(places, p);
    set({
      places,
      collapsedPlaces,
      tree: placeNodes(places, places.map((p) => tree.find((n) => n.path === p)?.children ?? [])),
      notes: fs.listNotes(tree),
      folderPage: lost(state.folderPage) ? null : state.folderPage,
      selectedDir: lost(state.selectedDir) ? null : state.selectedDir,
    });
    void startWatching(places);
  },

  movePlace: (path, by) => {
    const places = [...get().places];
    const from = places.indexOf(path);
    const to = from + by;
    if (from < 0 || to < 0 || to >= places.length) return;
    [places[from], places[to]] = [places[to], places[from]];
    storeList(PLACES_KEY, places);
    const tree = get().tree;
    set({
      places,
      tree: places.map((p) => tree.find((n) => n.path === p)!).filter(Boolean),
    });
  },

  refresh: async (silent = false) => {
    const { places, showHidden } = get();
    if (places.length === 0) {
      set({ tree: [], notes: [], loading: false });
      return;
    }
    if (!silent) set({ loading: true });
    // Every Place is read at once. One that can't be read stays in the list,
    // marked missing, rather than failing the others.
    const contents = await Promise.all(
      places.map((place) => fs.readTree(place, showHidden).catch(() => null)),
    );
    if (get().places !== places) return;
    const tree = placeNodes(places, contents);
    set({ tree, notes: fs.listNotes(tree), error: null, loading: false });
  },

  // Rescan only the folders that changed and splice them into the tree. A
  // folder the tree doesn't have yet (it was just made, or its parent was)
  // rescans its nearest known ancestor, up to the Place itself.
  refreshDirs: async (dirs) => {
    const { showHidden } = get();
    for (const dir of outermost(dirs)) {
      let current = dir;
      for (;;) {
        if (!placeOf(get().places, current)) break;
        const node = findNode(get().tree, current);
        // A Place with no row yet (it was just added): read everything.
        if (!node && get().places.includes(current)) {
          await get().refresh(true);
          break;
        }
        if (node?.kind === "dir") {
          try {
            const children = await fs.readTree(current, showHidden);
            const tree = replaceDir(get().tree, current, children);
            if (tree) {
              set({ tree, notes: fs.listNotes(tree) });
              break;
            }
          } catch {
            // Gone since the event: its parent's listing will say so.
          }
        }
        current = parentDir(current);
      }
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
    if (get().places.includes(path)) {
      const collapsedPlaces = new Set(get().collapsedPlaces);
      if (collapsedPlaces.has(path)) collapsedPlaces.delete(path);
      else collapsedPlaces.add(path);
      storeList(COLLAPSED_KEY, collapsedPlaces);
      set({ collapsedPlaces });
      return;
    }
    const expanded = new Set(get().expanded);
    if (expanded.has(path)) expanded.delete(path);
    else expanded.add(path);
    storeExpanded(expanded);
    set({ expanded });
  },

  expandTo: (path) => set(openTrail(get(), path)),

  collapseAll: () => {
    storeExpanded(new Set());
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
    storeExpanded(dirs);
    set({ expanded: dirs });
  },

  openNote: async (path) => {
    if (get().status === "dirty" && !(await confirmDiscard())) return;
    try {
      const content = await fs.readNote(path);
      lastSeen.set(path, content);
      const { changes } = get();
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
        ...openTrail(get(), path),
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
    set({
      activePath: null,
      activeContent: "",
      diskText: "",
      liveText: "",
      loadId: get().loadId + 1,
      status: "idle",
      folderPage: path,
      selectedDir: path,
      ...openTrail(get(), `${path}/_`),
    });
  },

  openExternalNote: async (path) => {
    // A note outside every Place opens all the same (the breadcrumb offers to
    // add its folder). One inside a Place that the last scan didn't see opens
    // fine by path, but its folder is rescanned so it shows in the sidebar.
    if (placeOf(get().places, path) && !get().notes.some((note) => note.path === path)) {
      await get().refreshDirs([parentDir(path)]);
    }
    await get().openNote(path);
    // Opened from outside the app: the user came here to write in it.
    if (get().activePath === path) get().requestEditorFocus();
  },

  createNote: async (dir) => {
    const { places, selectedDir, folderPage, activePath } = get();
    if (places.length === 0) return;
    if (get().status === "dirty" && !(await confirmDiscard())) return;
    // Inside the selected folder, or next to the open file, or in the first
    // Place.
    const next = dir ?? folderPage ?? selectedDir ?? (activePath ? parentDir(activePath) : null);
    const target = next && placeOf(places, next) ? next : places[0];
    try {
      const path = await fs.createNoteFile(target);
      lastSeen.set(path, "");
      const { expanded, collapsedPlaces } = openTrail(get(), `${target}/_`);
      await get().refreshDirs([target]);
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
        collapsedPlaces,
        // The name is the first thing to set, so the row opens for typing.
        renamingPath: path,
      });
    } catch (error) {
      set({ error: String(error) });
    }
  },

  createFolder: async (dir) => {
    const { places, selectedDir, folderPage, activePath } = get();
    if (places.length === 0) return;
    const next = dir ?? folderPage ?? selectedDir ?? (activePath ? parentDir(activePath) : null);
    const target = next && placeOf(places, next) ? next : places[0];
    try {
      const path = await fs.createDirectory(target);
      const { expanded, collapsedPlaces } = openTrail(get(), `${target}/_`);
      set({ expanded, collapsedPlaces });
      await get().refreshDirs([target]);
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
      await get().refreshDirs([parentDir(path)]);
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
      storeExpanded(expanded);
      // A renamed folder that is itself a Place keeps its row.
      const places = state.places.map((p) => rebase(p, path, to)!);
      if (places.some((p, i) => p !== state.places[i])) {
        storeList(PLACES_KEY, places);
        void startWatching(places);
      }
      set({
        places,
        expanded,
        activePath: rebase(state.activePath, path, to),
        folderPage: rebase(state.folderPage, path, to),
        selectedDir: rebase(state.selectedDir, path, to),
        renamingPath: null,
      });
      await get().refreshDirs([parentDir(path)]);
    } catch (error) {
      set({ error: String(error), renamingPath: null });
    }
  },

  // Everything goes to the system Trash, so nothing is lost for good.
  trashEntry: async (path) => {
    const { places, tree } = get();
    // A Place's own folder is removed from the sidebar, never trashed from it.
    if (places.includes(path) || !placeOf(places, path)) return;
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
      const expanded = new Set([...state.expanded].filter((p) => !isWithin(p, path)));
      storeExpanded(expanded);
      const changes = Object.fromEntries(
        Object.entries(state.changes).filter(([p]) => !isWithin(p, path)),
      );
      set({ expanded, changes });
      // If what was open went with it, show the parent folder's page.
      const gone = isWithin(state.activePath, path) || isWithin(state.folderPage, path);
      await get().refreshDirs([parentDir(path)]);
      if (gone) {
        set({
          activePath: null,
          activeContent: "",
          diskText: "",
          liveText: "",
          loadId: get().loadId + 1,
          status: "idle",
          folderPage: placeOf(get().places, parentDir(path)) ? parentDir(path) : null,
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
    // Rescan only the folders holding what changed, and only where the tree
    // shows: dotfile churn in a home folder must not trigger a scan.
    const { places, showHidden } = get();
    const shown = paths.filter((p) => {
      const place = placeOf(places, p);
      return place !== null && isShown(place, p, showHidden);
    });
    if (shown.length === 0) return;
    await get().refreshDirs(dirsToRescan(shown));
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
