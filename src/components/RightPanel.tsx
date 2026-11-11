import { useEffect, useState } from "react";
import { useStore } from "../store/useStore";
import { RIGHT_TABS, type RightTab } from "../types";
import { RIGHT_PANEL, clampWidth, readWidth, storeWidth } from "../lib/layout";
import { PaneToggle } from "./PaneToggle";
import { ResizeHandle } from "./ResizeHandle";

const TAB_LABEL: Record<RightTab, string> = {
  outline: "Outline",
  context: "Context",
  changes: "Changes",
};

// What each tab says until it has something to show. The tabs fill in with the
// tokens and changes work; the frame is here first so the layout is settled.
const EMPTY: Record<RightTab, string> = {
  outline: "Open a note to see its headings.",
  context: "Open a note to see what an agent loads with it.",
  changes: "Open a note to see changes made outside the app.",
};

/**
 * The inspector on the right: Outline, Context and Changes. Resizable from its
 * left edge between 220 and 460px, and collapsible; both choices are remembered.
 */
export function RightPanel() {
  const open = useStore((s) => s.rightOpen);
  const tab = useStore((s) => s.rightTab);
  const toggleRight = useStore((s) => s.toggleRight);
  const setRightTab = useStore((s) => s.setRightTab);
  const activePath = useStore((s) => s.activePath);
  const [width, setWidth] = useState(() => readWidth(RIGHT_PANEL, localStorage));

  useEffect(() => {
    storeWidth(RIGHT_PANEL, localStorage, width);
  }, [width]);

  function startResize(startX: number) {
    const startWidth = width;
    function onMove(event: MouseEvent) {
      // The handle is on the left edge, so dragging left widens the panel.
      const next = startWidth - (event.clientX - startX);
      setWidth(clampWidth(next, RIGHT_PANEL.min, RIGHT_PANEL.max));
    }
    function onUp() {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    }
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  }

  if (!open) return null;

  return (
    <aside
      className="relative flex h-full shrink-0 flex-col bg-[var(--bg-sidebar)]"
      style={{ width }}
      aria-label="Inspector"
    >
      <div className="relative flex h-10 shrink-0 items-center gap-0.5 border-b border-[var(--border)] px-3">
        <div data-tauri-drag-region className="absolute inset-0" />
        <div role="tablist" className="relative flex items-center gap-0.5">
          {RIGHT_TABS.map((id) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={tab === id}
              onClick={() => setRightTab(id)}
              className={`h-[26px] rounded-[6px] px-2.5 text-[12px] ${
                tab === id
                  ? "bg-[var(--bg-active)] font-semibold text-[var(--text)]"
                  : "font-medium text-[var(--text-muted)] hover:bg-[var(--bg-hover)] hover:text-[var(--text)]"
              }`}
            >
              {TAB_LABEL[id]}
            </button>
          ))}
        </div>
        <div className="relative ml-auto">
          <PaneToggle side="right" open onClick={toggleRight} />
        </div>
      </div>

      <div role="tabpanel" className="flex-1 overflow-y-auto px-5 py-4">
        <p className="text-[13px] leading-5 text-[var(--text-faint)]">
          {activePath ? "Nothing to show yet." : EMPTY[tab]}
        </p>
      </div>

      <ResizeHandle
        style={{ left: 0 }}
        onResizeStart={(event) => startResize(event.clientX)}
        onReset={() => setWidth(RIGHT_PANEL.default)}
      />
    </aside>
  );
}
