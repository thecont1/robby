import type { RobbyIr } from "@/lib/robbyCompiler";

export type LiveRenderResult = {
  obverseUrl: string;
  inverseUrl: string;
  manifestUrl: string;
  sourceSha256: string;
  outputSha256: string;
  palette: Array<{ k: number; colors: string[] }>;
  reverseMode: string;
  renderId: string;
};

export async function requestLiveRender(ir: RobbyIr) {
  const response = await fetch("/api/live-render", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ir }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(typeof payload.error === "string" ? payload.error : "The live image executor did not return a render.");
  return payload as LiveRenderResult;
}
