import { beforeEach, describe, expect, it } from "vitest";
import {
  DISMISS,
  answerModal,
  askModal,
  askUnsavedChanges,
  useModalPrompt,
} from "./useModalPrompt";

const request = {
  title: "Delete note",
  body: '"A.md" will be deleted.',
  actions: [{ value: "delete" as const, label: "Delete", tone: "danger" as const }],
};

describe("modal prompt", () => {
  beforeEach(() => {
    useModalPrompt.setState({ pending: null });
  });

  it("exposes the request while it is open", () => {
    void askModal(request);
    const { pending } = useModalPrompt.getState();
    expect(pending?.title).toBe("Delete note");
    expect(pending?.body).toContain("A.md");
  });

  it("resolves an action's value when it is chosen", async () => {
    const answer = askModal(request);
    answerModal("delete");
    await expect(answer).resolves.toBe("delete");
  });

  it("resolves DISMISS when the modal is dismissed", async () => {
    const answer = askModal(request);
    answerModal(DISMISS);
    await expect(answer).resolves.toBe(DISMISS);
  });

  it("closes once answered", async () => {
    const answer = askModal(request);
    answerModal(DISMISS);
    await answer;
    expect(useModalPrompt.getState().pending).toBeNull();
  });

  it("ignores an answer when nothing is open", () => {
    expect(() => answerModal(DISMISS)).not.toThrow();
  });

  it("dismisses a modal that a newer one replaces", async () => {
    const first = askModal(request);
    const second = askModal({ ...request, title: "Unsaved changes" });

    await expect(first).resolves.toBe(DISMISS);
    expect(useModalPrompt.getState().pending?.title).toBe("Unsaved changes");

    answerModal(DISMISS);
    await expect(second).resolves.toBe(DISMISS);
  });
});

describe("askUnsavedChanges", () => {
  beforeEach(() => {
    useModalPrompt.setState({ pending: null });
  });

  it("offers discard and save, and names the note", () => {
    void askUnsavedChanges("Design notes.md");
    const { pending } = useModalPrompt.getState();
    expect(pending?.title).toBe("Unsaved changes");
    expect(pending?.body).toContain("Design notes.md");
    expect(pending?.actions).toEqual([
      { value: "discard", label: "Discard changes", tone: "danger" },
      { value: "save", label: "Save", tone: "primary" },
    ]);
    expect(pending?.dismissLabel).toBe("Keep editing");
  });

  it("drops the note name when there is none", () => {
    void askUnsavedChanges(null);
    expect(useModalPrompt.getState().pending?.body).toBe(
      "This note has changes you haven't saved.",
    );
  });
});
