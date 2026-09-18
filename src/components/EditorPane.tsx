import { useEffect, useRef, useState } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import { StarterKit } from "@tiptap/starter-kit";
import { TaskList } from "@tiptap/extension-task-list";
import { TaskItem } from "@tiptap/extension-task-item";
import { Placeholder } from "@tiptap/extensions";
import { Markdown } from "tiptap-markdown";
import { useStore } from "../store/useStore";
import { toMarkdown } from "../lib/markdown";
import { stripExt } from "../lib/fs";
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
  const renameNote = useStore((s) => s.renameNote);

  const [editorDom, setEditorDom] = useState<HTMLDivElement | null>(null);
  const titleRef = useRef<HTMLTextAreaElement>(null);

  const activeNote = notes.find((note) => note.path === activePath);
  const baseName = activeNote ? stripExt(activeNote.name) : "";
  const [title, setTitle] = useState(baseName);

  useEffect(() => {
    setTitle(baseName);
  }, [activePath, baseName]);

  useEffect(() => {
    const el = titleRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [title, baseName, activePath]);

  function commitTitle() {
    if (!activePath) return;
    const next = title.trim();
    if (!next || next === baseName) {
      setTitle(baseName);
      return;
    }
    void renameNote(activePath, next);
  }

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
    const scroller = editorDom?.closest(".editor-scroll") as HTMLElement | null;
    if (!scroller) return;
    scroller.scrollTop = 0;
    const raf = requestAnimationFrame(() => {
      scroller.scrollTop = 0;
    });
    return () => cancelAnimationFrame(raf);
  }, [editor, activePath, activeContent, editorDom]);

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

  return (
    <main className="relative flex h-full min-w-0 flex-1 flex-col overflow-hidden bg-[var(--bg)]">
      {activePath && (
        <span className="pointer-events-none absolute right-4 top-3 z-10 text-[12px] text-[var(--text-faint)]">
          {STATUS_LABEL[status]}
        </span>
      )}

      {activePath ? (
        <div className="editor-scroll flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-[720px] px-16 py-20">
            <textarea
              ref={titleRef}
              value={title}
              rows={1}
              onChange={(event) => setTitle(event.currentTarget.value)}
              onBlur={commitTitle}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  event.currentTarget.blur();
                } else if (event.key === "Escape") {
                  setTitle(baseName);
                }
              }}
              placeholder="Untitled"
              spellCheck={false}
              className="mb-2 block w-full resize-none overflow-hidden bg-transparent text-[38px] font-bold leading-[1.25] tracking-[-0.01em] text-[var(--text)] outline-none placeholder:text-[var(--text-faint)]"
            />
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
