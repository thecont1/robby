import type { RobbyIr } from "@/lib/robbyCompiler";

export type EphemeralReverseResult = {
  blob: Blob;
  sourceSha256: string;
  outputSha256: string;
  reverseMode: string;
  renderFingerprint: string;
};

function requiredHeader(response: Response, name: string) {
  const value = response.headers.get(name);
  if (!value) throw new Error(`The transient reverse response omitted ${name}.`);
  return value;
}

export async function requestEphemeralReverse(ir: RobbyIr): Promise<EphemeralReverseResult> {
  const response = await fetch("/api/reverse", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ir }),
    cache: "no-store",
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(typeof payload.error === "string" ? payload.error : "The live compiler did not return a transient reverse.");
  }
  return {
    blob: await response.blob(),
    sourceSha256: requiredHeader(response, "X-Robby-Source-SHA256"),
    outputSha256: requiredHeader(response, "X-Robby-Output-SHA256"),
    reverseMode: requiredHeader(response, "X-Robby-Reverse-Mode"),
    renderFingerprint: requiredHeader(response, "X-Robby-Render-Fingerprint"),
  };
}
