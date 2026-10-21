import { create } from "zustand";
import { dirname } from "@tauri-apps/api/path";
import type { NoteFile, SaveStatus, TreeNode } from "../types";
import * as fs from "../lib/fs";
import { bufferMarkdown } from "../lib/editorBuffer";
import { DISMISS, askModal, askUnsavedChanges } from "./useModalPrompt";

const LAST_FOLDER_KEY = "monocle:lastFolder";
const SHOW_HIDDEN_KEY = "monocle:showHidden";

type State = {
  folder: string | null;
  tree: TreeNode[];
  notes: NoteFile[];
  expanded: Set<string>;
  selectedDir: string | null;
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
  // Bumped to ask the editor to take focus, for opens that mean "start
  // writing" (a new note, a file opened from outside, a picked search result).
  // Read by the editor pane, so it needs no editor reference of its own.
  editorFocusRequest: number;
  init: () => Promise<void>;
  chooseFolder: () => Promise<void>;
  refresh: () => Promise<void>;
  toggleDir: (path: string) => void;
  collapseAll: () => void;
  expandAll: () => void;
  openNote: (path: string) => Promise<void>;
  openExternalNote: (path: string) => Promise<void>;
  createNote: (dir?: string) => Promise<void>;
  renameNote: (path: string, name: string) => Promise<void>;
  deleteNote: (path: string) => Promise<void>;
  markDirty: () => void;
  save: (markdown: string) => Promise<void>;
  setError: (message: string | null) => void;
  setShowHidden: (value: boolean) => Promise<void>;
  requestEditorFocus: () => void;
};

function noteLabel(path: string | null): string | null {
  if (!path) return null;
  return path.split(/[\\/]/).pop() || null;
}

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

export const useStore = create<State>((set, get) => ({
  folder: null,
  tree: [],
  notes: [],
  expanded: new Set<string>(),
  selectedDir: null,
  activePath: null,
  activeContent: "",
  loadId: 0,
  status: "idle",
  error: null,
  loading: false,
  showHidden: false,
  editorFocusRequest: 0,

  init: async () => {
    const showHidden = localStorage.getItem(SHOW_HIDDEN_KEY) === "1";
    const folder = localStorage.getItem(LAST_FOLDER_KEY);
    set({ showHidden });
    if (!folder) return;
    set({ folder });
    await get().refresh();
  },

  chooseFolder: async () => {
    if (get().status === "dirty" && !(await confirmDiscard())) return;
    try {
      const folder = await fs.pickFolder();
      if (!folder) return;
      localStorage.setItem(LAST_FOLDER_KEY, folder);
      set({
        folder,
        tree: [],
        notes: [],
        expanded: new Set<string>(),
        selectedDir: null,
        activePath: null,
        activeContent: "",
        loadId: get().loadId + 1,
        status: "idle",
      });
      await get().refresh();
    } catch (error) {
      set({ error: String(error) });
    }
  },

  refresh: async () => {
    const { folder, showHidden } = get();
    if (!folder) return;
    set({ loading: true });
    try {
      const tree = await fs.readTree(folder, showHidden);
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

  toggleDir: (path) => {
    set((state) => {
      const expanded = new Set(state.expanded);
      if (expanded.has(path)) expanded.delete(path);
      else expanded.add(path);
      return { expanded, selectedDir: path };
    });
  },

  collapseAll: () => set({ expanded: new Set<string>() }),

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
    set({ expanded: dirs });
  },

  openNote: async (path) => {
    if (get().status === "dirty" && !(await confirmDiscard())) return;
    try {
      const content = await fs.readNote(path);
      const { folder, expanded } = get();
      const next = new Set(expanded);
      if (folder) {
        for (const dir of fs.ancestorDirs(folder, path)) next.add(dir);
      }
      set({
        activePath: path,
        activeContent: content,
        loadId: get().loadId + 1,
        status: "idle",
        error: null,
        expanded: next,
      });
    } catch (error) {
      set({ error: String(error) });
    }
  },

  openExternalNote: async (path) => {
    const { folder } = get();
    if (!folder || !fs.isInside(folder, path)) {
      if (get().status === "dirty" && !(await confirmDiscard())) return;
      const dir = await dirname(path);
      localStorage.setItem(LAST_FOLDER_KEY, dir);
      set({
        folder: dir,
        tree: [],
        notes: [],
        expanded: new Set<string>(),
        selectedDir: null,
        activePath: null,
        activeContent: "",
        loadId: get().loadId + 1,
        status: "idle",
      });
      await get().refresh();
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
    const { folder, selectedDir } = get();
    if (!folder) return;
    if (get().status === "dirty" && !(await confirmDiscard())) return;
    const target = dir ?? selectedDir ?? folder;
    try {
      const path = await fs.createNoteFile(target);
      const expanded = new Set(get().expanded);
      if (target !== folder) expanded.add(target);
      await get().refresh();
      set({
        activePath: path,
        activeContent: "",
        loadId: get().loadId + 1,
        status: "idle",
        selectedDir: target,
        expanded,
        // A brand-new note is an invitation to type, so the caret goes in it.
        editorFocusRequest: get().editorFocusRequest + 1,
      });
    } catch (error) {
      set({ error: String(error) });
    }
  },

  renameNote: async (path, name) => {
    try {
      const newPath = await fs.renameNoteFile(path, name);
      await get().refresh();
      if (get().activePath === path) set({ activePath: newPath });
    } catch (error) {
      set({ error: String(error) });
    }
  },

  deleteNote: async (path) => {
    const choice = await askModal<"delete">({
      title: "Delete note",
      body: `"${noteLabel(path)}" will be deleted. This can't be undone.`,
      actions: [{ value: "delete", label: "Delete", tone: "danger" }],
      dismissLabel: "Keep note",
    });
    if (choice !== "delete") return;
    try {
      await fs.deleteNoteFile(path);
      const wasActive = get().activePath === path;
      await get().refresh();
      if (wasActive) {
        set({
          activePath: null,
          activeContent: "",
          loadId: get().loadId + 1,
          status: "idle",
        });
      }
    } catch (error) {
      set({ error: String(error) });
    }
  },

  markDirty: () => set({ status: "dirty" }),

  requestEditorFocus: () =>
    set((state) => ({ editorFocusRequest: state.editorFocusRequest + 1 })),

  save: async (markdown) => {
    const { activePath } = get();
    if (!activePath) return;
    set({ status: "saving" });
    try {
      await fs.writeNote(activePath, markdown);
      set({ status: "saved", error: null });
    } catch (error) {
      set({ status: "error", error: String(error) });
    }
  },

  setError: (message) => set({ error: message }),
}));
