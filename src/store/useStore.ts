import { create } from "zustand";
import { confirm } from "@tauri-apps/plugin-dialog";
import { dirname } from "@tauri-apps/api/path";
import type { NoteFile, SaveStatus, TreeNode } from "../types";
import * as fs from "../lib/fs";

const LAST_FOLDER_KEY = "monocle:lastFolder";

type State = {
  folder: string | null;
  tree: TreeNode[];
  notes: NoteFile[];
  expanded: Set<string>;
  selectedDir: string | null;
  activePath: string | null;
  activeContent: string;
  status: SaveStatus;
  error: string | null;
  loading: boolean;
  init: () => Promise<void>;
  chooseFolder: () => Promise<void>;
  refresh: () => Promise<void>;
  toggleDir: (path: string) => void;
  openNote: (path: string) => Promise<void>;
  openExternalNote: (path: string) => Promise<void>;
  createNote: (dir?: string) => Promise<void>;
  renameNote: (path: string, name: string) => Promise<void>;
  deleteNote: (path: string) => Promise<void>;
  markDirty: () => void;
  save: (markdown: string) => Promise<void>;
  setError: (message: string | null) => void;
};

async function confirmDiscard(): Promise<boolean> {
  return confirm("You have unsaved changes. Discard them?", {
    title: "Unsaved changes",
    kind: "warning",
  });
}

export const useStore = create<State>((set, get) => ({
  folder: null,
  tree: [],
  notes: [],
  expanded: new Set<string>(),
  selectedDir: null,
  activePath: null,
  activeContent: "",
  status: "idle",
  error: null,
  loading: false,

  init: async () => {
    const folder = localStorage.getItem(LAST_FOLDER_KEY);
    if (!folder) return;
    set({ folder });
    await get().refresh();
  },

  chooseFolder: async () => {
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
        status: "idle",
      });
      await get().refresh();
    } catch (error) {
      set({ error: String(error) });
    }
  },

  refresh: async () => {
    const { folder } = get();
    if (!folder) return;
    set({ loading: true });
    try {
      const tree = await fs.readTree(folder);
      set({ tree, notes: fs.flattenTree(tree), error: null, loading: false });
    } catch (error) {
      set({ error: String(error), loading: false });
    }
  },

  toggleDir: (path) => {
    set((state) => {
      const expanded = new Set(state.expanded);
      if (expanded.has(path)) expanded.delete(path);
      else expanded.add(path);
      return { expanded, selectedDir: path };
    });
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
        status: "idle",
      });
      await get().refresh();
    }
    await get().openNote(path);
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
        status: "idle",
        selectedDir: target,
        expanded,
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
    try {
      await fs.deleteNoteFile(path);
      const wasActive = get().activePath === path;
      await get().refresh();
      if (wasActive) {
        set({ activePath: null, activeContent: "", status: "idle" });
      }
    } catch (error) {
      set({ error: String(error) });
    }
  },

  markDirty: () => set({ status: "dirty" }),

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
