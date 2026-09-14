import { describe, expect, it } from "vitest";
import type { C2paEvidence } from "./c2paEvidence";
import { buildObservabilitySheetFacts } from "./observabilitySheet";
import type { IntakeManifest } from "./robbyCompiler";

const c2pa = (overrides: Partial<C2paEvidence> = {}): C2paEvidence => ({
  presence: "present",
  validation: "valid",
  signerTrust: "untrusted",
  availability: "inspected",
  warnings: ["signing credential untrusted"],
  inspectedAt: "2026-09-14T00:00:00Z",
  sourceSha256: "a".repeat(64),
  verificationMethod: "c2pa-node",
  note: "valid, untrusted",
  ...overrides,
});

const intake = (state: "present" | "absent"): IntakeManifest => ({
  schema_version: "0.2",
  obverse: {
    original_name: "secret-source.jpg",
    mime_type: "image/jpeg",
    byte_size: 12,
    byte_sha256: "aa".repeat(32),
    pixel_sha256: "bb".repeat(32),
    width: 2,
    height: 1,
    orientation: null,
    colour_profile: null,
  },
  evidence: {
    exif: { classification: "redacted", value: null, visibility: "redacted", state },
    iptc: { classification: "unavailable", value: null, visibility: "private", state: "absent" },
    xmp: { classification: "unavailable", value: null, visibility: "private", state: "absent" },
    gps: { classification: "redacted", value: null, visibility: "redacted", state },
    c2pa: { classification: "redacted", value: null, visibility: "redacted", state: "absent" },
  },
});

describe("observability sheet facts", () => {
  it("projects public-safe states and never copies filename or raw GPS", () => {
    const facts = buildObservabilitySheetFacts({
      runId: "run-9c1e-aa11-bb22",
      bindingShortId: "RB-A1B2-C3D4",
      sourceByteSha256: "aa".repeat(32),
      pixelSha256: "bb".repeat(32),
      canonicalRecipeSha256: "cc".repeat(32),
      paletteK: 8,
      reverseMode: "observability_sheet",
      irSchema: "robby-ir-v1",
      intake: intake("present"),
      c2paEvidence: c2pa(),
      omitted: ["source pixels", "raw GPS", "filename", "capture time"],
    });

    expect(facts.run_id).toBe("9C1EAA11");
    expect(facts.binding_short_id).toBe("RB-A1B2-C3D4");
    expect(facts.evidence.exif).toBe("OBSERVED");
    expect(facts.evidence.iptc).toBe("UNAVAILABLE");
    expect(facts.evidence.gps).toBe("REDACTED");
    expect(facts.evidence.c2pa).toContain("PRESENT");
    expect(facts.evidence.c2pa).toContain("UNTRUSTED SIGNER");
    expect(facts.included).toEqual([
      "Palette",
      "binding mark",
      "recipe parameters",
      "evidence states",
    ]);
    expect(facts.withheld).toEqual(expect.arrayContaining(["source pixels", "raw GPS", "filename"]));
    expect(JSON.stringify(facts)).not.toMatch(/secret-source\.jpg/i);
    expect(JSON.stringify(facts)).not.toMatch(/[-+]?\d+(?:\.\d+)?\s*[,/]\s*[-+]?\d+(?:\.\d+)?/);
  });

  it("treats absent metadata as unavailable rather than redacted", () => {
    const facts = buildObservabilitySheetFacts({
      runId: "run-1",
      bindingShortId: "RB-0000-0000",
      sourceByteSha256: "aa".repeat(32),
      pixelSha256: "bb".repeat(32),
      canonicalRecipeSha256: "cc".repeat(32),
      paletteK: 8,
      reverseMode: "observability_sheet",
      irSchema: "robby-ir-v1",
      intake: intake("absent"),
      c2paEvidence: c2pa({ presence: "absent", validation: "unavailable", signerTrust: "unavailable" }),
      omitted: ["source pixels"],
    });
    expect(facts.evidence.exif).toBe("UNAVAILABLE");
    expect(facts.evidence.gps).toBe("UNAVAILABLE");
  });
});
