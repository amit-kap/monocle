// Widths for the two resizable panes. Both are dragged by the user and
// persisted, so the bounds and defaults live together.

export const SIDEBAR = {
  key: "monocle:sidebarWidth",
  min: 180,
  max: 480,
  default: 240,
} as const;

export const CONTENT = {
  key: "monocle:contentWidth",
  min: 560,
  // Wider than a typical prose measure: code blocks, tables and wide quotes
  // all need the room, and the column stays centred so extra width costs
  // nothing on a large display. (A test pins this: the old fixed 720 was
  // deliberately widened.)
  max: 1200,
  default: 860,
} as const;

export type WidthSpec = { key: string; min: number; max: number; default: number };

export type ColumnSide = "left" | "right";

// The content column is centred in its pane, so its edges sit at centre ± half
// the width. This returns the CSS `left` value that puts a grab handle on the
// given edge.
export function columnEdgeLeft(width: number, side: ColumnSide): string {
  const half = width / 2;
  return side === "left" ? `calc(50% - ${half}px)` : `calc(50% + ${half}px)`;
}

// Dragging an edge of a centred column by `deltaX` pixels changes the width by
// twice the delta: the column stays centred, so each edge moves half the total.
// Pulling the right edge rightwards widens it; pulling the left edge rightwards
// narrows it.
export function widthFromDrag(
  startWidth: number,
  deltaX: number,
  side: ColumnSide,
): number {
  const direction = side === "left" ? -1 : 1;
  return startWidth + deltaX * 2 * direction;
}

export function clampWidth(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function readWidth(spec: WidthSpec, store: Storage): number {
  const saved = Number(store.getItem(spec.key));
  return saved >= spec.min && saved <= spec.max ? saved : spec.default;
}

export function storeWidth(spec: WidthSpec, store: Storage, value: number): void {
  store.setItem(spec.key, String(value));
}