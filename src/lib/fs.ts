import {
  exists,
  readDir,
  readTextFile,
  rename,
  stat,
} from "@tauri-apps/plugin-fs";
import { invoke } from "@tauri-apps/api/core";
import { dirname, join } from "@tauri-apps/api/path";
import { open } from "@tauri-apps/plugin-dialog";
import type { NoteFile, TreeNode } from "../types";

const MD_EXT = /\.(md|markdown)$/i;
// Folders that never hold notes: system data, dependencies, build output.
export const SKIP_DIRS = new Set([
  "Library",
  "node_modules",
  ".git",
  ".Trash",
  "dist",
  "build",
  "target",
  ".next",
  ".cache",
]);
const MAX_CONCURRENT_READS = 32;

let activeReads = 0;
const readQueue: (() => void)[] = [];

function acquireRead(): Promise<void> {
  if (activeReads < MAX_CONCURRENT_READS) {
    activeReads += 1;
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    readQueue.push(() => {
      activeReads += 1;
      resolve();
    });
  });
}

function releaseRead(): void {
  activeReads -= 1;
  readQueue.shift()?.();
}

function pathFor(dir: string, name: string): string {
  return dir.endsWith("/") ? `${dir}${name}` : `${dir}/${name}`;
}

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

async function fileSize(path: string): Promise<number | undefined> {
  await acquireRead();
  try {
    return (await stat(path)).size;
  } catch {
    return undefined;
  } finally {
    releaseRead();
  }
}

async function walk(
  dir: string,
  showHidden: boolean,
  keepDirs: ReadonlySet<string>,
  isRoot = false,
): Promise<TreeNode[]> {
  let entries: Awaited<ReturnType<typeof readDir>>;
  await acquireRead();
  try {
    entries = await readDir(dir);
  } catch (error) {
    // Unreadable subfolders (e.g. the Photos Library) are expected; skip them.
    if (isRoot) throw error;
    return [];
  } finally {
    releaseRead();
  }

  const nodes: TreeNode[] = [];
  const subdirs: Promise<TreeNode | null>[] = [];
  const sizes: Promise<void>[] = [];

  for (const entry of entries) {
    // Hidden files and folders are off by default: a notes folder often sits
    // inside a home directory full of dotfiles the user never wants to see.
    if (!showHidden && entry.name.startsWith(".")) continue;
    const path = pathFor(dir, entry.name);
    if (entry.isDirectory) {
      if (entry.isSymlink || SKIP_DIRS.has(entry.name)) continue;
      subdirs.push(
        walk(path, showHidden, keepDirs).then((children) =>
          // A folder made in the app stays in the tree while it is empty.
          children.length > 0 || keepDirs.has(path)
            ? ({ name: entry.name, path, kind: "dir", children } as TreeNode)
            : null,
        ),
      );
    } else if (entry.isFile && MD_EXT.test(entry.name)) {
      const node: TreeNode = { name: entry.name, path, kind: "file" };
      nodes.push(node);
      sizes.push(
        fileSize(path).then((size) => {
          node.size = size;
        }),
      );
    }
  }

  await Promise.all(sizes);
  const resolved = await Promise.all(subdirs);
  for (const node of resolved) {
    if (node) nodes.push(node);
  }
  return sortNodes(nodes);
}

export function readTree(
  root: string,
  showHidden = false,
  keepDirs: ReadonlySet<string> = new Set(),
): Promise<TreeNode[]> {
  return walk(root, showHidden, keepDirs, true);
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

export function filterTree(nodes: TreeNode[], query: string): TreeNode[] {
  const q = query.trim().toLowerCase();
  if (!q) return nodes;
  const out: TreeNode[] = [];
  for (const node of nodes) {
    if (node.kind === "file") {
      if (node.name.toLowerCase().includes(q)) out.push(node);
    } else if (node.children) {
      // A folder whose own name matches stays with everything in it.
      if (node.name.toLowerCase().includes(q)) {
        out.push(node);
        continue;
      }
      const children = filterTree(node.children, q);
      if (children.length > 0) out.push({ ...node, children });
    }
  }
  return out;
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

export function startWatch(root: string): Promise<void> {
  return invoke("start_watch", { root });
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
