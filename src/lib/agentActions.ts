import { agentPathReference, wrapContents } from "./agentRef";
import { pathExists, readNote } from "./fs";

const hasEntry = (dir: string, name: string) => pathExists(`${dir}/${name}`);

export function pathReferenceFor(path: string, home: string): Promise<string> {
  return agentPathReference(path, home, hasEntry);
}

/** Copy `@relative/path` (or `~/path`) for an agent to follow. Returns the text. */
export async function copyPathReference(path: string, home: string): Promise<string> {
  const ref = await pathReferenceFor(path, home);
  await navigator.clipboard.writeText(ref);
  return ref;
}

export async function copyFullContents(path: string, text?: string): Promise<void> {
  const contents = text ?? (await readNote(path));
  await navigator.clipboard.writeText(wrapContents(path, contents));
}
