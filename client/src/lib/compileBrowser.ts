import { inspectC2paCredential } from "@/lib/c2paCredentials";
import { createCompileController, type CompileDeps } from "@/lib/compileController";
import { requestEphemeralReverse } from "@/lib/liveRender";
import { buildCanonicalBindingWithRust, compileWithRust, inspectWithRust, rustCompilerVersion } from "@/lib/robbyCompiler";

async function sha256Hex(value: string | Uint8Array) {
  const bytes = typeof value === "string" ? new TextEncoder().encode(value) : new Uint8Array(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest)).map(byte => byte.toString(16).padStart(2, "0")).join("");
}

export function createBrowserCompileDeps(): CompileDeps {
  return {
    fetchSourceBytes: async (sourceUrl, signal) => {
      const response = await fetch(sourceUrl, { cache: "no-store", signal });
      if (!response.ok) throw new Error(`Could not read source bytes for ${sourceUrl}.`);
      return new Uint8Array(await response.arrayBuffer());
    },
    sha256Hex,
    measureSourceBytes: async (originalName, bytes, signal) => {
      if (signal.aborted) throw new DOMException("Aborted", "AbortError");
      const manifest = await inspectWithRust(originalName, bytes);
      return {
        pixelSha256: manifest.obverse.pixel_sha256,
        width: manifest.obverse.width,
        height: manifest.obverse.height,
        mimeType: manifest.obverse.mime_type,
        intakeManifestJson: JSON.stringify(manifest),
      };
    },
    buildBinding: async (intakeManifestJson, recipeSource, evidence, compilerVersion, rendererVersion) => {
      const record = await buildCanonicalBindingWithRust(
        intakeManifestJson,
        recipeSource,
        {
          schema: "robby-evidence-selection-v1",
          c2pa: {
            presence: evidence.c2pa.presence,
            validation: evidence.c2pa.validation,
            signerTrust: evidence.c2pa.signerTrust,
            availability: evidence.c2pa.availability,
          },
        },
        compilerVersion,
        rendererVersion,
      );
      return {
        bindingSha256: record.binding_sha256,
        shortId: record.short_id,
        recipeIrSchema: record.recipe_ir_schema,
        sourceByteSha256: record.source_byte_sha256,
        canonicalPixelSha256: record.canonical_pixel_sha256,
        authoredRecipeSha256: record.authored_recipe_sha256,
        canonicalRecipeSha256: record.canonical_recipe_sha256,
        disclosurePolicySha256: record.disclosure_policy_sha256,
        selectedEvidenceSha256: record.selected_evidence_sha256,
        compilerVersion: record.compiler_version,
        rendererVersion: record.renderer_version,
        statement: record.statement,
      };
    },
    compileRecipe: async (recipeSource, signal) => {
      if (signal.aborted) throw new DOMException("Aborted", "AbortError");
      return compileWithRust(recipeSource);
    },
    inspectC2pa: async (sourceName, signal) => {
      if (signal.aborted) throw new DOMException("Aborted", "AbortError");
      return inspectC2paCredential(sourceName);
    },
    renderReverse: async (ir, signal, sheet) => {
      if (signal.aborted) throw new DOMException("Aborted", "AbortError");
      return requestEphemeralReverse(ir, sheet);
    },
    now: () => new Date().toISOString(),
    createId: () => {
      if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
      return `run-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    },
    createObjectUrl: blob => URL.createObjectURL(blob),
    revokeObjectUrl: url => URL.revokeObjectURL(url),
    compilerVersion: "robby-compiler-v0.1.0",
    rendererVersion: "robby-render-manifest-v1",
  };
}

export async function browserCompilerLabel() {
  try {
    return await rustCompilerVersion();
  } catch {
    return "robby-compiler-v0.1.0";
  }
}

export const browserCompileController = createCompileController(createBrowserCompileDeps());
