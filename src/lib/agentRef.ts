import { ancestorsUpToHome, baseName } from "./treeView";

/** What marks a folder as a project: any one of these inside it. */
export const PROJECT_MARKERS = ["CLAUDE.md", "AGENTS.md", ".claude", ".git"] as const;

export type HasEntry = (dir: string, name: string) => Promise<boolean>;

/**
 * The nearest folder above `filePath` that holds a project marker, stopping
 * before the home folder (a bare home is not a project). Null when none.
 */
export async function projectFolder(
  filePath: string,
  home: string,
  hasEntry: HasEntry,
): Promise<string | null> {
  const chain = ancestorsUpToHome(filePath, home).filter((dir) => dir !== home);
  for (const dir of chain) {
    // A dot-folder such as `.claude` is a marker of its parent, not a project.
    if (baseName(dir).startsWith(".")) continue;
    for (const marker of PROJECT_MARKERS) {
      if (await hasEntry(dir, marker)) return dir;
    }
  }
  return null;
}

/**
 * The path reference an agent can follow: `@` plus the path relative to the
 * project folder, or the path from home (`~/.claude/CLAUDE.md`) when there is
 * no project folder.
 */
export async function agentPathReference(
  filePath: string,
  home: string,
  hasEntry: HasEntry,
): Promise<string> {
  const project = await projectFolder(filePath, home, hasEntry);
  if (project) return `@${filePath.slice(project.length + 1)}`;
  if (filePath.startsWith(`${home}/`)) return `~/${filePath.slice(home.length + 1)}`;
  return filePath;
}

/** Full contents, wrapped with the filename. */
export function wrapContents(filePath: string, contents: string): string {
  const name = baseName(filePath);
  return `<file name="${name}">\n${contents.replace(/\n$/, "")}\n</file>`;
}
