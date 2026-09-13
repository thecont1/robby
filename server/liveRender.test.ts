import { describe, expect, it } from "vitest";
import { createEphemeralReverseHandler } from "./liveRender";
import { LiveRenderValidationError } from "./liveRenderer";

function responseDouble() {
  return {
    code: 0,
    headers: new Map<string, string>(),
    body: null as unknown,
    status(code: number) { this.code = code; return this; },
    setHeader(name: string, value: string) { this.headers.set(name, value); },
    type() { return this; },
    send(body: Buffer) { this.body = body; },
    json(body: unknown) { this.body = body; },
  };
}

const manifest = {
  version: "robby-render-manifest-v1",
  source_obverse_sha256: "a".repeat(64),
  script_settings_sha256: "b".repeat(64),
  derived_seed: "c".repeat(64),
  output_sha256: "d".repeat(64),
  render_module: "negative",
  colour_swatches: ["#000000", "#FFFFFF"],
  cached_intermediate: null,
};

describe("ephemeral reverse HTTP handler", () => {
  it("returns direct PNG bytes and the exact Rust manifest with no-store metadata", async () => {
    const response = responseDouble();
    const png = Buffer.from("ephemeral-png");
    const handler = createEphemeralReverseHandler(async () => ({ png, manifest }));

    await handler({ body: { ir: { version: "robby-ir-v1" } } }, response);

    expect(response.code).toBe(200);
    expect(response.body).toBe(png);
    expect(response.headers.get("Cache-Control")).toBe("no-store, max-age=0");
    expect(response.headers.get("Pragma")).toBe("no-cache");
    expect(response.headers.get("X-Robby-Source-SHA256")).toBe(manifest.source_obverse_sha256);
    expect(response.headers.get("X-Robby-Output-SHA256")).toBe(manifest.output_sha256);
    expect(response.headers.get("X-Robby-Derived-Seed")).toBe(manifest.derived_seed);
    expect(response.headers.get("X-Robby-Settings-SHA256")).toBe(manifest.script_settings_sha256);
    expect(response.headers.get("X-Robby-Render-Module")).toBe("negative");
    expect(JSON.parse(response.headers.get("X-Robby-Manifest") ?? "null")).toEqual(manifest);
    expect(JSON.stringify(response.headers)).not.toContain("storage");
  });

  it("forwards sibling sheet facts to the renderer and rejects filenames", async () => {
    const seen: unknown[] = [];
    const response = responseDouble();
    const png = Buffer.from("ephemeral-png");
    const handler = createEphemeralReverseHandler(async (_ir, sheet) => {
      seen.push(sheet);
      return { png, manifest };
    });
    await handler({
      body: {
        ir: { version: "robby-ir-v1" },
        sheet: {
          run_id: "9C1EAA11",
          binding_short_id: "RB-A1B2-C3D4",
          source_sha256: "a".repeat(64),
          pixel_sha256: "b".repeat(64),
          recipe_sha256: "c".repeat(64),
          palette_k: 8,
          reverse_mode: "observability_sheet",
          ir_schema: "robby-ir-v1",
          policy_name: "robby-v1-default-disclosure-policy",
          evidence: { exif: "OBSERVED", iptc: "UNAVAILABLE", xmp: "UNAVAILABLE", gps: "REDACTED", c2pa: "ABSENT" },
          included: ["Palette"],
          withheld: ["filename"],
        },
      },
    }, response);
    expect(response.code).toBe(200);
    expect(seen[0]).toMatchObject({ binding_short_id: "RB-A1B2-C3D4", evidence: { gps: "REDACTED" } });

    const rejected = responseDouble();
    const rejecting = createEphemeralReverseHandler(async () => ({ png, manifest }));
    await rejecting({
      body: {
        ir: { version: "robby-ir-v1" },
        sheet: {
          run_id: "x",
          binding_short_id: "secret-source.jpg",
          evidence: { exif: null, iptc: null, xmp: null, gps: null, c2pa: null },
          included: [],
          withheld: [],
        },
      },
    }, rejected);
    expect(rejected.code).toBe(400);
  });

  it.each([
    ["included filename", { included: ["private-source.jpg"], withheld: [] }],
    ["withheld path", { included: [], withheld: ["private/source"] }],
    ["included GPS", { included: ["12.9716, 77.5946"], withheld: [] }],
  ])("rejects unsafe disclosure-list entry: %s", async (_label, lists) => {
    const response = responseDouble();
    const handler = createEphemeralReverseHandler(async () => ({ png: Buffer.from("png"), manifest }));
    await handler({
      body: {
        ir: { version: "robby-ir-v1" },
        sheet: {
          evidence: { exif: null, iptc: null, xmp: null, gps: null, c2pa: null },
          ...lists,
        },
      },
    }, response);
    expect(response.code).toBe(400);
  });

  it("returns a clear 400 response when the render program is rejected", async () => {
    const response = responseDouble();
    const handler = createEphemeralReverseHandler(async () => {
      throw new LiveRenderValidationError("Gallery source not found: missing.jpg");
    });

    await handler({ body: { ir: { version: "robby-ir-v1" } } }, response);

    expect(response.code).toBe(400);
    expect(response.body).toEqual({ error: "Gallery source not found: missing.jpg" });
  });
});
