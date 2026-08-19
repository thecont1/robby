import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
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

describe("gallery file serving", () => {
  it("serves only flat JPEG basenames from the configured gallery", async () => {
    const root = mkdtempSync(join(tmpdir(), "robby-gallery-route-"));
    const previousRoot = process.env.ROBBY_GALLERY_DIR;
    const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xdb, 0x00, 0x43]);
    try {
      process.env.ROBBY_GALLERY_DIR = root;
      writeFileSync(join(root, "specimen.JpEg"), jpeg);
      writeFileSync(join(root, "notes.txt"), "not public");
      writeFileSync(join(root, "specimen.robby"), 'base("specimen.JpEg")');
      writeFileSync(join(root, "preview.png"), Buffer.from("not a png"));
      mkdirSync(join(root, "nested"));
      writeFileSync(join(root, "nested", "hidden.jpg"), jpeg);

      const server = createServer(createApp({ serveFrontend: false }));
      servers.push(server);
      await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
      const address = server.address();
      if (!address || typeof address === "string") throw new Error("missing test server address");
      const baseUrl = `http://127.0.0.1:${address.port}`;

      const allowed = await fetch(`${baseUrl}/gallery/specimen.JpEg`);
      expect(allowed.status).toBe(200);
      expect(Buffer.from(await allowed.arrayBuffer())).toEqual(jpeg);

      for (const key of ["notes.txt", "specimen.robby", "preview.png", "nested/hidden.jpg"]) {
        const response = await fetch(`${baseUrl}/gallery/${key}`);
        expect(response.status, key).toBe(404);
      }
    } finally {
      if (previousRoot === undefined) delete process.env.ROBBY_GALLERY_DIR;
      else process.env.ROBBY_GALLERY_DIR = previousRoot;
      rmSync(root, { recursive: true, force: true });
    }
  });
});
