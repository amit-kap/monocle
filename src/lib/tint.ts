// The page tint colours the editor's writing column, app-wide rather than per
// note. Each tint carries a light and a dark value, and the stylesheet picks
// between them; the swatch in the popover shows the value for the live scheme.

export type Tint = "bone" | "sand" | "sage" | "rose" | "fog";

export type TintSpec = { id: Tint; label: string; light: string; dark: string };

export const TINTS: readonly TintSpec[] = [
  { id: "bone", label: "Bone", light: "#fbfaf7", dark: "#16171b" },
  { id: "sand", label: "Sand", light: "#faf1df", dark: "#322c1e" },
  { id: "sage", label: "Sage", light: "#eaf0e6", dark: "#203029" },
  { id: "rose", label: "Rose", light: "#fce7e7", dark: "#3a2429" },
  { id: "fog", label: "Fog", light: "#e9edf2", dark: "#212a36" },
];

const TINT_KEY = "monocle:pageTint";

export function isTint(value: unknown): value is Tint {
  return TINTS.some((tint) => tint.id === value);
}

export function getStoredTint(): Tint {
  const value = localStorage.getItem(TINT_KEY);
  return isTint(value) ? value : "bone";
}

export function storeTint(tint: Tint): void {
  localStorage.setItem(TINT_KEY, tint);
}
