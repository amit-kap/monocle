import { useState, type ReactNode } from "react";
import { getStoredTheme, storeTheme, type Theme } from "../lib/theme";

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

const OPTIONS: { value: Theme; label: string; icon: ReactNode }[] = [
  { value: "system", label: "System theme", icon: <MonitorIcon /> },
  { value: "light", label: "Light theme", icon: <SunIcon /> },
  { value: "dark", label: "Dark theme", icon: <MoonIcon /> },
];

export function ThemeSelector() {
  const [theme, setTheme] = useState<Theme>(getStoredTheme);

  function choose(next: Theme) {
    setTheme(next);
    storeTheme(next);
  }

  return (
    <div className="flex items-center gap-0.5 rounded-[var(--radius)] bg-[var(--bg-active)] p-0.5">
      {OPTIONS.map((option) => (
        <button
          key={option.value}
          type="button"
          title={option.label}
          aria-label={option.label}
          aria-pressed={theme === option.value}
          onClick={() => choose(option.value)}
          className={`grid h-6 w-6 place-items-center rounded-[4px] ${
            theme === option.value
              ? "bg-[var(--bg)] text-[var(--text)] shadow-sm"
              : "text-[var(--text-faint)] hover:text-[var(--text)]"
          }`}
        >
          {option.icon}
        </button>
      ))}
    </div>
  );
}
