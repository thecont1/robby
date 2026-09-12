import { copyFileSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { scanGallery } from "./galleryWatcher";
import { validateGalleryFilename } from "./gallerySource";

const fixture = resolve(process.cwd(), "tests", "fixtures", "render-source.jpg");

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

  it("does not catalogue JPEG filenames the serving boundary rejects", async () => {
    const root = tempGallery();
    try {
      copyFileSync(fixture, join(root, `quote"name.jpg`));
      expect(await scanGallery(root)).toEqual([]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  // Bug reproduction: scanGallery admits any *.jpg name, but the /gallery/*
  // route and readLocalGallerySource enforce validateGalleryFilename, which
  // rejects names like `quote"name.jpg`. Catalogued specimens must be servable.
  it("only catalogues specimens the serving boundary will serve", async () => {
    const root = tempGallery();
    try {
      copyFileSync(fixture, join(root, `quote"name.jpg`));
      copyFileSync(fixture, join(root, "regular.jpg"));
      const items = await scanGallery(root);
      for (const item of items) {
        expect(() => validateGalleryFilename(item.source)).not.toThrow();
      }
      expect(items.map(item => item.source)).toEqual(["regular.jpg"]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
