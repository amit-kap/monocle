import { useEffect, useRef } from "react";
import {
  answerUnsavedChanges,
  useUnsavedPrompt,
} from "../store/useUnsavedPrompt";

/**
 * Blocks note switches and quitting until the user decides what happens to
 * unsaved edits. Each button names its outcome, so there is no guessing which
 * one keeps the work — the old OK/Cancel alert made "OK" mean "lose it".
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
            className="modal-btn"
            onClick={() => answerUnsavedChanges("cancel")}
          >
            Keep editing
          </button>
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
