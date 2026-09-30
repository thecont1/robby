/// <reference types="@cloudflare/workers-types" />
import { Container, getContainer } from "@cloudflare/containers";

/**
 * Robby demo host: the gallery JPEGs and every other static file are served
 * from Workers Static Assets at the edge, so a sleeping container never
 * stands between a visitor and the site. Only /api/* (the compiler itself)
 * reaches the single named container instance; every other asset miss —
 * SPA deep links, crawler probes — is answered by ASSETS and never wakes it.
 *
 * Gallery obverses are immutable repo specimens, so they get a long-lived
 * Cache-Control; generated reverses stay on the no-store /api/ paths.
 */
export class RobbyContainer extends Container {
  defaultPort = 3000;
  sleepAfter = "400s";
  enableInternet = true;
}

type Env = {
  ASSETS: Fetcher;
  MEDIA: R2Bucket;
  ROBBY: DurableObjectNamespace<RobbyContainer>;
};

const GALLERY_CACHE = "public, max-age=86400";
const MEDIA_CACHE = "public, max-age=3600";

export default {
  async fetch(request: Request, env: Env) {
    const { pathname } = new URL(request.url);

    // The demo MP4 exceeds the 25 MiB asset limit, so it lives in R2.
    // Fall back to the container (which also has it baked in) if the
    // object is missing — e.g. R2 upload not run yet.
    if (pathname === "/demo/robby-demo.mp4") {
      const object = await env.MEDIA.get("robby-demo.mp4", {
        range: request.headers,
        onlyIf: request.headers,
      });
      if (!object) {
        return getContainer(env.ROBBY, "demo").fetch(request);
      }
      const headers = new Headers();
      object.writeHttpMetadata(headers);
      headers.set("etag", object.httpEtag);
      headers.set("Cache-Control", MEDIA_CACHE);
      headers.set("Accept-Ranges", "bytes");
      if (!("body" in object)) {
        return new Response(null, { status: 412, headers });
      }
      const range = object.range;
      if (range) {
        const start = "suffix" in range ? Math.max(0, object.size - range.suffix) : (range.offset ?? 0);
        const end = "suffix" in range
          ? object.size - 1
          : range.length !== undefined
            ? start + range.length - 1
            : object.size - 1;
        headers.set("content-range", `bytes ${start}-${end}/${object.size}`);
        headers.set("content-length", String(end - start + 1));
      } else {
        headers.set("content-length", String(object.size));
      }
      return new Response(object.body, {
        status: range ? 206 : 200,
        headers,
      });
    }

    if (pathname.startsWith("/gallery/")) {
      const response = await env.ASSETS.fetch(request);
      const headers = new Headers(response.headers);
      headers.set("Cache-Control", GALLERY_CACHE);
      return new Response(response.body, { status: response.status, headers });
    }

    // Only real API routes may wake the container — a bogus /api/* probe
    // gets the same 404 JSON the server would send, but at the edge.
    const isApiRoute =
      pathname === "/api/reverse" ||
      pathname === "/api/gallery" ||
      pathname === "/api/gallery/events" ||
      pathname.startsWith("/api/c2pa/");
    if (isApiRoute) {
      const container = getContainer(env.ROBBY, "demo");
      return container.fetch(request);
    }
    if (pathname.startsWith("/api/")) {
      return Response.json({ error: "Not found" }, { status: 404 });
    }

    return env.ASSETS.fetch(request);
  },
};
