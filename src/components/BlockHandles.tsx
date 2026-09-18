import {
  useEffect,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
} from "react";
import type { Editor } from "@tiptap/react";
import {
  blockAt,
  blockAtY,
  blockBoundaries,
  deleteBlock,
  dropTargetForY,
  duplicateBlock,
  moveBlockTo,
  type BlockHover,
} from "../editor/blockUtils";

type MenuState = {
  from: number;
  to: number;
  top: number;
  left: number;
  label: string;
};

type Anchor = Pick<BlockHover, "from" | "to" | "top" | "left" | "label">;

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
  const dragging = useRef(false);

  useEffect(() => {
    if (!editor || !editorDom) return;
    const dom = editorDom;
    const scroller = dom.closest(".editor-scroll") as HTMLElement | null;

    function onMove(event: MouseEvent) {
      if (dragging.current || menu) return;
      const target = event.target as HTMLElement | null;
      if (target?.closest(".block-handle") || target?.closest(".block-menu")) {
        return;
      }
      if (scroller) {
        const rect = scroller.getBoundingClientRect();
        if (
          event.clientX < rect.left ||
          event.clientX > rect.right ||
          event.clientY < rect.top ||
          event.clientY > rect.bottom
        ) {
          setHover(null);
          return;
        }
      }
      setHover((current) => {
        if (current) {
          const withinBand =
            event.clientY >= current.top - 6 &&
            event.clientY <= current.top + current.height + 6;
          const inGutter = event.clientX <= current.left + 2;
          if (withinBand && inGutter) return current;
        }
        return (
          blockAt(editor!, event.clientX, event.clientY) ??
          blockAtY(editor!, event.clientY)
        );
      });
    }
    function onScroll() {
      setHover(null);
      setMenu(null);
      setDropY(null);
    }
    function onWindowMouseDown(event: MouseEvent) {
      const target = event.target as HTMLElement;
      if (!target.closest(".block-menu")) setMenu(null);
    }

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mousedown", onWindowMouseDown);
    scroller?.addEventListener("scroll", onScroll);
    return () => {
      window.removeEventListener("mousemove", onMove);
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

  function startDrag(event: ReactMouseEvent<HTMLElement>, anchor: Anchor) {
    if (!editor || event.button !== 0) return;
    event.preventDefault();
    const startX = event.clientX;
    const startY = event.clientY;
    let started = false;
    let target: number | null = null;

    function endDrag() {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      window.removeEventListener("keydown", onKey);
      dragging.current = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      setDropY(null);
    }

    function onMove(moveEvent: MouseEvent) {
      if (!started) {
        if (Math.hypot(moveEvent.clientX - startX, moveEvent.clientY - startY) < 4) {
          return;
        }
        started = true;
        dragging.current = true;
        document.body.style.cursor = "grabbing";
        document.body.style.userSelect = "none";
      }
      target = dropTargetForY(editor!, moveEvent.clientY);
      const targetDom = editor!.view.nodeDOM(target) as HTMLElement | null;
      const rect = targetDom?.getBoundingClientRect();
      setDropY(rect ? rect.top : moveEvent.clientY);
    }

    function onUp() {
      const moved = started;
      endDrag();
      if (moved) {
        if (target !== null) {
          moveBlockTo(editor!, anchor.from, anchor.to, target);
        }
      } else {
        setMenu({
          from: anchor.from,
          to: anchor.to,
          top: anchor.top,
          left: anchor.left,
          label: anchor.label,
        });
      }
    }

    function onKey(keyEvent: KeyboardEvent) {
      if (keyEvent.key === "Escape") endDrag();
    }

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    window.addEventListener("keydown", onKey);
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
            <>
              <span
                className="block-type"
                style={{ top: handleTop, left: anchor.left - 26 }}
              >
                {anchor.label}
              </span>
              <button
                type="button"
                title="Drag to move, click for menu"
                onMouseDown={(event) => startDrag(event, anchor)}
                className={`block-handle${menu ? " is-active" : ""}`}
                style={{ top: handleTop, left: anchor.left - 26 }}
              >
                <HandleIcon />
              </button>
            </>
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