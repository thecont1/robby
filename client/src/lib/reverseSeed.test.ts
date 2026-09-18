import { describe, expect, it } from "vitest";
import { FALLBACK_REVERSE_SEED, reverseMotionSeed } from "./reverseSeed";

describe("reverse motion seed", () => {
  it("uses the active C2PA credential key for present evidence", () => {
    expect(reverseMotionSeed({ presence: "present", credentialKey: "urn:uuid:one" })).toBe("urn:uuid:one");
  });

  it("uses the active credential key for an invalid embedded candidate", () => {
    expect(reverseMotionSeed({ presence: "candidate", credentialKey: "urn:uuid:candidate" })).toBe("urn:uuid:candidate");
  });

  it("falls back to 42 when C2PA is absent or unavailable", () => {
    expect(reverseMotionSeed({ presence: "absent", credentialKey: "urn:uuid:ignored" })).toBe(FALLBACK_REVERSE_SEED);
    expect(reverseMotionSeed(undefined)).toBe("42");
  });

  it("does not accept a blank credential key", () => {
    expect(reverseMotionSeed({ presence: "present", credentialKey: "   " })).toBe("42");
  });
});
