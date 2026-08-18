import { describe, expect, it } from "vitest";
import { gallery, galleryOrder } from "./demoData";

describe("authentic-source gallery records", () => {
  const authenticIds = ["bipasha-aashish", "uganda-diptych", "fidh-guinea", "murgeshpalya-passage", "kashmir-study", "ghana-study", "nagaland-study", "hong-kong-study", "ayodhya-mural", "urban-fantasy"] as const;

  it("binds each refreshed specimen to a JPEG original with a measured source hash", () => {
    for (const id of authenticIds) {
      const specimen = gallery.find(item => item.id === id);
      expect(specimen).toBeDefined();
      expect(specimen?.source).toMatch(/\.jpe?g$/i);
      expect(specimen?.script).not.toContain(".webp");
      expect(["absent", "candidate", "present"]).toContain(specimen?.credentialSignature.status);
      expect(specimen?.credentialSignature.sourceSha256).toMatch(/^[0-9a-f]{64}$/);
    }
  });

  it("keeps raw C2PA-marker evidence conservative until cryptographic validation is available", () => {
    expect(gallery.find(item => item.id === "ghana-study")?.credentialSignature.status).toBe("candidate");
    expect(gallery.filter(item => item.id !== "ghana-study").every(item => item.credentialSignature.status === "absent")).toBe(true);
  });

  it("uses separate managed-storage faces for the obverse and its inverse", () => {
    for (const id of authenticIds) {
      const specimen = gallery.find(item => item.id === id);
      expect(specimen?.obverse).toMatch(/^\/manus-storage\/.+\.png$/);
      expect(specimen?.reverse).toMatch(/^\/manus-storage\/.+\.png$/);
      expect(specimen?.obverse).not.toBe(specimen?.reverse);
    }
  });

  it("derives sequence and serial labels solely from the exported gallery order", () => {
    expect(gallery.map(item => item.id)).toEqual(galleryOrder);
    expect(gallery.map(item => item.serial)).toEqual(["01 / 10", "02 / 10", "03 / 10", "04 / 10", "05 / 10", "06 / 10", "07 / 10", "08 / 10", "09 / 10", "10 / 10"]);
    expect(gallery.some(item => item.id === "night-duality")).toBe(false);
  });
});
