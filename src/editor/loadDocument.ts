import type { Editor } from "@tiptap/core";
import { EditorState } from "@tiptap/pm/state";

// Replaces the document and starts a fresh undo history, so ⌘Z can't step
// back into the previously open note. `keepHistory` is for catching the rich
// view up with the source view, where the same note stays open.
export function loadDocument(
  editor: Editor,
  markdown: string,
  options: { keepHistory?: boolean } = {},
): void {
  editor.commands.setContent(markdown, { emitUpdate: false });
  if (options.keepHistory) return;
  const { doc, plugins } = editor.state;
  editor.view.updateState(EditorState.create({ doc, plugins }));
}
