import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { getStoredTheme, storeTheme, type Theme } from "../lib/theme";
import { TINTS } from "../lib/tint";
import { CONTENT } from "../lib/layout";
import { useStore } from "../store/useStore";

function MonitorIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="size-3.5" aria-hidden>
      <rect
        x="2"
        y="3"
        width="20"
        height="14"
        rx="2"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M8 21h8M12 17v4"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function SunIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="size-3.5" aria-hidden>
      <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="2" />
      <path
        d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="size-3.5" aria-hidden>
      <path
        d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Three rules with their knobs: the appearance controls, in one glyph. */
function SlidersIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M6.666 3.334H2M8 12.667H2M5.334 8H2" />
      <path d="M9.334 2v2.667M10.666 11.334v2.666M5.334 6.667v2.667" />
      <path d="M14 8h-6M14 12.667h-3.334M14 3.334h-4.666" />
    </svg>
  );
}

const THEME_OPTIONS: { value: Theme; label: string; icon: ReactNode }[] = [
  { value: "system", label: "System theme", icon: <MonitorIcon /> },
  { value: "light", label: "Light theme", icon: <SunIcon /> },
  { value: "dark", label: "Dark theme", icon: <MoonIcon /> },
];

/**
 * The titlebar's appearance button and the popover it opens: theme, page tint
 * and page width in one place, so nothing floats over the page while writing.
 */
export function AppearanceMenu() {
  const [open, setOpen] = useState(false);
  const [theme, setTheme] = useState<Theme>(getStoredTheme);
  const tint = useStore((s) => s.tint);
  const setTint = useStore((s) => s.setTint);
  const contentWidth = useStore((s) => s.contentWidth);
  const setContentWidth = useStore((s) => s.setContentWidth);
  const anchorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDown(event: MouseEvent) {
      if (!anchorRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    window.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  function chooseTheme(next: Theme) {
    setTheme(next);
    storeTheme(next);
  }

  return (
    <div ref={anchorRef} className="relative">
      <button
        type="button"
        title="Appearance"
        aria-label="Appearance"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="appearance-btn"
      >
        <SlidersIcon />
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Appearance"
          className="appearance-popover"
        >
          <div className="appearance-group">
            <span className="appearance-label" id="appearance-theme">
              Theme
            </span>
            <div
              role="group"
              aria-labelledby="appearance-theme"
              className="theme-switch"
            >
              {THEME_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  title={option.label}
                  aria-label={option.label}
                  aria-pressed={theme === option.value}
                  onClick={() => chooseTheme(option.value)}
                >
                  {option.icon}
                </button>
              ))}
            </div>
          </div>

          <div className="appearance-group">
            <span className="appearance-label" id="appearance-tint">
              Page tint
            </span>
            <div
              role="group"
              aria-labelledby="appearance-tint"
              className="tint-row"
            >
              {TINTS.map((spec) => (
                <button
                  key={spec.id}
                  type="button"
                  title={spec.label}
                  aria-label={spec.label}
                  aria-pressed={tint === spec.id}
                  onClick={() => setTint(spec.id)}
                  className="tint-chip"
                  style={
                    {
                      "--chip-light": spec.light,
                      "--chip-dark": spec.dark,
                    } as CSSProperties
                  }
                />
              ))}
            </div>
          </div>

          <div className="appearance-group">
            <div className="appearance-head">
              <label className="appearance-label" htmlFor="appearance-width">
                Page width
              </label>
              <span className="appearance-value">{contentWidth}</span>
            </div>
            <input
              id="appearance-width"
              type="range"
              className="width-input"
              min={CONTENT.min}
              max={CONTENT.max}
              step={10}
              value={contentWidth}
              onChange={(event) =>
                setContentWidth(Number(event.currentTarget.value))
              }
            />
          </div>
        </div>
      )}
    </div>
  );
}
