import { useEffect, useRef } from "react";
import { DISMISS, answerModal, useModalPrompt } from "../store/useModalPrompt";

function XIcon() {
  return (
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
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </svg>
  );
}

/**
 * Renders whichever modal was asked for, so every modal in the app shares one
 * shell: the ✕ (like Esc and the backdrop) dismisses without an answer, actions
 * name their outcome, and focus lands on the primary action — or on the ✕ when
 * the only action is destructive, so Enter never deletes by accident.
 */
export function ModalHost() {
  const pending = useModalPrompt((s) => s.pending);
  const primaryRef = useRef<HTMLButtonElement>(null);
  const dismissRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!pending) return;
    const hasPrimary = pending.actions.some((action) => action.tone === "primary");
    (hasPrimary ? primaryRef.current : dismissRef.current)?.focus();
  }, [pending]);

  useEffect(() => {
    if (!pending) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        answerModal(DISMISS);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [pending]);

  if (!pending) return null;

  const dismissLabel = pending.dismissLabel ?? "Close";

  return (
    <div className="modal-backdrop" onMouseDown={() => answerModal(DISMISS)}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        className="modal-card"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <button
          ref={dismissRef}
          type="button"
          className="modal-close"
          aria-label={dismissLabel}
          title={dismissLabel}
          onClick={() => answerModal(DISMISS)}
        >
          <XIcon />
        </button>
        <h2 id="modal-title" className="modal-title">
          {pending.title}
        </h2>
        <p className="modal-body">{pending.body}</p>
        <div className="modal-actions">
          {pending.actions.map((action) => (
            <button
              key={action.value}
              ref={action.tone === "primary" ? primaryRef : undefined}
              type="button"
              className={`modal-btn${
                action.tone === "primary"
                  ? " is-primary"
                  : action.tone === "danger"
                    ? " is-danger"
                    : ""
              }`}
              onClick={() => answerModal(action.value)}
            >
              {action.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
