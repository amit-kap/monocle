import { getCurrentWindow } from "@tauri-apps/api/window";

export type Theme = "system" | "light" | "dark";

const THEME_KEY = "monocle:theme";

export function getStoredTheme(): Theme {
  const value = localStorage.getItem(THEME_KEY);
  return value === "light" || value === "dark" ? value : "system";
}

export function applyTheme(theme: Theme): void {
  const root = document.documentElement;
  if (theme === "system") root.removeAttribute("data-theme");
  else root.setAttribute("data-theme", theme);
  try {
    void getCurrentWindow()
      .setTheme(theme === "system" ? null : theme)
      .catch(() => {});
  } catch {
    // not running under Tauri
  }
}

export function storeTheme(theme: Theme): void {
  localStorage.setItem(THEME_KEY, theme);
  applyTheme(theme);
}
