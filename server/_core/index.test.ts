import { createServer } from "node:http";
import { afterEach, describe, expect, it } from "vitest";
import { createApp } from "./index";

const servers: ReturnType<typeof createServer>[] = [];

afterEach(async () => {
  await Promise.all(servers.splice(0).map(server => new Promise<void>(resolve => server.close(() => resolve()))));
});

describe("server request limits", () => {
  it("rejects reverse JSON larger than 256 KiB before render validation", async () => {
    const server = createServer(createApp({ serveFrontend: false }));
    servers.push(server);
    await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("missing test server address");

    const response = await fetch(`http://127.0.0.1:${address.port}/api/reverse`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ir: { padding: "x".repeat(300_000) } }),
    });

    expect(response.status).toBe(413);
  });
});
