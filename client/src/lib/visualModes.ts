export type VisualTheme = "light" | "dark";

export function themeControlLabel(theme: VisualTheme) {
  return theme === "dark" ? "switch to light mode" : "switch to dark mode";
}

export function isImageOnlyExitKey(key: string) {
  return key === "Escape";
}
