import type { Editor } from "@tiptap/core";
import { EditorState } from "@tiptap/pm/state";

// Replaces the document and starts a fresh undo history, so ⌘Z can't step
// back into the previously open note.
export function loadDocument(editor: Editor, markdown: string): void {
  editor.commands.setContent(markdown, { emitUpdate: false });
  const { doc, plugins } = editor.state;
  editor.view.updateState(EditorState.create({ doc, plugins }));
}
