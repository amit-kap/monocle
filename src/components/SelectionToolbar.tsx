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
  const [turning, setTurning] = useState(false);
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
          setTurning(false);
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
    // ⌘B and friends change marks without moving the selection.
    editor.on("transaction", update);
    editor.on("blur", update);
    editor.on("focus", update);
    return () => {
      editor.off("selectionUpdate", update);
      editor.off("transaction", update);
      editor.off("blur", update);
      editor.off("focus", update);
    };
  }, [editor]);

  if (!editor || !box) return null;

  function run(command: () => void) {
    command();
    bump((n) => n + 1);
  }

  const kinds: { id: string; label: string; active: boolean; apply: () => void }[] = [
    { id: "paragraph", label: "Text", active: editor.isActive("paragraph") && !editor.isActive("bulletList") && !editor.isActive("orderedList") && !editor.isActive("taskList") && !editor.isActive("blockquote"),
      apply: () => editor.chain().focus().clearNodes().run() },
    ...([1, 2, 3, 4, 5, 6] as const).map((level) => ({
      id: `h${level}`,
      label: `Heading ${level}`,
      active: editor.isActive("heading", { level }),
      apply: () => editor.chain().focus().clearNodes().setNode("heading", { level }).run(),
    })),
    { id: "bulletList", label: "Bullet list", active: editor.isActive("bulletList"),
      apply: () => editor.chain().focus().clearNodes().toggleBulletList().run() },
    { id: "orderedList", label: "Numbered list", active: editor.isActive("orderedList"),
      apply: () => editor.chain().focus().clearNodes().toggleOrderedList().run() },
    { id: "taskList", label: "Task list", active: editor.isActive("taskList"),
      apply: () => editor.chain().focus().clearNodes().toggleTaskList().run() },
    { id: "blockquote", label: "Quote", active: editor.isActive("blockquote"),
      apply: () => editor.chain().focus().clearNodes().toggleBlockquote().run() },
    { id: "codeBlock", label: "Code block", active: false,
      apply: () => editor.chain().focus().clearNodes().setCodeBlock().run() },
  ];
  const current = [...kinds].reverse().find((k) => k.active)?.label ?? "Text";

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
          <div className="relative">
            <button
              type="button"
              title="Turn into"
              aria-label="Turn into"
              aria-haspopup="menu"
              aria-expanded={turning}
              data-format="turn-into"
              onClick={() => setTurning((v) => !v)}
              className="flex h-[26px] items-center gap-1 rounded-[6px] px-2 text-[12px] fmt-btn"
            >
              {current}
              <span aria-hidden className="text-[9px] opacity-70">▾</span>
            </button>
            {turning && (
              <div
                role="menu"
                className="block-menu min-w-[170px]"
                style={{ left: box.left, top: box.top + 38, maxHeight: window.innerHeight - box.top - 50, overflowY: "auto" }}
              >
                {kinds.map((k) => (
                  <button
                    key={k.id}
                    type="button"
                    role="menuitemradio"
                    aria-checked={k.label === current}
                    data-turn-into={k.id}
                    onClick={() => {
                      k.apply();
                      setTurning(false);
                      bump((n) => n + 1);
                    }}
                    className="block-menu-item"
                  >
                    {k.label}
                    {k.label === current && <span className="ml-auto">✓</span>}
                  </button>
                ))}
              </div>
            )}
          </div>
          <span aria-hidden className="mx-0.5 h-4 w-px bg-current opacity-20" />
          {buttons.map((b) => (
            <button
              key={b.id}
              type="button"
              title={b.label}
              aria-label={b.label}
              aria-pressed={b.active}
              data-format={b.id}
              onClick={b.onClick}
              className="grid h-[26px] min-w-7 place-items-center rounded-[6px] px-1.5 text-[13px] fmt-btn"
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
            className="h-[26px] rounded-[6px] px-2 text-[12px] fmt-btn"
          >
            Link
          </button>
          <button
            type="button"
            title="Clear formatting"
            aria-label="Clear formatting"
            data-format="clear"
            onClick={() => run(() => editor.chain().focus().unsetAllMarks().run())}
            className="grid h-[26px] min-w-7 place-items-center rounded-[6px] px-1.5 text-[13px] fmt-btn"
          >
            <span className="relative">T<sub className="text-[8px]">x</sub></span>
          </button>
        </>
      )}
    </div>
  );
}
