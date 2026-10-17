import { create } from "zustand";

/** An action button in a modal. Its label is what happens, so no button needs
 * to say "OK". */
export type ModalAction<T extends string = string> = {
  /** Resolved when this action is chosen. */
  value: T;
  label: string;
  /** `primary` is focused when the modal opens; `danger` is styled as such. */
  tone?: "primary" | "danger";
};

export type ModalRequest<T extends string = string> = {
  title: string;
  body: string;
  actions: ModalAction<T>[];
  /** What the ✕ does, read out loud. Defaults to "Close". */
  dismissLabel?: string;
};

/** What a modal resolves with when the ✕, Esc or the backdrop dismisses it. */
export const DISMISS = "dismiss";

export type ModalAnswer<T extends string = string> = T | typeof DISMISS;

type Pending = ModalRequest & { resolve: (value: string) => void };

type State = { pending: Pending | null };

export const useModalPrompt = create<State>(() => ({ pending: null }));

/**
 * Open a modal and wait for the answer: an action's value, or `DISMISS`.
 * `<ModalHost />` renders it.
 *
 * Asking while a modal is already open dismisses the older one, so a stray
 * second request can't leave a promise (and the UI) hanging.
 */
export function askModal<T extends string>(
  request: ModalRequest<T>,
): Promise<ModalAnswer<T>> {
  return new Promise<ModalAnswer<T>>((resolve) => {
    const previous = useModalPrompt.getState().pending;
    if (previous) previous.resolve(DISMISS);
    useModalPrompt.setState({
      pending: { ...request, resolve: resolve as (value: string) => void },
    });
  });
}

export function answerModal(value: string): void {
  const { pending } = useModalPrompt.getState();
  if (!pending) return;
  // Clear before resolving: the answer can open another modal.
  useModalPrompt.setState({ pending: null });
  pending.resolve(value);
}

/**
 * The unsaved-changes modal. One definition, used both when the store is about
 * to replace the open note and when the window is about to close.
 */
export function askUnsavedChanges(
  note: string | null,
): Promise<ModalAnswer<"save" | "discard">> {
  return askModal<"save" | "discard">({
    title: "Unsaved changes",
    body: note
      ? `"${note}" has changes you haven't saved.`
      : "This note has changes you haven't saved.",
    actions: [
      { value: "discard", label: "Discard changes", tone: "danger" },
      { value: "save", label: "Save", tone: "primary" },
    ],
    dismissLabel: "Keep editing",
  });
}
