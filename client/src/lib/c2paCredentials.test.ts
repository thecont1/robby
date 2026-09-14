import { afterEach, describe, expect, it, vi } from "vitest";
import { inspectC2paCredential } from "./c2paCredentials";

describe("compile-run C2PA transport", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("posts the immutable intake bytes, digest, and abort signal with no cache", async () => {
    const sourceSha256 = "ab".repeat(32);
    const bytes = new Uint8Array([0xff, 0xd8, 0xff, 0xd9]);
    const signal = new AbortController().signal;
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      status: "absent",
      sourceSha256,
      verificationMethod: "c2pa-node",
      note: "No manifest",
    }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }));
    vi.stubGlobal("fetch", fetchMock);

    await inspectC2paCredential("source name.jpg", bytes, sourceSha256, signal);

    expect(fetchMock).toHaveBeenCalledWith("/api/c2pa/source%20name.jpg", expect.objectContaining({
      method: "POST",
      cache: "no-store",
      signal,
      headers: {
        "Content-Type": "image/jpeg",
        "X-Robby-Source-SHA256": sourceSha256,
      },
    }));
    const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect(new Uint8Array(init.body as ArrayBuffer)).toEqual(bytes);
  });

  it("surfaces a rejected byte snapshot instead of silently falling back to filename inspection", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(
      JSON.stringify({ error: "C2PA source bytes do not match the intake SHA-256" }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    )));

    await expect(inspectC2paCredential(
      "source.jpg",
      new Uint8Array([1, 2, 3]),
      "00".repeat(32),
    )).rejects.toThrow("do not match the intake SHA-256");
  });
});
