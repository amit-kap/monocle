import { useMemo } from "react";
import { useStore } from "../store/useStore";
import type { SaveStatus } from "../types";
import { countWords, estimateTokens, formatTokens } from "../lib/tokens";
import { timeAgo } from "../lib/time";
import { CoinsIcon } from "./icons";
import { changeSummary } from "./RightPanel";

// "dirty" reads as saving: autosave follows within a second, so a separate
// "unsaved" state would only flash.
const SAVE_LABEL: Record<SaveStatus, string> = {
  idle: "",
  dirty: "Saving…",
  saving: "Saving…",
  saved: "Saved",
  error: "Not saved",
};

// The meter fills to 5,000 tokens; most instruction files are far below it.
const METER_FULL = 5000;

/**
 * The 28px bar under the note. Left: the token meter, "≈ N tokens" and the word
 * count. Middle: a notice when the file changed on disk, with a link to review
 * it. Right: the save state and the file type.
 */
export function StatusBar() {
  const activePath = useStore((s) => s.activePath);
  const status = useStore((s) => s.status);
  const liveText = useStore((s) => s.liveText);
  const notice = useStore((s) => (s.activePath ? s.changes[s.activePath] : undefined));
  const setRightTab = useStore((s) => s.setRightTab);
  const toggleRight = useStore((s) => s.toggleRight);

  const tokens = useMemo(() => estimateTokens(liveText), [liveText]);
  const words = useMemo(() => countWords(liveText), [liveText]);

  function review() {
    setRightTab("changes");
    if (!useStore.getState().rightOpen) toggleRight();
  }

  return (
    <footer className="flex h-7 shrink-0 items-center gap-4 border-t border-[var(--border)] px-5 text-[12px] text-[var(--text-muted)]">
      <div className="flex items-center gap-2 whitespace-nowrap" data-slot="left">
        {activePath && (
          <>
            <span className="h-1 w-12 rounded-sm bg-[var(--border)]" aria-hidden>
              <i
                className="block h-1 rounded-sm bg-[var(--accent)]"
                style={{ width: `${Math.min(100, (tokens / METER_FULL) * 100)}%` }}
              />
            </span>
            <CoinsIcon className="size-3" />
            <b data-tokens className="font-semibold text-[var(--text)]">
              ≈ {formatTokens(tokens)} tokens
            </b>
            <span data-words>{formatTokens(words)} words</span>
          </>
        )}
      </div>
      <div className="flex min-w-0 flex-1 items-center gap-2 overflow-hidden whitespace-nowrap" data-slot="middle">
        {notice && (
          <>
            <span className="size-1.5 shrink-0 rounded-full bg-[var(--accent)]" />
            <span data-change-notice className="truncate">
              Changed on disk {timeAgo(notice.at)} · {changeSummary(notice.before, notice.after)}
            </span>
            <button
              type="button"
              data-review-diff
              onClick={review}
              className="shrink-0 font-semibold text-[var(--accent)] hover:underline"
            >
              Review diff
            </button>
          </>
        )}
      </div>
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
