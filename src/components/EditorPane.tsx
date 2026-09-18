import { useEffect, useState } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import { StarterKit } from "@tiptap/starter-kit";
import { TaskList } from "@tiptap/extension-task-list";
import { TaskItem } from "@tiptap/extension-task-item";
import { Placeholder } from "@tiptap/extensions";
import { Markdown } from "tiptap-markdown";
import { useStore } from "../store/useStore";
import { toMarkdown } from "../lib/markdown";
import { SlashCommand } from "../editor/extensions/SlashCommand";
import { BlockHandles } from "./BlockHandles";
import type { SaveStatus } from "../types";

const STATUS_LABEL: Record<SaveStatus, string> = {
  idle: "",
  dirty: "Unsaved changes",
  saving: "Saving…",
  saved: "Saved",
  error: "Save failed",
};

export function EditorPane() {
  const notes = useStore((s) => s.notes);
  const activePath = useStore((s) => s.activePath);
  const activeContent = useStore((s) => s.activeContent);
  const status = useStore((s) => s.status);
  const markDirty = useStore((s) => s.markDirty);
  const save = useStore((s) => s.save);

  const [editorDom, setEditorDom] = useState<HTMLDivElement | null>(null);

  const editor = useEditor({
    extensions: [
      StarterKit,
      TaskList,
      TaskItem.configure({ nested: true }),
      Placeholder.configure({ placeholder: "Write something…" }),
      Markdown.configure({
        html: false,
        tightLists: true,
        linkify: false,
        breaks: false,
      }),
      SlashCommand,
    ],
    content: "",
    editorProps: { attributes: { class: "tiptap" } },
    onUpdate: () => markDirty(),
  });

  useEffect(() => {
    if (!editor || !activePath) return;
    editor.commands.setContent(activeContent, { emitUpdate: false });
    editor.commands.focus("end");
  }, [editor, activePath, activeContent]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s") {
        event.preventDefault();
        if (editor && activePath) void save(toMarkdown(editor));
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [editor, activePath, save]);

  const activeNote = notes.find((note) => note.path === activePath);

  return (
    <main className="flex h-full min-w-0 flex-1 flex-col overflow-hidden bg-[var(--bg)]">
      <div className="flex h-11 shrink-0 items-center justify-end px-4">
        <span className="text-[12px] text-[var(--text-faint)]">
          {activePath ? STATUS_LABEL[status] : ""}
        </span>
      </div>

      {activePath ? (
        <div className="editor-scroll flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-[720px] px-16 pb-40">
            <h1 className="mb-2 mt-6 break-words text-[38px] font-bold leading-tight tracking-[-0.01em] text-[var(--text)]">
              {activeNote?.name ?? ""}
            </h1>
            <div ref={setEditorDom}>
              <EditorContent editor={editor} />
            </div>
          </div>
        </div>
      ) : (
        <div className="grid flex-1 place-items-center">
          <div className="text-center">
            <p className="text-[15px] text-[var(--text-muted)]">
              Select a note to start writing
            </p>
            <p className="mt-1 text-[13px] text-[var(--text-faint)]">
              or press ⌘N for a new note
            </p>
          </div>
        </div>
      )}

      <BlockHandles editor={editor} editorDom={editorDom} />
    </main>
  );
}
