import { describe, expect, it } from "vitest";
import { gallerySlideDirection, isImageOnlyExitKey, swipeGalleryOffset, themeControlLabel } from "./visualModes";

describe("gallery visual-mode controls", () => {
  it("describes the target theme rather than the current theme", () => {
    expect(themeControlLabel("light")).toBe("switch to dark mode");
    expect(themeControlLabel("dark")).toBe("switch to light mode");
  });

  it("reserves Escape as the concentration-mode exit key", () => {
    expect(isImageOnlyExitKey("Escape")).toBe(true);
    expect(isImageOnlyExitKey("f")).toBe(false);
    expect(isImageOnlyExitKey("ArrowRight")).toBe(false);
  });

  it("maps intentional full-bleed swipes to gallery directions", () => {
    expect(swipeGalleryOffset(240, 160)).toBe(1);
    expect(swipeGalleryOffset(160, 240)).toBe(-1);
    expect(swipeGalleryOffset(240, 210)).toBe(0);
  });

  it("assigns directional gallery slides, including circular wrap-around", () => {
    expect(gallerySlideDirection(0, 1, 5)).toBe("forward");
    expect(gallerySlideDirection(4, 0, 5)).toBe("forward");
    expect(gallerySlideDirection(0, 4, 5)).toBe("backward");
    expect(gallerySlideDirection(1, 4, 5)).toBe("backward");
  });
});
