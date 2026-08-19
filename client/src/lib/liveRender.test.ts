import { describe, expect, it, vi } from "vitest";
import { requestEphemeralReverse } from "./liveRender";

describe("ephemeral reverse renderer client", () => {
  it("submits validated IR only when an inverse is requested and receives direct PNG bytes", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(new Blob(["png"], { type: "image/png" }), {
      status: 200,
      headers: {
        "X-Robby-Source-SHA256": "a".repeat(64),
        "X-Robby-Output-SHA256": "b".repeat(64),
        "X-Robby-Reverse-Mode": "palette-grid",
        "X-Robby-Render-Fingerprint": "c".repeat(64),
      },
    }));
    vi.stubGlobal("fetch", fetchMock);
    const result = await requestEphemeralReverse({ version: "robby-ir-v1" } as never);
    expect(fetchMock).toHaveBeenCalledWith("/api/reverse", expect.objectContaining({ method: "POST", cache: "no-store", body: JSON.stringify({ ir: { version: "robby-ir-v1" } }) }));
    expect(result.outputSha256).toBe("b".repeat(64));
    expect(result.blob.type).toBe("image/png");
  });

  it("sends the current palette and reverse configuration for each independent reverse request", async () => {
    const response = () => new Response(new Blob(["png"], { type: "image/png" }), { status: 200, headers: { "X-Robby-Source-SHA256": "a".repeat(64), "X-Robby-Output-SHA256": "b".repeat(64), "X-Robby-Reverse-Mode": "palette-grid", "X-Robby-Render-Fingerprint": "c".repeat(64) } });
    const fetchMock = vi.fn().mockImplementation(() => Promise.resolve(response()));
    vi.stubGlobal("fetch", fetchMock);
    await requestEphemeralReverse({ version: "robby-ir-v1", palette: { k: 9 }, reverse: [{ mode: "palette-grid", k: 9 }] } as never);
    await requestEphemeralReverse({ version: "robby-ir-v1", palette: { k: 8 }, reverse: [{ mode: "provenance-map" }] } as never);
    expect(fetchMock.mock.calls.map(([, request]) => JSON.parse((request as RequestInit).body as string).ir)).toEqual([
      { version: "robby-ir-v1", palette: { k: 9 }, reverse: [{ mode: "palette-grid", k: 9 }] },
      { version: "robby-ir-v1", palette: { k: 8 }, reverse: [{ mode: "provenance-map" }] },
    ]);
  });
});
