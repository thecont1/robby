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

describe("ephemeral reverse HTTP handler", () => {
  it("returns direct PNG bytes with no-store metadata rather than a durable storage URL", async () => {
    const response = responseDouble();
    const png = Buffer.from("ephemeral-png");
    const handler = createEphemeralReverseHandler(async () => ({
      png,
      sourceSha256: "a".repeat(64),
      outputSha256: "b".repeat(64),
      palette: [],
      reverseMode: "palette-grid",
      renderFingerprint: "c".repeat(64),
    }));

    await handler({ body: { ir: { version: "robby-ir-v1" } } }, response);

    expect(response.code).toBe(200);
    expect(response.body).toBe(png);
    expect(response.headers.get("Cache-Control")).toBe("no-store, max-age=0");
    expect(response.headers.get("X-Robby-Output-SHA256")).toBe("b".repeat(64));
  });

  it("returns a clear 400 response when the render program is rejected", async () => {
    const response = responseDouble();
    const handler = createEphemeralReverseHandler(async () => {
      throw new LiveRenderValidationError("The source unregistered.jpg is not registered as an immutable live-render original.");
    });

    await handler({ body: { ir: { version: "robby-ir-v1" } } }, response);

    expect(response.code).toBe(400);
    expect(response.body).toEqual({ error: "The source unregistered.jpg is not registered as an immutable live-render original." });
  });
});
