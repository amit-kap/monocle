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
  // nothing on a large display.
  max: 1200,
  default: 860,
} as const;

export type WidthSpec = { key: string; min: number; max: number; default: number };

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