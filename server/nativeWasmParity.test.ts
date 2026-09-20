import { spawnSync } from "node:child_process";
import { readFileSync, rmSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import initWasm, {
  binding_request_v1_json as requestWasm,
  build_binding_json as bindWasm,
  inspect_image_json as inspectWasm,
  render_reverse_json as renderWasm,
} from "../client/src/wasm/robby_compiler.js";

const root = resolve(import.meta.dirname, "..");
const sourcePath = resolve(root, "tests", "fixtures", "render-source.jpg");
const sourceBytes = readFileSync(sourcePath);
const wasmBytes = readFileSync(resolve(root, "client", "src", "wasm", "robby_compiler_bg.wasm"));
const nativeBinary = resolve(root, "target", "release", "troid");

beforeAll(() => {
  const build = spawnSync("cargo", ["build", "--release", "--locked"], {
    cwd: root,
    encoding: "utf8",
  });
  if (build.status !== 0) throw new Error(`native renderer build failed:\n${build.stderr}`);
});

function renderNative(settings: string) {
  const result = spawnSync(nativeBinary, ["render", sourcePath, "--settings", settings], {
    cwd: root,
    encoding: null,
  });
  expect(result.status).toBe(0);
  const stderr = Buffer.from(result.stderr ?? []).toString("utf8");
  const line = stderr.split("\n").find(value => value.startsWith("ROBBY_MANIFEST:"));
  if (!line) throw new Error(`native manifest missing: ${stderr}`);
  return { png: Buffer.from(result.stdout ?? []), manifest: JSON.parse(line.slice("ROBBY_MANIFEST:".length)) };
}

describe("native/WASM render parity", () => {
  it.each([3, 5, 8, 12, 16, 20, 32, 64])("is byte-identical for k=%i", async k => {
    await initWasm(wasmBytes);
    // Declared canvas dims must equal the fixture's 96×72 — the reverse is
    // always the obverse's dimensions.
    const settings = JSON.stringify({ mode: "negative", k, width: 96, height: 72 });
    const native = renderNative(settings);
    const [wasmPng, wasmManifest] = JSON.parse(renderWasm(sourceBytes, settings));

    expect(wasmManifest).toEqual(native.manifest);
    expect(Buffer.from(wasmPng)).toEqual(native.png);
  });

  it.each(["quantised_obverse", "palette_grid"] as const)("is byte-identical for Phase 4 mode %s", async mode => {
    await initWasm(wasmBytes);
    const settings = JSON.stringify({ mode, k: 8, width: 96, height: 72, cell: 8, seed: "object_binding" });
    const native = renderNative(settings);
    const [wasmPng, wasmManifest] = JSON.parse(renderWasm(sourceBytes, settings));

    expect(wasmManifest.palette_method).toBe("median_cut");
    expect(wasmManifest.render_module).toBe(mode);
    expect(wasmManifest).toEqual(native.manifest);
    expect(Buffer.from(wasmPng)).toEqual(native.png);
  });

  it("produces the identical public-safe intake manifest natively and in WASM", async () => {
    await initWasm(wasmBytes);
    const native = spawnSync(nativeBinary, ["inspect", sourcePath, "render-source.jpg"], {
      cwd: root,
      encoding: "utf8",
    });
    expect(native.status).toBe(0);
    const nativeManifest = JSON.parse(native.stdout);
    const wasmManifest = JSON.parse(inspectWasm("render-source.jpg", sourceBytes));

    expect(wasmManifest).toEqual(nativeManifest);
    expect(wasmManifest.obverse.pixel_sha256).toMatch(/^[0-9a-f]{64}$/);
    expect(wasmManifest.obverse.byte_sha256).not.toBe(wasmManifest.obverse.pixel_sha256);
    expect(wasmManifest.evidence.gps.visibility).toBe("redacted");
    expect(wasmManifest.evidence.exif.value).toBeNull();
  });

  it("produces the identical canonical binding record natively and in WASM", async () => {
    await initWasm(wasmBytes);
    // Build a real v1 request through the Rust adapters from the fixture.
    const intakeJson = inspectWasm("render-source.jpg", sourceBytes);
    const recipeSource = [
      'base("render-source.jpg")',
      "palette(k: 8)",
      'reverse(mode: "observability_sheet")',
      'output(obverse: "render-source.jpg", reverse: "transient", manifest: "transient")',
    ].join("\n");
    const evidenceJson = JSON.stringify({
      schema: "robby-evidence-selection-v1",
      c2pa: {
        presence: "absent",
        validation: "unavailable",
        signerTrust: "unavailable",
        availability: "inspected",
      },
    });
    const requestJson = requestWasm(
      intakeJson,
      recipeSource,
      evidenceJson,
      "robby-compiler-v0.1.0",
      "robby-render-manifest-v1",
    );
    const request = JSON.parse(requestJson);
    expect(request.recipe_ir_schema).toBe("robby-ir-v1");
    expect(request.authored_recipe_sha256).not.toBe(request.canonical_recipe_sha256);

    const wasmRecord = JSON.parse(bindWasm(requestJson));
    const requestPath = resolve(root, "tests", "fixtures", "binding-request.json");
    writeFileSync(requestPath, requestJson);
    let nativeRecord: unknown;
    try {
      const native = spawnSync(nativeBinary, ["bind", requestPath], { cwd: root, encoding: "utf8" });
      expect(native.status).toBe(0);
      nativeRecord = JSON.parse(native.stdout);
    } finally {
      // Always remove the generated fixture, including when spawnSync or the
      // status assertion above throws — a leaked file pollutes the repo and
      // the next run.
      rmSync(requestPath, { force: true });
    }

    expect(wasmRecord).toEqual(nativeRecord);
    expect(wasmRecord.schema_version).toBe("robby-binding-record-v1");
    expect(wasmRecord.recipe_ir_schema).toBe("robby-ir-v1");
    expect(wasmRecord.binding_sha256).toMatch(/^[0-9a-f]{64}$/);
    expect(wasmRecord.statement).toBe("A reproducibility binding, not an ownership certificate.");
    expect(wasmRecord.short_id).toMatch(/^RB-[0-9A-F]{4}-[0-9A-F]{4}$/);

    // Evidence sensitivity through the real adapters.
    const changedEvidence = JSON.stringify({
      schema: "robby-evidence-selection-v1",
      c2pa: {
        presence: "candidate",
        validation: "invalid",
        signerTrust: "unavailable",
        availability: "inspected",
      },
    });
    const changedRequest = JSON.parse(
      requestWasm(intakeJson, recipeSource, changedEvidence, "robby-compiler-v0.1.0", "robby-render-manifest-v1"),
    );
    const changedRecord = JSON.parse(bindWasm(JSON.stringify(changedRequest)));
    expect(changedRecord.binding_sha256).not.toBe(wasmRecord.binding_sha256);
  });
});
