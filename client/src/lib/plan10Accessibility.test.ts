import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const css = readFileSync(resolve(process.cwd(), "client/src/plan10-accessibility.css"), "utf8");

describe("Plan 10 accessibility CSS contract", () => {
  it("keeps every audited interactive target at least 44 by 44 CSS pixels", () => {
    expect(css).toContain("min-height: 44px");
    expect(css).toContain("min-width: 44px");
    for (const selector of [
      ".skip-link",
      ".brand-lockup",
      ".feature-control.icon-control",
      ".menu-control",
      ".artwork-view-control",
      ".compile-source",
      ".reset-source",
      '.palette-slider-row input[type="range"]',
      ".footer-socials a",
      ".footer-copyright a",
    ]) {
      expect(css).toContain(selector);
    }
  });

  it("uses black ink on every vermilion-filled control, including editor actions", () => {
    // Target the ink rule specifically — `.compile-source` also appears in the
    // target-size group above, which legitimately carries no color declaration.
    const inkRule = css.match(/\.source-editor-actions \.compile-source,[\s\S]{0,400}?\}/);
    expect(inkRule, "expected a .compile-source ink rule").not.toBeNull();
    expect(inkRule![0]).toMatch(/color:\s*var\(--plan10-control-ink\)/);
  });

  it("separates text vermilion from decorative vermilion in light mode", () => {
    expect(css).toContain("--plan10-text-accent: #7c3024");
    expect(css).toContain("--plan10-control-ink: #000");
    expect(css).toContain("color: var(--plan10-text-accent)");
  });

  it("keeps stage dimensions legible in dark mode", () => {
    expect(css).toContain(".dark .stage-dimensions");
    expect(css).toContain("color: #d79a8d");
  });

  it("preserves a visible keyboard focus treatment", () => {
    expect(css).toContain(":focus-visible");
    expect(css).toContain("outline: 3px solid");
  });
});
