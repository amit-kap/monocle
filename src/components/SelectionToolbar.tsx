import { useEffect, useRef, useState } from "react";
import type { Editor } from "@tiptap/core";

type Box = { left: number; top: number };

/**
 * A small toolbar over a text selection: bold, italic, strikethrough, inline
 * code and link. It follows the selection and never takes focus from the
 * editor, so the selection survives a click.
 */
export function SelectionToolbar({ editor }: { editor: Editor | null }) {
  const [box, setBox] = useState<Box | null>(null);
  const [linking, setLinking] = useState(false);
  const [url, setUrl] = useState("");
  const [, bump] = useState(0);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!editor) return;
    function update() {
      if (!editor) return;
      const { from, to, empty } = editor.state.selection;
      const inCode = editor.isActive("codeBlock");
      if (empty || inCode || !editor.isFocused && !ref.current?.contains(document.activeElement)) {
        if (!ref.current?.contains(document.activeElement)) {
          setBox(null);
          setLinking(false);
        }
        return;
      }
      const start = editor.view.coordsAtPos(from);
      const end = editor.view.coordsAtPos(to);
      setBox({
        left: Math.max(8, Math.min((start.left + end.left) / 2 - 90, window.innerWidth - 220)),
        top: Math.max(8, start.top - 42),
      });
      bump((n) => n + 1);
    }
    editor.on("selectionUpdate", update);
    editor.on("blur", update);
    editor.on("focus", update);
    return () => {
      editor.off("selectionUpdate", update);
      editor.off("blur", update);
      editor.off("focus", update);
    };
  }, [editor]);

  if (!editor || !box) return null;

  function run(command: () => void) {
    command();
    bump((n) => n + 1);
  }

  const buttons: { id: string; label: string; active: boolean; onClick: () => void; node: React.ReactNode }[] = [
    {
      id: "bold",
      label: "Bold",
      active: editor.isActive("bold"),
      onClick: () => run(() => editor.chain().focus().toggleBold().run()),
      node: <b>B</b>,
    },
    {
      id: "italic",
      label: "Italic",
      active: editor.isActive("italic"),
      onClick: () => run(() => editor.chain().focus().toggleItalic().run()),
      node: <i>i</i>,
    },
    {
      id: "strike",
      label: "Strikethrough",
      active: editor.isActive("strike"),
      onClick: () => run(() => editor.chain().focus().toggleStrike().run()),
      node: <s>S</s>,
    },
    {
      id: "code",
      label: "Inline code",
      active: editor.isActive("code"),
      onClick: () => run(() => editor.chain().focus().toggleCode().run()),
      node: <span className="font-mono text-[12px]">{"</>"}</span>,
    },
  ];

  return (
    <div
      ref={ref}
      role="toolbar"
      aria-label="Format selection"
      data-selection-toolbar
      // Keep the selection: a mousedown here must not move focus off the editor.
      onMouseDown={(event) => {
        if ((event.target as HTMLElement).tagName !== "INPUT") event.preventDefault();
      }}
      className="fixed z-40 flex h-[34px] items-center gap-0.5 rounded-[9px] bg-[var(--btn-primary-bg)] px-1 text-[var(--btn-primary-fg)] shadow-[var(--shadow-menu)]"
      style={{ left: box.left, top: box.top }}
    >
      {linking ? (
        <input
          autoFocus
          value={url}
          placeholder="Paste a link"
          aria-label="Link address"
          onChange={(event) => setUrl(event.currentTarget.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              const href = url.trim();
              if (href) editor.chain().focus().extendMarkRange("link").setLink({ href }).run();
              else editor.chain().focus().unsetLink().run();
              setLinking(false);
              setUrl("");
            }
            if (event.key === "Escape") {
              setLinking(false);
              editor.commands.focus();
            }
          }}
          className="h-[26px] w-[200px] rounded-[6px] bg-transparent px-2 text-[13px] text-[var(--btn-primary-fg)] outline-none placeholder:opacity-60"
        />
      ) : (
        <>
          {buttons.map((b) => (
            <button
              key={b.id}
              type="button"
              title={b.label}
              aria-label={b.label}
              aria-pressed={b.active}
              data-format={b.id}
              onClick={b.onClick}
              className={`grid h-[26px] min-w-7 place-items-center rounded-[6px] px-1.5 text-[13px] hover:bg-white/15 ${
                b.active ? "bg-white/20" : ""
              }`}
            >
              {b.node}
            </button>
          ))}
          <button
            type="button"
            title="Link"
            aria-label="Link"
            aria-pressed={editor.isActive("link")}
            data-format="link"
            onClick={() => {
              setUrl((editor.getAttributes("link").href as string | undefined) ?? "");
              setLinking(true);
            }}
            className={`h-[26px] rounded-[6px] px-2 text-[12px] hover:bg-white/15 ${
              editor.isActive("link") ? "bg-white/20" : ""
            }`}
          >
            Link
          </button>
        </>
      )}
    </div>
  );
}
