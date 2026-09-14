import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const read = (path: string) => readFileSync(resolve(root, path), "utf8");

function allStrings(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.flatMap(allStrings);
  if (value && typeof value === "object") return Object.values(value).flatMap(allStrings);
  return [];
}

describe("production audit evidence contract", () => {
  it("contains no precise GPS or local absolute source paths", () => {
    const inventory = JSON.parse(read("audits/plan10-exif-inventory.json")) as Array<Record<string, unknown>>;
    for (const entry of inventory) {
      expect(entry).not.toHaveProperty("GPSLatitude");
      expect(entry).not.toHaveProperty("GPSLongitude");
      expect(entry.SourceFile).toBe(entry.FileName);
    }
    expect(inventory.some(entry => entry.GPSPresent === true)).toBe(true);
  });

  it("preserves accessible text instead of deleting lowercase s characters", () => {
    const audit = JSON.parse(read("audits/plan10-dom-audit-prod.json"));
    const strings = allStrings(audit);
    expect(strings).toContain("H1:Explainable image-objectcompiler in rust.");
    expect(strings.some(value => /^switch to (light|dark) mode$/i.test(value))).toBe(true);
    expect(strings).toContain("Runtime manifest");
    expect(strings).toContain("Reverse record");
  });

  it("records the pre-compile C2PA state as NOT INSPECTED", () => {
    const diagnostic = JSON.parse(read("audits/plan10-diagnostic.json"));
    const strings = allStrings(diagnostic);
    expect(strings.some(value => value.includes("NOT INSPECTED"))).toBe(true);
    expect(strings.some(value => value.includes("C2PA ABSENT"))).toBe(false);
  });
});

describe("CDP audit scripts fail closed", () => {
  it.each(["cdp-input-probe.mjs", "cdp-diagnostic.mjs"])(
    "%s throws when the gallery stage never renders",
    file => {
      const source = read(`audits/${file}`);
      expect(source).toMatch(/gallery|stage/i);
      expect(source).toMatch(/throw new Error\([^)]*(gallery|stage)/i);
    },
  );

  it("fails the happy-path capture when compilation never reaches a terminal state", () => {
    const source = read("audits/cdp-happy-path.mjs");
    expect(source).toMatch(/compileCompleted|terminalState/);
    expect(source).toMatch(/throw new Error\([^)]*compil/i);
  });

  it("captures disclosure collapse before opening details", () => {
    const source = read("audits/cdp-happy-path.mjs");
    expect(source).toMatch(/detailsInitiallyCollapsed\s*=\s*details\s*\?\s*!details\.open/);
    expect(source).not.toContain("post.detailsInitiallyCollapsed = state.details");
  });

  it("composites translucent backgrounds and compares raw contrast", () => {
    const source = read("audits/cdp-audit.mjs");
    expect(source).toMatch(/const over\s*=/);
    expect(source).toMatch(/while\s*\(.*\.length\).*over/);
    expect(source).toMatch(/if \(r !== null && r < \(large \? 3 : 4\.5\)\)/);
  });
});
