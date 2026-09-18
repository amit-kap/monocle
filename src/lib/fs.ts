import {
  exists,
  readDir,
  readTextFile,
  remove,
  rename,
  writeTextFile,
} from "@tauri-apps/plugin-fs";
import { dirname, join } from "@tauri-apps/api/path";
import { open } from "@tauri-apps/plugin-dialog";
import type { NoteFile, TreeNode } from "../types";

const MD_EXT = /\.(md|markdown)$/i;
const SKIP_DIRS = new Set(["Library", "node_modules", ".git", ".Trash"]);
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

function sortNodes(nodes: TreeNode[]): TreeNode[] {
  return nodes.sort((a, b) => {
    if (a.kind !== b.kind) return a.kind === "dir" ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
}

async function walk(dir: string, isRoot = false): Promise<TreeNode[]> {
  let entries: Awaited<ReturnType<typeof readDir>>;
  await acquireRead();
  try {
    entries = await readDir(dir);
  } catch (error) {
    console.warn("[monocle] readDir failed:", dir, String(error));
    if (isRoot) throw error;
    return [];
  } finally {
    releaseRead();
  }

  const nodes: TreeNode[] = [];
  const subdirs: Promise<TreeNode | null>[] = [];

  for (const entry of entries) {
    if (entry.name.startsWith(".")) continue;
    const path = pathFor(dir, entry.name);
    if (entry.isDirectory) {
      if (entry.isSymlink || SKIP_DIRS.has(entry.name)) continue;
      subdirs.push(
        walk(path).then((children) =>
          children.length > 0
            ? ({ name: entry.name, path, kind: "dir", children } as TreeNode)
            : null,
        ),
      );
    } else if (entry.isFile && MD_EXT.test(entry.name)) {
      nodes.push({ name: entry.name.replace(MD_EXT, ""), path, kind: "file" });
    }
  }

  const resolved = await Promise.all(subdirs);
  for (const node of resolved) {
    if (node) nodes.push(node);
  }
  return sortNodes(nodes);
}

export function readTree(root: string): Promise<TreeNode[]> {
  return walk(root, true);
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

export function readNote(path: string): Promise<string> {
  return readTextFile(path);
}

export function writeNote(path: string, content: string): Promise<void> {
  return writeTextFile(path, content);
}

async function uniqueNotePath(folder: string, base: string): Promise<string> {
  let candidate = await join(folder, `${base}.md`);
  let index = 1;
  while (await exists(candidate)) {
    candidate = await join(folder, `${base} ${index}.md`);
    index += 1;
  }
  return candidate;
}

export async function createNoteFile(folder: string): Promise<string> {
  const path = await uniqueNotePath(folder, "Untitled");
  await writeTextFile(path, "");
  return path;
}

export async function renameNoteFile(
  path: string,
  newName: string,
): Promise<string> {
  const folder = await dirname(path);
  const target = await join(folder, `${newName}.md`);
  if (target === path) return path;
  const uniqueTarget = await uniqueNotePath(folder, newName);
  await rename(path, uniqueTarget);
  return uniqueTarget;
}

export async function deleteNoteFile(path: string): Promise<void> {
  await remove(path);
}
