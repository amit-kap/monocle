import { useEffect, useRef, useState } from "react";
import type { Editor } from "@tiptap/react";
import {
  blockAt,
  blockBoundaries,
  deleteBlock,
  dropTargetForY,
  duplicateBlock,
  moveBlockTo,
  type BlockHover,
} from "../editor/blockUtils";

type MenuState = { from: number; to: number; top: number; left: number };
type DragState = { from: number; to: number } | null;

function HandleIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" aria-hidden>
      <circle cx="6" cy="4" r="1.2" />
      <circle cx="10" cy="4" r="1.2" />
      <circle cx="6" cy="8" r="1.2" />
      <circle cx="10" cy="8" r="1.2" />
      <circle cx="6" cy="12" r="1.2" />
      <circle cx="10" cy="12" r="1.2" />
    </svg>
  );
}

export function BlockHandles({
  editor,
  editorDom,
}: {
  editor: Editor | null;
  editorDom: HTMLElement | null;
}) {
  const [hover, setHover] = useState<BlockHover | null>(null);
  const [menu, setMenu] = useState<MenuState | null>(null);
  const [dropY, setDropY] = useState<number | null>(null);
  const drag = useRef<DragState>(null);

  useEffect(() => {
    if (!editor || !editorDom) return;
    const dom = editorDom;
    const scroller = dom.closest(".editor-scroll") as HTMLElement | null;

    function onMove(event: MouseEvent) {
      if (drag.current || menu) return;
      setHover(blockAt(editor!, event.clientX, event.clientY));
    }
    function onLeave() {
      if (!menu) setHover(null);
    }
    function onScroll() {
      setHover(null);
      setMenu(null);
      setDropY(null);
    }
    function onDragOver(event: DragEvent) {
      if (!drag.current) return;
      event.preventDefault();
      if (event.dataTransfer) event.dataTransfer.dropEffect = "move";
      const target = dropTargetForY(editor!, event.clientY);
      const targetDom = editor!.view.nodeDOM(target) as HTMLElement | null;
      const rect = targetDom?.getBoundingClientRect();
      setDropY(rect ? rect.top : event.clientY);
    }
    function onDrop(event: DragEvent) {
      if (!drag.current) return;
      event.preventDefault();
      const target = dropTargetForY(editor!, event.clientY);
      moveBlockTo(editor!, drag.current.from, drag.current.to, target);
      drag.current = null;
      setDropY(null);
      setHover(null);
    }
    function onDragEnd() {
      drag.current = null;
      setDropY(null);
    }
    function onWindowMouseDown(event: MouseEvent) {
      const target = event.target as HTMLElement;
      if (!target.closest(".block-menu")) setMenu(null);
    }

    dom.addEventListener("mousemove", onMove);
    dom.addEventListener("mouseleave", onLeave);
    dom.addEventListener("dragover", onDragOver);
    dom.addEventListener("drop", onDrop);
    window.addEventListener("dragend", onDragEnd);
    window.addEventListener("mousedown", onWindowMouseDown);
    scroller?.addEventListener("scroll", onScroll);
    return () => {
      dom.removeEventListener("mousemove", onMove);
      dom.removeEventListener("mouseleave", onLeave);
      dom.removeEventListener("dragover", onDragOver);
      dom.removeEventListener("drop", onDrop);
      window.removeEventListener("dragend", onDragEnd);
      window.removeEventListener("mousedown", onWindowMouseDown);
      scroller?.removeEventListener("scroll", onScroll);
    };
  }, [editor, editorDom, menu]);

  function turnInto(from: number, kind: "paragraph" | 1 | 2 | 3) {
    if (!editor) return;
    const chain = editor.chain().focus().setNodeSelection(from);
    if (kind === "paragraph") chain.setParagraph().run();
    else chain.setNode("heading", { level: kind }).run();
    setMenu(null);
  }

  function move(from: number, to: number, direction: -1 | 1) {
    if (!editor) return;
    const doc = editor.state.doc;
    const index = doc.resolve(from).index(0);
    const boundaries = blockBoundaries(editor);
    if (direction === -1 && index > 0) {
      moveBlockTo(editor, from, to, boundaries[index - 1]);
    } else if (direction === 1 && index < doc.childCount - 1) {
      moveBlockTo(editor, from, to, boundaries[index + 2]);
    }
    setMenu(null);
  }

  const handleTop = hover
    ? hover.top + Math.max(0, Math.min(hover.height, 28) - 24) / 2
    : 0;

  return (
    <>
      {(hover || menu) &&
        (() => {
          const anchor = menu ?? hover!;
          return (
            <button
              type="button"
              draggable
              title="Drag to move, click for menu"
              onDragStart={(event) => {
                drag.current = { from: anchor.from, to: anchor.to };
                if (event.dataTransfer) {
                  event.dataTransfer.effectAllowed = "move";
                  event.dataTransfer.setData("text/plain", "");
                }
              }}
              onClick={() =>
                setMenu({
                  from: anchor.from,
                  to: anchor.to,
                  top: anchor.top,
                  left: anchor.left,
                })
              }
              className={`block-handle${menu ? " is-active" : ""}`}
              style={{ top: handleTop, left: anchor.left - 26 }}
            >
              <HandleIcon />
            </button>
          );
        })()}

      {menu && (
        <div
          className="block-menu"
          style={{ top: menu.top + 26, left: menu.left - 26 }}
        >
          <div className="block-menu-label">Turn into</div>
          <button
            type="button"
            className="block-menu-item"
            onClick={() => turnInto(menu.from, "paragraph")}
          >
            Text
          </button>
          <button
            type="button"
            className="block-menu-item"
            onClick={() => turnInto(menu.from, 1)}
          >
            Heading 1
          </button>
          <button
            type="button"
            className="block-menu-item"
            onClick={() => turnInto(menu.from, 2)}
          >
            Heading 2
          </button>
          <button
            type="button"
            className="block-menu-item"
            onClick={() => turnInto(menu.from, 3)}
          >
            Heading 3
          </button>
          <div className="block-menu-sep" />
          <button
            type="button"
            className="block-menu-item"
            onClick={() => {
              duplicateBlock(editor!, menu.from, menu.to);
              setMenu(null);
            }}
          >
            Duplicate
          </button>
          <button
            type="button"
            className="block-menu-item"
            onClick={() => move(menu.from, menu.to, -1)}
          >
            Move up
          </button>
          <button
            type="button"
            className="block-menu-item"
            onClick={() => move(menu.from, menu.to, 1)}
          >
            Move down
          </button>
          <div className="block-menu-sep" />
          <button
            type="button"
            className="block-menu-item is-danger"
            onClick={() => {
              deleteBlock(editor!, menu.from, menu.to);
              setMenu(null);
              setHover(null);
            }}
          >
            Delete
          </button>
        </div>
      )}

      {dropY !== null && (
        <div className="drop-line" style={{ top: dropY }} aria-hidden />
      )}
    </>
  );
}
