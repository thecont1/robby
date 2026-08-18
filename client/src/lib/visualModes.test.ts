import { describe, expect, it } from "vitest";
import { isImageOnlyExitKey, themeControlLabel } from "./visualModes";

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
});
