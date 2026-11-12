// Widths for the two resizable panes. Both are dragged by the user and
// persisted, so the bounds and defaults live together.

export const SIDEBAR = {
  key: "monocle:sidebarWidth",
  min: 200,
  max: 440,
  default: 240,
} as const;

export const RIGHT_PANEL = {
  key: "monocle:rightWidth",
  min: 220,
  max: 460,
  default: 280,
} as const;

export const LEFT_OPEN_KEY = "monocle:leftOpen";
export const RIGHT_OPEN_KEY = "monocle:rightOpen";
export const RIGHT_TAB_KEY = "monocle:rightTab";

// A pane is open unless the user closed it, so anything unreadable means open.
export function readOpen(key: string, store: Storage): boolean {
  try {
    return store.getItem(key) !== "0";
  } catch {
    return true;
  }
}

export function storeOpen(key: string, store: Storage, open: boolean): void {
  try {
    store.setItem(key, open ? "1" : "0");
  } catch {
    // Storage can be blocked; the pane just won't be remembered.
  }
}

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
// The window's top row is 40px (`h-10`) in the sidebar, the note's top bar and
// the right panel. The macOS traffic lights are centred on that row by
// src-tauri/src/traffic_lights.rs, which has its own TOP_ROW_HEIGHT; a test
// fails if the two differ, so the lights follow the row and need no tuning.
export const TOP_ROW_HEIGHT = 40;
export const TRAFFIC_LIGHT_SLOT_WIDTH = 72;
