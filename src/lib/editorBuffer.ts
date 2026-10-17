// The editor owns the in-memory buffer, and only it can serialize to markdown.
// When something other than the editor needs to save on the user's behalf —
// the "Save" answer to the unsaved-changes prompt — it reads the buffer here.
// EditorPane registers a serializer while a note is mounted.

let serialize: (() => string) | null = null;

export function setBufferSerializer(fn: (() => string) | null): void {
  serialize = fn;
}

/** The open note's current markdown, or null when no editor is mounted. */
export function bufferMarkdown(): string | null {
  return serialize ? serialize() : null;
}
