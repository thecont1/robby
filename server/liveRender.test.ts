import { describe, expect, it } from "vitest";
import { createLiveRenderHandler } from "./liveRender";
import { LiveRenderValidationError } from "./liveRenderer";

describe("live render HTTP handler", () => {
  it("returns a clear 400 response when the render program is rejected", async () => {
    const response = {
      code: 0,
      body: null as unknown,
      status(code: number) { this.code = code; return this; },
      json(body: unknown) { this.body = body; },
    };
    const handler = createLiveRenderHandler(async () => {
      throw new LiveRenderValidationError("The source unregistered.jpg is not registered as an immutable live-render original.");
    });

    await handler({ body: { ir: { version: "robby-ir-v1" } } }, response);

    expect(response.code).toBe(400);
    expect(response.body).toEqual({ error: "The source unregistered.jpg is not registered as an immutable live-render original." });
  });
});
