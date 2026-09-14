/**
 * Regression: the Reverse record panel must report the LIVE palette k.
 *
 * Sibling defect to "Palette change leaves recipe text stale": the panel used
 * to derive PALETTE K by regexing `item.script` — the immutable gallery
 * source — so after an authored edit to k=5 it still displayed 8 while the
 * editor, the control and the runtime manifest all said 5.
 *
 * `reverseRecordFacts` is the single derivation the component renders, so a
 * test against it fails if anyone reintroduces a parse of `item.script`.
 * The fixture's script deliberately declares a DIFFERENT k from the live
 * value: a regex-based implementation returns 8 and fails these tests.
 */

import { describe, expect, it } from "vitest";
import { reverseRecordFacts } from "@/components/Build06Panels";

const ITEM = {
  reverseMode: "negative",
  // Immutable gallery source still declaring the ORIGINAL k.
  script: 'base("render-source.jpg")\npalette(k: 8)\nreverse(mode: "negative")',
};

describe("Reverse record reports live authored state", () => {
  it("reports the edited k, not the immutable gallery script's k", () => {
    expect(reverseRecordFacts({ item: ITEM, reverseMode: "negative", paletteK: 5 }).paletteK).toBe(5);
  });

  it("reports the unedited k when no edit has been made", () => {
    expect(reverseRecordFacts({ item: ITEM, reverseMode: "negative", paletteK: 8 }).paletteK).toBe(8);
  });

  it("reports a k that appears nowhere in the script, proving no reparse", () => {
    // 16 cannot be produced by any regex over ITEM.script.
    expect(reverseRecordFacts({ item: ITEM, reverseMode: "negative", paletteK: 16 }).paletteK).toBe(16);
  });

  it("reports the live reverse mode over the item's stored mode", () => {
    expect(reverseRecordFacts({ item: ITEM, reverseMode: "observability_sheet", paletteK: 5 }).command)
      .toBe('reverse(mode: "observability_sheet")');
  });

  it("falls back to the item's mode when no live mode is supplied", () => {
    expect(reverseRecordFacts({ item: ITEM, paletteK: 8 }).command).toBe('reverse(mode: "negative")');
  });
});
