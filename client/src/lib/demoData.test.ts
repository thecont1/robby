import { describe, expect, it } from "vitest";
import { gallery, galleryOrder } from "./demoData";

describe("authentic-source gallery records", () => {
  const authenticIds = galleryOrder;

  it("binds each refreshed specimen to a JPEG original with a measured source hash", () => {
    for (const id of authenticIds) {
      const specimen = gallery.find(item => item.id === id);
      expect(specimen).toBeDefined();
      expect(specimen?.source).toMatch(/\.jpe?g$/i);
      expect(specimen?.script).not.toContain(".webp");
      expect(["absent", "candidate", "present", "checking"]).toContain(specimen?.credentialSignature.status);
      expect(specimen?.credentialSignature.sourceSha256).toMatch(/^[0-9a-f]{64}$/);
      expect(specimen?.credentialSignature.verificationMethod).not.toMatch(/marker scan/i);
    }
  });

  it("starts C2PA evidence in an explicit checking state until the official validator reads each exact managed source", () => {
    expect(gallery.every(item => item.credentialSignature.status === "checking")).toBe(true);
  });

  it("keeps only the immutable JPEG obverse in the catalogue; inverses are generated on demand", () => {
    for (const id of authenticIds) {
      const specimen = gallery.find(item => item.id === id);
      expect(specimen?.obverse).toMatch(/^\/manus-storage\/.+\.jpg$/);
      expect(specimen?.reverse).toBe("");
    }
  });

  it("derives sequence and serial labels solely from the exported gallery order", () => {
    expect(gallery.map(item => item.id)).toEqual(galleryOrder);
    const total = galleryOrder.length;
    const expectedSerials = galleryOrder.map((_, i) => `${String(i + 1).padStart(2, "0")} / ${String(total).padStart(2, "0")}`);
    expect(gallery.map(item => item.serial)).toEqual(expectedSerials);
  });
});
