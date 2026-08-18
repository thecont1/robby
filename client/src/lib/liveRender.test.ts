import { describe, expect, it, vi } from "vitest";
import { requestLiveRender } from "./liveRender";

describe("live image renderer client", () => {
  it("submits the validated IR to the server rendering endpoint", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ inverseUrl: "/manus-storage/live.png" }) });
    vi.stubGlobal("fetch", fetchMock);
    await requestLiveRender({ version: "robby-ir-v1" } as never);
    expect(fetchMock).toHaveBeenCalledWith("/api/live-render", expect.objectContaining({ method: "POST", body: JSON.stringify({ ir: { version: "robby-ir-v1" } }) }));
  });

  it("submits changed palette and reverse configurations as fresh render work", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ inverseUrl: "/manus-storage/live.png" }) });
    vi.stubGlobal("fetch", fetchMock);
    await requestLiveRender({ version: "robby-ir-v1", palette: { k: 9 }, reverse: [{ mode: "palette-grid", k: 9 }] } as never);
    await requestLiveRender({ version: "robby-ir-v1", palette: { k: 8 }, reverse: [{ mode: "provenance-map" }] } as never);
    expect(fetchMock.mock.calls.map(([, request]) => JSON.parse((request as RequestInit).body as string).ir)).toEqual([
      { version: "robby-ir-v1", palette: { k: 9 }, reverse: [{ mode: "palette-grid", k: 9 }] },
      { version: "robby-ir-v1", palette: { k: 8 }, reverse: [{ mode: "provenance-map" }] },
    ]);
  });
});
