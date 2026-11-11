import { useStore } from "../store/useStore";
import type { SaveStatus } from "../types";

// "dirty" reads as saving: autosave follows within a second, so a separate
// "unsaved" state would only flash.
const SAVE_LABEL: Record<SaveStatus, string> = {
  idle: "",
  dirty: "Saving…",
  saving: "Saving…",
  saved: "Saved",
  error: "Not saved",
};

/**
 * The 28px bar under the note. Three slots: the left holds the token meter and
 * word count, the middle the changed-on-disk notice, the right the save state
 * and file type. Only the right slot has content so far.
 */
export function StatusBar() {
  const activePath = useStore((s) => s.activePath);
  const status = useStore((s) => s.status);

  return (
    <footer className="flex h-7 shrink-0 items-center gap-4 border-t border-[var(--border)] px-5 text-[12px] text-[var(--text-muted)]">
      <div className="flex items-center gap-2" data-slot="left" />
      <div className="flex min-w-0 flex-1 items-center gap-2" data-slot="middle" />
      <div className="flex items-center gap-2 whitespace-nowrap" data-slot="right">
        {activePath ? (
          <>
            {SAVE_LABEL[status] && (
              <span
                aria-live="polite"
                className={status === "error" ? "text-[var(--danger)]" : undefined}
              >
                {SAVE_LABEL[status]}
              </span>
            )}
            <span>Markdown</span>
          </>
        ) : (
          <span>No note open</span>
        )}
      </div>
    </footer>
  );
}
