/// <reference types="@cloudflare/workers-types" />
import { Container, getContainer } from "@cloudflare/containers";

/**
 * Robby demo host: every request goes to the single Node server container
 * (Express + Rust render binary + C2PA SDK + baked-in gallery). One named
 * instance is enough for a demo; the server is the whole app, not a shard.
 */
export class RobbyContainer extends Container {
  defaultPort = 3000;
  sleepAfter = "30m";
  enableInternet = true;
}

type Env = {
  ROBBY: DurableObjectNamespace<RobbyContainer>;
};

export default {
  async fetch(request: Request, env: Env) {
    const container = getContainer(env.ROBBY, "demo");
    return container.fetch(request);
  },
};
