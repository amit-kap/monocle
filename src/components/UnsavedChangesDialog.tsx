import { useEffect, useRef } from "react";
import {
  answerUnsavedChanges,
  useUnsavedPrompt,
} from "../store/useUnsavedPrompt";

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
 * Blocks note switches and quitting until the user decides what happens to
 * unsaved edits. Both actions name their outcome — the native alert it replaced
 * made "OK" mean "lose it" — and the ✕ (like Esc and the backdrop) means keep
 * editing, so no button is spent saying "cancel".
 */
export function UnsavedChangesDialog() {
  const pending = useUnsavedPrompt((s) => s.pending);
  const saveRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (pending) saveRef.current?.focus();
  }, [pending]);

  useEffect(() => {
    if (!pending) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        answerUnsavedChanges("cancel");
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [pending]);

  if (!pending) return null;

  return (
    <div
      className="modal-backdrop"
      onMouseDown={() => answerUnsavedChanges("cancel")}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="unsaved-title"
        className="modal-card"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          className="modal-close"
          aria-label="Keep editing"
          title="Keep editing"
          onClick={() => answerUnsavedChanges("cancel")}
        >
          <XIcon />
        </button>
        <h2 id="unsaved-title" className="modal-title">
          Unsaved changes
        </h2>
        <p className="modal-body">
          {pending.note
            ? `"${pending.note}" has changes you haven't saved.`
            : "This note has changes you haven't saved."}
        </p>
        <div className="modal-actions">
          <button
            type="button"
            className="modal-btn is-danger"
            onClick={() => answerUnsavedChanges("discard")}
          >
            Discard changes
          </button>
          <button
            ref={saveRef}
            type="button"
            className="modal-btn is-primary"
            onClick={() => answerUnsavedChanges("save")}
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

