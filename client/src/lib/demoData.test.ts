import { describe, expect, it } from "vitest";
import { gallery } from "./demoData";

describe("authentic-source gallery records", () => {
  const authenticIds = ["night-duality", "ayodhya-mural", "urban-fantasy", "murgeshpalya-passage", "uganda-diptych"] as const;

  it("binds each replacement specimen to a JPEG original with embedded C2PA evidence", () => {
    for (const id of authenticIds) {
      const specimen = gallery.find(item => item.id === id);
      expect(specimen).toBeDefined();
      expect(specimen?.source).toMatch(/\.jpe?g$/i);
      expect(specimen?.script).not.toContain(".webp");
      expect(specimen?.credentialSignature.status).toBe("present");
      expect(specimen?.credentialSignature.sourceSha256).toMatch(/^[0-9a-f]{64}$/);
    }
  });

  it("records the validating C2PA claim generator for every original", () => {
    for (const id of authenticIds) {
      const specimen = gallery.find(item => item.id === id);
      expect(specimen?.credentialSignature.claimGenerator).toMatch(/^lightroom_classic\/15\./);
      expect(specimen?.credentialSignature.markerScan).toBe("c2patool detailed manifest validation");
    }
  });

  it("uses separate managed-storage faces for the obverse and its inverse", () => {
    for (const id of authenticIds) {
      const specimen = gallery.find(item => item.id === id);
      expect(specimen?.obverse).toMatch(/^\/manus-storage\/.+\.png$/);
      expect(specimen?.reverse).toMatch(/^\/manus-storage\/.+\.png$/);
      expect(specimen?.obverse).not.toBe(specimen?.reverse);
    }
  });

  it("keeps Night duality as a base-only study after removing the duplicate full-scene layer", () => {
    const night = gallery.find(item => item.id === "night-duality");
    expect(night?.script).not.toContain("courier.png");
    expect(night?.script).not.toContain("cutout(");
    expect(night?.script).not.toContain("place(");
    expect(night?.reverseMode).toBe("palette-grid");
  });
});
