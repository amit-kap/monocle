import { beforeEach, describe, expect, it, vi } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { AppearanceMenu } from "./AppearanceMenu";
import { useStore } from "../store/useStore";

// jsdom has no layout and no transitions, but it does have the DOM the panel's
// state machine drives: mounted or not, and which way it is facing.
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;

function render() {
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  act(() => root.render(<AppearanceMenu />));
}

function button(): HTMLButtonElement {
  return container.querySelector<HTMLButtonElement>("button[aria-label='Appearance']")!;
}

function dialog(): HTMLElement | null {
  return container.querySelector<HTMLElement>("[role='dialog']");
}

describe("AppearanceMenu", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
    localStorage.clear();
    useStore.setState({ activePath: null, tint: "bone", contentWidth: 860 });
    Object.assign(document.documentElement, {});
  });

  it("mounts nothing until the button is pressed", () => {
    render();
    expect(dialog()).toBeNull();
  });

  it("shows the panel when the button is pressed", () => {
    render();
    act(() => button().click());
    const panel = dialog();
    expect(panel).not.toBeNull();
    // Open is the resting style: only closing may hide it.
    expect(panel!.dataset.closing).toBe("false");
  });

  it("marks the panel as closing, then unmounts it", () => {
    vi.useFakeTimers();
    render();
    act(() => button().click());
    act(() => button().click());
    expect(dialog()!.dataset.closing).toBe("true");
    act(() => void vi.advanceTimersByTime(150));
    expect(dialog()).toBeNull();
    vi.useRealTimers();
  });

  it("keeps theme live but disables the page settings with no note open", () => {
    render();
    act(() => button().click());
    const themed = [...container.querySelectorAll<HTMLButtonElement>(".theme-switch button")];
    expect(themed.every((b) => !b.disabled)).toBe(true);

    const chips = [...container.querySelectorAll<HTMLButtonElement>(".tint-chip")];
    expect(chips.every((c) => c.disabled)).toBe(true);
    expect(container.querySelector<HTMLInputElement>(".width-input")!.disabled).toBe(true);
  });

  it("enables the page settings once a note is open", () => {
    useStore.setState({ activePath: "/notes/A.md" });
    render();
    act(() => button().click());
    const chips = [...container.querySelectorAll<HTMLButtonElement>(".tint-chip")];
    expect(chips.every((c) => !c.disabled)).toBe(true);
    expect(container.querySelector<HTMLInputElement>(".width-input")!.disabled).toBe(false);
  });
});
