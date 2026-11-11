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
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <rect width="18" height="18" x="3" y="3" rx="2" />
        <path d={side === "left" ? "M9 3v18" : "M15 3v18"} />
      </svg>
    </button>
  );
}
