import { beforeEach, describe, expect, it } from "vitest";
import {
  answerUnsavedChanges,
  askUnsavedChanges,
  useUnsavedPrompt,
} from "./useUnsavedPrompt";

describe("unsaved-changes prompt", () => {
  beforeEach(() => {
    useUnsavedPrompt.setState({ pending: null });
  });

  it("exposes the note name while the question is open", () => {
    void askUnsavedChanges("A.md");
    expect(useUnsavedPrompt.getState().pending?.note).toBe("A.md");
  });

  it("resolves with the choice the dialog reported", async () => {
    const answer = askUnsavedChanges("A.md");
    answerUnsavedChanges("discard");
    await expect(answer).resolves.toBe("discard");
  });

  it("closes the question once answered", async () => {
    const answer = askUnsavedChanges("A.md");
    answerUnsavedChanges("save");
    await answer;
    expect(useUnsavedPrompt.getState().pending).toBeNull();
  });

  it("ignores an answer when nothing is being asked", () => {
    expect(() => answerUnsavedChanges("save")).not.toThrow();
  });

  it("cancels a question that a newer one replaces", async () => {
    const first = askUnsavedChanges("A.md");
    const second = askUnsavedChanges("B.md");

    await expect(first).resolves.toBe("cancel");
    expect(useUnsavedPrompt.getState().pending?.note).toBe("B.md");

    answerUnsavedChanges("save");
    await expect(second).resolves.toBe("save");
  });
});
