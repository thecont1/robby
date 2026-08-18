import { describe, expect, it } from "vitest";
import { immutableStorageKey, parseOriginalContentType, parseOriginalFilename } from "./originals";

describe("immutable original intake", () => {
  it("retains a safe original JPEG basename exactly", () => {
    expect(parseOriginalFilename("MS202401-Ayodhya0041.jpg")).toBe("MS202401-Ayodhya0041.jpg");
    expect(parseOriginalFilename("MS202308-Bangalore0739-Enhanced-NR.jpg")).toBe("MS202308-Bangalore0739-Enhanced-NR.jpg");
  });

  it("rejects paths, non-JPEG names, and transformed content types", () => {
    expect(() => parseOriginalFilename("../original.jpg")).toThrow("basename");
    expect(() => parseOriginalFilename("source.webp")).toThrow("basename");
    expect(() => parseOriginalContentType("image/webp")).toThrow("image/jpeg");
    expect(() => parseOriginalContentType(undefined)).toThrow("image/jpeg");
  });

  it("uses the content hash while preserving the original filename in the immutable key", () => {
    const hash = "a".repeat(64);
    expect(immutableStorageKey(hash, "MS202401-Ayodhya0041.jpg")).toBe(`originals/${hash}/MS202401-Ayodhya0041.jpg`);
  });
});
