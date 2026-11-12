import { useEffect, useState } from "react";
import { useStore } from "../store/useStore";
import { AppearanceControls } from "./AppearanceMenu";
import { XIcon } from "./icons";

type Section = "files" | "appearance";

const SECTIONS: { id: Section; label: string }[] = [
  { id: "files", label: "Files" },
  { id: "appearance", label: "Appearance" },
];

/**
 * Settings, opened from the button beside the root folder or with ⌘,. Two
 * sections: Files (hidden files, the start folder) and Appearance (theme, page
 * tint, page width — moved here from the titlebar).
 */
export function SettingsModal() {
  const open = useStore((s) => s.settingsOpen);
  const close = useStore((s) => s.closeSettings);
  const showHidden = useStore((s) => s.showHidden);
  const setShowHidden = useStore((s) => s.setShowHidden);
  const [section, setSection] = useState<Section>("files");

  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        close();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, close]);

  if (!open) return null;

  return (
    <div className="modal-backdrop" data-settings-backdrop onMouseDown={close}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Settings"
        data-settings
        onMouseDown={(event) => event.stopPropagation()}
        className="flex h-[420px] max-h-[calc(100%-48px)] w-[720px] max-w-[calc(100%-48px)] overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--bg)] shadow-[var(--shadow-modal)]"
      >
        <nav className="flex w-[180px] shrink-0 flex-col border-r border-[var(--border)] bg-[var(--bg-sidebar)] px-2 py-5">
          <h2 className="mx-2 mb-3.5 text-[20px] font-semibold text-[var(--text)]">Settings</h2>
          {SECTIONS.map(({ id, label }) => (
            <button
              key={id}
              type="button"
              data-settings-section={id}
              aria-current={section === id}
              onClick={() => setSection(id)}
              className={`flex h-[30px] items-center rounded-[6px] px-2 text-left text-[13px] ${
                section === id
                  ? "bg-[var(--bg-active)] font-semibold text-[var(--text)]"
                  : "font-medium text-[var(--text-muted)] hover:bg-[var(--bg-hover)]"
              }`}
            >
              {label}
            </button>
          ))}
        </nav>

        <div className="relative flex min-w-0 flex-1 flex-col gap-5 overflow-y-auto px-7 py-6">
          <button
            type="button"
            aria-label="Close settings"
            title="Close"
            onClick={close}
            className="absolute right-3.5 top-3.5 grid size-7 place-items-center rounded-[6px] text-[var(--text-muted)] hover:bg-[var(--bg-hover)]"
          >
            <XIcon />
          </button>

          {section === "files" && (
            <>
              <div>
                <h3 className="mb-1.5 text-[13px] font-semibold">Start folder</h3>
                <p className="text-[12px] leading-[18px] text-[var(--text-muted)]">
                  Monocle opens on your home folder the first time, then reopens wherever you
                  left off.
                </p>
              </div>
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <h3 className="mb-1.5 text-[13px] font-semibold">
                    Show hidden files and folders
                  </h3>
                  <p className="text-[12px] leading-[18px] text-[var(--text-muted)]">
                    Names that start with a dot, such as .claude.
                  </p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={showHidden}
                  aria-label="Show hidden files and folders"
                  data-hidden-toggle
                  onClick={() => void setShowHidden(!showHidden)}
                  className={`relative h-5 w-[34px] shrink-0 rounded-full transition-colors ${
                    showHidden ? "bg-[var(--accent)]" : "bg-[var(--border-strong)]"
                  }`}
                >
                  <span
                    className={`absolute top-0.5 size-4 rounded-full bg-white transition-[left] ${
                      showHidden ? "left-4" : "left-0.5"
                    }`}
                  />
                </button>
              </div>
            </>
          )}

          {section === "appearance" && (
            <div data-appearance-section className="flex flex-col gap-5">
              <AppearanceControls />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
