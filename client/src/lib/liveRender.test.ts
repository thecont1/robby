import { describe, expect, it, vi } from "vitest";
import { requestEphemeralReverse } from "./liveRender";

const ir = (k: number) => ({
  version: "robby-ir-v1",
  canvas: { base: "source.jpg", width: null, height: null },
  palette: { k },
  reverse: { mode: "negative" },
  output: { obverse: "front.jpg", reverse: "transient", manifest: "transient" },
  meta: { script_sha256: "0".repeat(64) },
});

function response() {
  const manifest = {
    version: "robby-render-manifest-v1",
    source_obverse_sha256: "a".repeat(64),
    script_settings_sha256: "b".repeat(64),
    derived_seed: "c".repeat(64),
    output_sha256: "d".repeat(64),
    render_module: "negative",
    colour_swatches: ["#000000"],
    cached_intermediate: null,
  };
  return new Response(new Blob(["png"], { type: "image/png" }), {
    status: 200,
    headers: {
      "X-Robby-Source-SHA256": manifest.source_obverse_sha256,
      "X-Robby-Output-SHA256": manifest.output_sha256,
      "X-Robby-Derived-Seed": manifest.derived_seed,
      "X-Robby-Settings-SHA256": manifest.script_settings_sha256,
      "X-Robby-Render-Module": manifest.render_module,
      "X-Robby-Manifest": JSON.stringify(manifest),
    },
  });
}

describe("ephemeral reverse renderer client", () => {
  it("submits canonical IR and receives the complete deterministic manifest", async () => {
    const fetchMock = vi.fn().mockResolvedValue(response());
    vi.stubGlobal("fetch", fetchMock);
    const result = await requestEphemeralReverse(ir(8) as never);
    expect(fetchMock).toHaveBeenCalledWith("/api/reverse", expect.objectContaining({
      method: "POST", cache: "no-store", body: JSON.stringify({ ir: ir(8) }),
    }));
    expect(result.manifest.derived_seed).toBe("c".repeat(64));
    expect(result.manifest.render_module).toBe("negative");
    expect(result.blob.type).toBe("image/png");
  });

  it("starts independent network compilation work for repeated equal requests", async () => {
    const fetchMock = vi.fn().mockImplementation(() => Promise.resolve(response()));
    vi.stubGlobal("fetch", fetchMock);
    await requestEphemeralReverse(ir(8) as never);
    await requestEphemeralReverse(ir(8) as never);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0]?.[1]).not.toBe(fetchMock.mock.calls[1]?.[1]);
  });

  it("sends changed k for the next compilation rather than reusing prior settings", async () => {
    const fetchMock = vi.fn().mockImplementation(() => Promise.resolve(response()));
    vi.stubGlobal("fetch", fetchMock);
    await requestEphemeralReverse(ir(8) as never);
    await requestEphemeralReverse(ir(9) as never);
    expect(fetchMock.mock.calls.map(([, request]) => JSON.parse((request as RequestInit).body as string).ir.palette.k)).toEqual([8, 9]);
  });
});
