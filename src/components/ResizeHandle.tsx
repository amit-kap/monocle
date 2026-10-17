import type { CSSProperties, MouseEvent as ReactMouseEvent } from "react";

/**
 * The grab area on a resizable pane's edge: 4px of cursor target straddling a
 * persistent 1px hairline, so an edge stays discoverable while the pointer is
 * somewhere else. The hairline uses the border token and turns accent on hover;
 * double-clicking puts the pane back to its default width.
 *
 * `style` places the handle — it is centred on the edge it resizes, so pass the
 * edge itself (e.g. `left: "100%"` for a pane's right edge).
 */
export function ResizeHandle({
  style,
  onResizeStart,
  onReset,
  label = "Drag to resize, double-click to reset",
}: {
  style: CSSProperties;
  onResizeStart: (event: ReactMouseEvent<HTMLDivElement>) => void;
  onReset?: () => void;
  label?: string;
}) {
  return (
    <div
      onMouseDown={onResizeStart}
      onDoubleClick={onReset}
      title={label}
      aria-hidden
      className="group absolute top-0 z-20 h-full w-1 -translate-x-1/2 cursor-col-resize"
      style={style}
    >
      <div className="pointer-events-none mx-auto h-full w-px bg-[var(--border)] group-hover:bg-[var(--accent)]" />
    </div>
  );
}
