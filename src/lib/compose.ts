import { splitFrontmatter } from "./frontmatter";
import { patchOriginal } from "./patch";

/** A note as loaded: its text split into frontmatter and body. */
export type NoteDoc = {
  /** The file's exact text. */
  original: string;
  frontmatter: string;
  body: string;
  /** What the rich editor serialises the untouched body to. */
  baseline: string;
};

export function loadNote(original: string, serialiseBody: (body: string) => string): NoteDoc {
  const { frontmatter, body } = splitFrontmatter(original);
  return { original, frontmatter, body, baseline: serialiseBody(body) };
}

/**
 * The text to write after an edit: the frontmatter as it now stands, and the
 * body patched with only what the user changed. An untouched note comes back
 * byte-for-byte, so opening and closing a file never rewrites it.
 */
export function composeNote(doc: NoteDoc, editedBody: string): string {
  return doc.frontmatter + patchOriginal(doc.body, doc.baseline, editedBody);
}
