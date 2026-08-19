import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";
import { registerLiveRenderRoutes } from "../liveRender";
import { registerC2paRoutes } from "../c2pa";
import { registerGalleryRoutes } from "../galleryWatcher";
import { serveStatic, setupVite } from "./vite";

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

export function createApp({ serveFrontend = true } = {}) {
  const app = express();
  registerLiveRenderRoutes(app);
  registerC2paRoutes(app);
  registerGalleryRoutes(app);
  // Reject any unmatched /api/* path with 404 JSON before the SPA fallback
  app.use("/api/*", (_req, res) => {
    res.status(404).json({ error: "Not found" });
  });
  if (serveFrontend && process.env.NODE_ENV !== "development") {
    serveStatic(app);
  }
  return app;
}

async function startServer() {
  const app = createApp();
  const server = createServer(app);
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  }

  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });
}

const entryPoint = process.argv[1] ? import.meta.url === pathToFileURL(resolve(process.argv[1])).href : false;
if (entryPoint) startServer().catch(console.error);
