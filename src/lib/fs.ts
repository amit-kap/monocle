import { exists, readTextFile, rename } from "@tauri-apps/plugin-fs";
import { invoke } from "@tauri-apps/api/core";
import { dirname, join } from "@tauri-apps/api/path";
import { open } from "@tauri-apps/plugin-dialog";
import type { NoteFile, TreeNode } from "../types";

const MD_EXT = /\.(md|markdown)$/i;

export async function pickFolder(): Promise<string | null> {
  const selected = await open({
    directory: true,
    multiple: false,
    title: "Open notes folder",
  });
  return typeof selected === "string" ? selected : null;
}

/** Files first, then folders, each A to Z. There is no other order. */
export function sortNodes(nodes: TreeNode[]): TreeNode[] {
  return nodes.sort((a, b) => {
    if (a.kind !== b.kind) return a.kind === "file" ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
}

/**
 * Everything under `root`, read natively in one pass (`src-tauri/src/tree.rs`):
 * every folder, empty ones included, but only markdown files. Each folder says
 * whether it holds a note at any depth. Dependency, cache and build folders are
 * skipped, and so are hidden folders other than agents' (`.claude`, …) unless
 * `showHidden` is on.
 */
export function readTree(root: string, showHidden = false): Promise<TreeNode[]> {
  return invoke<TreeNode[]>("scan_tree", { root, showHidden });
}

/** Every note in the tree, once each (nested Places hold some notes twice). */
export function listNotes(nodes: TreeNode[]): NoteFile[] {
  const seen = new Set<string>();
  return flattenTree(nodes).filter((note) => !seen.has(note.path) && Boolean(seen.add(note.path)));
}

export function flattenTree(nodes: TreeNode[]): NoteFile[] {
  const out: NoteFile[] = [];
  for (const node of nodes) {
    if (node.kind === "file") {
      out.push({ name: node.name, path: node.path });
    } else if (node.children) {
      out.push(...flattenTree(node.children));
    }
  }
  return out;
}

/** Search starts at this many characters: one letter matches nearly everything. */
export const SEARCH_MIN = 2;

/** How many matches a search shows; past this it says there are more. */
export const SEARCH_LIMIT = 200;

export type SearchResult = {
  /** The tree cut down to the matches and the folders that lead to them. */
  nodes: TreeNode[];
  /** Folders to show open: only those on the way to a matching file. */
  open: Set<string>;
  /** Whether matches were left out to stay under the limit. */
  capped: boolean;
};

/**
 * Filter the tree by name. A file matches on its name; a folder whose own name
 * matches stays with everything in it, but shut, so one letter can't open the
 * whole disk. Only the folders leading to a matching file open, and at most
 * `limit` matches are kept.
 */
export function searchTree(
  nodes: TreeNode[],
  query: string,
  limit = SEARCH_LIMIT,
): SearchResult {
  const q = query.trim().toLowerCase();
  const open = new Set<string>();
  if (!q) return { nodes, open, capped: false };
  let count = 0;
  let capped = false;

  function walk(list: TreeNode[]): TreeNode[] {
    const out: TreeNode[] = [];
    for (const node of list) {
      const hit = node.name.toLowerCase().includes(q);
      if (node.kind === "file" || (hit && !node.place)) {
        if (!hit) continue;
        if (count >= limit) {
          capped = true;
          continue;
        }
        count += 1;
        out.push(node);
        continue;
      }
      // A Place is a header, not a match; a folder that doesn't match by name
      // stays while anything in it does, and opens to show it.
      const children = walk(node.children ?? []);
      if (children.length > 0) {
        out.push({ ...node, children });
        if (children.some((c) => c.kind === "file" || open.has(c.path))) open.add(node.path);
      }
    }
    return out;
  }

  return { nodes: walk(nodes), open, capped };
}

export function filterTree(nodes: TreeNode[], query: string): TreeNode[] {
  return searchTree(nodes, query, Infinity).nodes;
}

export function ancestorDirs(root: string, filePath: string): string[] {
  const relative = filePath.slice(root.length).split("/").filter(Boolean);
  const dirs: string[] = [];
  let current = root;
  for (let i = 0; i < relative.length - 1; i += 1) {
    current = `${current}/${relative[i]}`;
    dirs.push(current);
  }
  return dirs;
}

export function stripExt(name: string): string {
  return name.replace(MD_EXT, "");
}

export function isInside(root: string, path: string): boolean {
  const base = root.endsWith("/") ? root.slice(0, -1) : root;
  return path === base || path.startsWith(`${base}/`);
}

export function readNote(path: string): Promise<string> {
  return readTextFile(path);
}

/** Writes through a temporary file and a rename, so a crash can't half-write. */
export function writeNote(path: string, content: string): Promise<void> {
  return invoke("write_file_atomic", { path, contents: content });
}

async function uniqueNotePath(folder: string, base: string): Promise<string> {
  let candidate = await join(folder, `${base}.md`);
  let index = 2;
  while (await exists(candidate)) {
    candidate = await join(folder, `${base} ${index}.md`);
    index += 1;
  }
  return candidate;
}

export async function createNoteFile(folder: string): Promise<string> {
  const path = await uniqueNotePath(folder, "untitled");
  await invoke("write_file_atomic", { path, contents: "" });
  return path;
}

/** Makes `untitled folder` (or `untitled folder 2`, …) inside `parent`. */
export async function createDirectory(parent: string): Promise<string> {
  let candidate = await join(parent, "untitled folder");
  let index = 2;
  while (await exists(candidate)) {
    candidate = await join(parent, `untitled folder ${index}`);
    index += 1;
  }
  await invoke("create_dir", { path: candidate });
  return candidate;
}

/** Renames a folder. Notes go through `renameNoteFile`, which keeps `.md`. */
export async function renameDirectory(
  path: string,
  newName: string,
): Promise<string> {
  const target = await join(await dirname(path), newName.trim());
  if (target === path) return path;
  if (await exists(target)) throw new Error(`"${newName}" already exists`);
  await rename(path, target);
  return target;
}

export async function renameNoteFile(
  path: string,
  newName: string,
): Promise<string> {
  const folder = await dirname(path);
  const base = stripExt(newName.trim());
  const target = await join(folder, `${base}.md`);
  if (target === path) return path;
  const uniqueTarget = await uniqueNotePath(folder, base);
  await rename(path, uniqueTarget);
  return uniqueTarget;
}

/** Moves a file or folder to the system Trash. Nothing is deleted for good. */
export async function trashPath(path: string): Promise<void> {
  await invoke("trash_path", { path });
}

export async function saveAsset(
  filePath: string,
  bytes: number[],
  ext: string,
): Promise<string> {
  return invoke<string>("save_asset", { filePath, bytes, ext });
}

/** Watch every Place at once; one change event covers them all. */
export function startWatch(roots: string[]): Promise<void> {
  return invoke("start_watch", { roots });
}

export function stopWatch(): Promise<void> {
  return invoke("stop_watch");
}

export async function pathExists(path: string): Promise<boolean> {
  try {
    return await exists(path);
  } catch {
    return false;
  }
}
