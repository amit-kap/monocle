import { PanelLeft, PanelRight } from "lucide-react";

/**
 * The button that hides or shows a side pane. It sits in the same screen
 * position either way: inside its pane's top row while the pane is open, and
 * in the note's top bar once it is closed.
 */
export function PaneToggle({
  side,
  open,
  onClick,
}: {
  side: "left" | "right";
  open: boolean;
  onClick: () => void;
}) {
  const name = side === "left" ? "sidebar" : "panel";
  const shortcut = side === "left" ? "⌘\\" : "⌥⌘\\";
  const label = `${open ? "Hide" : "Show"} ${name}`;
  return (
    <button
      type="button"
      title={`${label} (${shortcut})`}
      aria-label={label}
      aria-pressed={open}
      onClick={onClick}
      className="relative grid h-7 w-7 place-items-center rounded-[6px] text-[var(--text-muted)] hover:bg-[var(--bg-hover)] hover:text-[var(--text)]"
    >
      {side === "left" ? <PanelLeft size={16} aria-hidden /> : <PanelRight size={16} aria-hidden />}
    </button>
  );
}
