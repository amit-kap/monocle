import { useEffect, useRef, type ReactNode } from "react";

export type MenuItem =
  | { separator: true }
  | {
      label: string;
      icon?: ReactNode;
      danger?: boolean;
      onSelect: () => void;
    };

/**
 * A menu at a screen position: the row's dots button and a right-click both
 * open this one. Closes on Escape, a click outside, or a choice.
 */
export function ContextMenu({
  x,
  y,
  items,
  onClose,
}: {
  x: number;
  y: number;
  items: MenuItem[];
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDown(event: MouseEvent) {
      if (!ref.current?.contains(event.target as Node)) onClose();
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("mousedown", onDown, true);
    window.addEventListener("keydown", onKey, true);
    window.addEventListener("blur", onClose);
    return () => {
      window.removeEventListener("mousedown", onDown, true);
      window.removeEventListener("keydown", onKey, true);
      window.removeEventListener("blur", onClose);
    };
  }, [onClose]);

  // Keep the menu on screen near the window's right and bottom edges.
  const left = Math.max(8, Math.min(x, window.innerWidth - 232));
  const top = Math.max(8, Math.min(y, window.innerHeight - 8 - items.length * 32));

  return (
    <div
      ref={ref}
      role="menu"
      className="block-menu"
      style={{ position: "fixed", left, top, zIndex: 70, minWidth: 210 }}
      onContextMenu={(event) => event.preventDefault()}
    >
      {items.map((item, index) =>
        "separator" in item ? (
          <div key={`sep-${index}`} className="block-menu-sep" />
        ) : (
          <button
            key={item.label}
            type="button"
            role="menuitem"
            className="block-menu-item"
            style={item.danger ? { color: "var(--danger)" } : undefined}
            onClick={() => {
              onClose();
              item.onSelect();
            }}
          >
            <span className="grid w-[18px] shrink-0 place-items-center">{item.icon}</span>
            {item.label}
          </button>
        ),
      )}
    </div>
  );
}
