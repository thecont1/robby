import { describe, expect, it } from "vitest";
import { artworkModalKeyAction, focusableArtworkSelector } from "./artworkModal";

describe("full-bleed artwork modal keyboard contract", () => {
  it("closes on Escape even when focus is in an editor", () => {
    expect(artworkModalKeyAction("Escape", false, 0, 2)).toBe("close");
  });

  it("wraps Tab and Shift+Tab within the modal focusables", () => {
    expect(artworkModalKeyAction("Tab", false, 1, 2)).toBe("next");
    expect(artworkModalKeyAction("Tab", true, 0, 2)).toBe("previous");
  });

  it("exposes a selector that excludes disabled controls", () => {
    expect(focusableArtworkSelector()).toContain("button:not([disabled])");
  });
});
