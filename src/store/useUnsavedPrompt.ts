import { create } from "zustand";

/** What the user chose in the unsaved-changes prompt. */
export type UnsavedChoice = "save" | "discard" | "cancel";

type Pending = {
  /** File name of the note with unsaved edits, to name it in the prompt. */
  note: string | null;
  resolve: (choice: UnsavedChoice) => void;
};

type State = { pending: Pending | null };

export const useUnsavedPrompt = create<State>(() => ({ pending: null }));

/**
 * Ask the user what to do about unsaved edits. Resolves when they answer; the
 * `<UnsavedChangesDialog />` rendered from this state is what answers it.
 *
 * Asking while a prompt is already open cancels the older one, so a stray
 * second request can't leave a promise (and the UI) hanging.
 */
export function askUnsavedChanges(note: string | null): Promise<UnsavedChoice> {
  return new Promise((resolve) => {
    const previous = useUnsavedPrompt.getState().pending;
    if (previous) previous.resolve("cancel");
    useUnsavedPrompt.setState({ pending: { note, resolve } });
  });
}

export function answerUnsavedChanges(choice: UnsavedChoice): void {
  const { pending } = useUnsavedPrompt.getState();
  if (!pending) return;
  // Clear before resolving: the answer can start another prompt.
  useUnsavedPrompt.setState({ pending: null });
  pending.resolve(choice);
}
