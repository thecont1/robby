import type { RobbyIr } from "@/lib/robbyCompiler";

export type EphemeralReverseResult = {
  blob: Blob;
  manifest: {
    version: string;
    source_obverse_sha256: string;
    script_settings_sha256: string;
    derived_seed: string;
    output_sha256: string;
    render_module: string;
    colour_swatches: string[];
    cached_intermediate: null;
  };
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
  const manifest = JSON.parse(requiredHeader(response, "X-Robby-Manifest")) as EphemeralReverseResult["manifest"];
  if (manifest.source_obverse_sha256 !== requiredHeader(response, "X-Robby-Source-SHA256")
    || manifest.output_sha256 !== requiredHeader(response, "X-Robby-Output-SHA256")
    || manifest.derived_seed !== requiredHeader(response, "X-Robby-Derived-Seed")
    || manifest.script_settings_sha256 !== requiredHeader(response, "X-Robby-Settings-SHA256")
    || manifest.render_module !== requiredHeader(response, "X-Robby-Render-Module")) {
    throw new Error("The transient reverse manifest does not match its response headers.");
  }
  return { blob: await response.blob(), manifest };
}
