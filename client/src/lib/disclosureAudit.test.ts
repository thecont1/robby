import { describe, expect, it } from "vitest";
import { auditPublicSafeProjection, type DisclosureCandidate } from "./disclosureAudit";

function candidate(overrides: Partial<DisclosureCandidate> = {}): DisclosureCandidate {
  return {
    reverseMode: "observability_sheet",
    colourSwatches: ["#112233", "#445566"],
    truncatedHashes: {
      source: "7F3A…91C2",
      pixels: "D8E0…11F4",
      recipe: "3C7A…4B90",
      reverse: "E1D2…A73B",
    },
    gps: "private",
    c2paSummary: "C2PA UNAVAILABLE",
    includeQuantisedObverse: false,
    includeSourcePixels: false,
    includeFilename: false,
    includeCaptureTime: false,
    includeFullHashes: false,
    includeRawMetadata: false,
    ...overrides,
  };
}

describe("public-safe disclosure audit", () => {
  it("passes an observability sheet that only carries truncated hashes, palette, and bounded evidence", () => {
    const audit = auditPublicSafeProjection(candidate());
    expect(audit.safe).toBe(true);
    expect(audit.warnings).toEqual([]);
    expect(audit.omitted).toEqual([
      "source pixels",
      "quantised obverse",
      "filename",
      "capture time",
      "full hashes",
      "raw metadata",
      "raw GPS",
    ]);
  });

  it("fails if the projection would include source pixels, filenames, or raw GPS", () => {
    expect(auditPublicSafeProjection(candidate({ includeSourcePixels: true })).safe).toBe(false);
    expect(auditPublicSafeProjection(candidate({ includeFilename: true })).warnings).toContain("filename");
    expect(auditPublicSafeProjection(candidate({ gps: "12.9716,77.5946" })).warnings).toContain("raw GPS");
    expect(auditPublicSafeProjection(candidate({ includeQuantisedObverse: true })).safe).toBe(false);
  });

  it("treats GPS PRIVATE as a bounded card, not identifying material", () => {
    const audit = auditPublicSafeProjection(candidate({ gps: "private" }));
    expect(audit.safe).toBe(true);
    expect(audit.omitted).toContain("raw GPS");
  });
});
