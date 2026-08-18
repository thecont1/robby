import { describe, expect, it } from "vitest";
import { gallery, galleryOrder } from "../client/src/lib/demoData";
import { getLiveRenderSource } from "./liveRenderCatalog";

describe("live render catalog", () => {
  it("resolves every gallery source via getLiveRenderSource", () => {
    for (const item of gallery) {
      const resolved = getLiveRenderSource(item.source);
      expect(resolved, `Missing live render source for ${item.source}`).not.toBeNull();
      expect(resolved?.sha256).toMatch(/^[0-9a-f]{64}$/);
      expect(resolved?.storageKey).toMatch(/\.jpg$/);
    }
  });

  it("covers exactly the sources in galleryOrder", () => {
    expect(gallery.map(item => item.source)).toEqual(galleryOrder.map(id => gallery.find(item => item.id === id)?.source));
  });
});
