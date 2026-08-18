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

export type GallerySlideDirection = "forward" | "backward";

/**
 * Chooses the shortest visual route through a circular gallery. Forward means
 * the current specimen exits left and the next specimen enters from the right.
 */
export function gallerySlideDirection(currentIndex: number, nextIndex: number, length: number): GallerySlideDirection {
  if (length < 2) return "forward";
  const forwardDistance = (nextIndex - currentIndex + length) % length;
  const backwardDistance = (currentIndex - nextIndex + length) % length;
  return forwardDistance <= backwardDistance ? "forward" : "backward";
}
