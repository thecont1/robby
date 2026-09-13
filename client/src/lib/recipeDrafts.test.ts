import { describe, expect, it } from "vitest";
import { createRecipeDraftStore } from "./recipeDrafts";

describe("per-item recipe draft store", () => {
  it("preserves an edited draft for each gallery item across selection changes", () => {
    const store = createRecipeDraftStore();
    store.set("ayodhya", 'base("a.jpg")\npalette(k: 12)');
    store.set("night", 'base("n.jpg")\npalette(k: 3)');
    expect(store.get("ayodhya", 'base("a.jpg")')).toBe('base("a.jpg")\npalette(k: 12)');
    expect(store.get("night", 'base("n.jpg")')).toBe('base("n.jpg")\npalette(k: 3)');
  });

  it("falls back to the specimen script when no draft was authored", () => {
    const store = createRecipeDraftStore();
    expect(store.get("ayodhya", 'base("a.jpg")')).toBe('base("a.jpg")');
  });

  it("drops a stored draft when the user resets the specimen", () => {
    const store = createRecipeDraftStore();
    store.set("ayodhya", "edited");
    store.clear("ayodhya");
    expect(store.get("ayodhya", "script")).toBe("script");
  });

  it("keeps other drafts when one item is cleared", () => {
    const store = createRecipeDraftStore();
    store.set("ayodhya", "edited");
    store.set("night", "night-edited");
    store.clear("ayodhya");
    expect(store.get("night", "script")).toBe("night-edited");
  });
});
