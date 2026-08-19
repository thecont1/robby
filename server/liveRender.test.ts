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
