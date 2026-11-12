import { TOP_ROW_HEIGHT, TRAFFIC_LIGHT_SLOT_WIDTH } from "../lib/layout";

/**
 * The room the macOS traffic lights take in the window's top row. The lights
 * are drawn by the OS over this div, so it only reserves the space: the row's
 * other controls start after it, and nothing else needs to know where the
 * lights are. Used by whichever top row sits at the window's left edge.
 */
export function TrafficLightsSlot() {
  return (
    <div
      data-traffic-lights
      aria-hidden
      className="shrink-0"
      style={{ width: TRAFFIC_LIGHT_SLOT_WIDTH, height: TOP_ROW_HEIGHT }}
    />
  );
}
