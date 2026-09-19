/// <reference types="@cloudflare/workers-types" />
import { Container, getContainer } from "@cloudflare/containers";

/**
 * Robby demo host: the gallery JPEGs and every other static file are served
 * from Workers Static Assets at the edge, so a sleeping container never
 * stands between a visitor and the site. Only /api/* (the compiler itself)
 * and non-asset paths reach the single named container instance.
 *
 * Gallery obverses are immutable repo specimens, so they get a long-lived
 * Cache-Control; generated reverses stay on the no-store /api/ paths.
 */
export class RobbyContainer extends Container {
  defaultPort = 3000;
  sleepAfter = "30m";
  enableInternet = true;
}

type Env = {
  ASSETS: Fetcher;
  ROBBY: DurableObjectNamespace<RobbyContainer>;
};

const GALLERY_CACHE = "public, max-age=86400";

export default {
  async fetch(request: Request, env: Env) {
    const { pathname } = new URL(request.url);

    if (pathname.startsWith("/gallery/")) {
      const response = await env.ASSETS.fetch(request);
      const headers = new Headers(response.headers);
      headers.set("Cache-Control", GALLERY_CACHE);
      return new Response(response.body, { status: response.status, headers });
    }

    const container = getContainer(env.ROBBY, "demo");
    return container.fetch(request);
  },
};
