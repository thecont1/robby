export type VisualTheme = "light" | "dark";

export function themeControlLabel(theme: VisualTheme) {
  return theme === "dark" ? "switch to light mode" : "switch to dark mode";
}

export function isImageOnlyExitKey(key: string) {
  return key === "Escape";
}

/** Returns the gallery step for a horizontal touch gesture, or zero when the
 * movement is too short to be an intentional swipe. */
export function swipeGalleryOffset(startX: number, endX: number, threshold = 52) {
  const distance = endX - startX;
  if (Math.abs(distance) < threshold) return 0;
  return distance < 0 ? 1 : -1;
}
