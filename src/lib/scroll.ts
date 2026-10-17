// Reveal a row inside a scroll container with the least movement possible.

export type Rect = { top: number; bottom: number };

/**
 * The delta to add to a scroll container's `scrollTop` to bring `item` into
 * view. Zero when the item is already visible. Returned as a delta (rather than
 * scrolled directly) so only the container moves — the page around it stays
 * put, and a row taller than the container aligns to its top.
 */
export function scrollDelta(container: Rect, item: Rect): number {
  if (item.top < container.top) return item.top - container.top;
  if (item.bottom > container.bottom) return item.bottom - container.bottom;
  return 0;
}
