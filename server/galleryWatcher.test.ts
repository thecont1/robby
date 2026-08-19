import { copyFileSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { scanGallery } from "./galleryWatcher";

const fixture = resolve(process.cwd(), "gallery", "MS202401-Ayodhya0041.jpg");

function tempGallery() {
  return mkdtempSync(join(tmpdir(), "robby-gallery-watcher-"));
}

describe("gallery snapshot", () => {
  it("reads the configured root instead of the repository gallery", async () => {
    const root = tempGallery();
    try {
      copyFileSync(fixture, join(root, "configured.jpg"));
      const items = await scanGallery(root);
      expect(items.map(item => item.source)).toEqual(["configured.jpg"]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("returns an empty snapshot for a missing or empty directory", async () => {
    const root = tempGallery();
    try {
      expect(await scanGallery(root)).toEqual([]);
      expect(await scanGallery(join(root, "missing"))).toEqual([]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("isolates one invalid sidecar instead of suppressing valid specimens", async () => {
    const root = tempGallery();
    try {
      copyFileSync(fixture, join(root, "bad.jpg"));
      copyFileSync(fixture, join(root, "good.jpg"));
      writeFileSync(join(root, "bad.robby"), `base("bad.jpg")\npalette(k: 99)\nreverse(mode: "negative")\noutput(obverse: "bad.jpg", reverse: "transient", manifest: "transient")\n`);

      const items = await scanGallery(root);
      expect(items.map(item => item.source)).toEqual(["good.jpg"]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("generates valid Robby source for a legal JPEG filename containing a quote", async () => {
    const root = tempGallery();
    const filename = `quote"name.jpg`;
    try {
      copyFileSync(fixture, join(root, filename));
      const [item] = await scanGallery(root);
      expect(item.source).toBe(filename);
      expect(item.script).toContain(`base(${JSON.stringify(filename)})`);
      expect(item.script).not.toContain(`base("quote"name.jpg")`);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
