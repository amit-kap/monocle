// Where to put a menu that hangs off an anchor. Used by the block handle's
// menu: it is `position: fixed`, so only the window bounds matter.

// Space between the block's top edge and the menu, so it clears the handle.
export const MENU_GAP_BELOW = 26;

export type MenuPlacement = {
  /** The anchor's top edge, in viewport coordinates. */
  anchorTop: number;
  /** The menu's measured height. Unknown until it has rendered once. */
  height: number;
  /** The bottom edge of the visible area, in viewport coordinates. */
  viewportBottom: number;
  /** Pushed down by this much so the menu clears the handle below the anchor. */
  gapBelow?: number;
  /** Kept above the anchor when the menu opens upward instead. */
  gapAbove?: number;
  /** Never let the menu touch the window's edges. */
  margin?: number;
};

/**
 * The `top` for a fixed-position menu. Below the anchor when it fits, above it
 * when it doesn't, and clamped into the viewport when neither side has room —
 * a menu taller than the window overlaps the anchor rather than running off.
 */
export function menuTop({
  anchorTop,
  height,
  viewportBottom,
  gapBelow = MENU_GAP_BELOW,
  gapAbove = 4,
  margin = 8,
}: MenuPlacement): number {
  const below = anchorTop + gapBelow;
  if (below + height <= viewportBottom - margin) return below;

  const above = anchorTop - gapAbove - height;
  if (above >= margin) return above;

  // Neither side fits whole: keep it on screen, as low as the viewport allows.
  return Math.max(margin, viewportBottom - margin - height);
}
