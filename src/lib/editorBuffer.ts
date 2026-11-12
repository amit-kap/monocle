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

// Which heading the cursor is under, for "copy current section". Only the
// editor knows where the cursor is; it registers a provider while mounted.

let cursorHeading: (() => number) | null = null;

export function setCursorHeadingProvider(fn: (() => number) | null): void {
  cursorHeading = fn;
}

/** Index of the heading the cursor is under (counting from the top), or -1. */
export function cursorHeadingIndex(): number {
  return cursorHeading ? cursorHeading() : -1;
}
