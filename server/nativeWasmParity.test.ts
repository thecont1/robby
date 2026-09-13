import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import initWasm, { inspect_image_json as inspectWasm, render_reverse_json as renderWasm } from "../client/src/wasm/robby_compiler.js";

const root = resolve(import.meta.dirname, "..");
const sourcePath = resolve(root, "tests", "fixtures", "render-source.jpg");
const sourceBytes = readFileSync(sourcePath);
const wasmBytes = readFileSync(resolve(root, "client", "src", "wasm", "robby_compiler_bg.wasm"));
const nativeBinary = resolve(root, "target", "release", "robby");

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
  it.each([3, 5, 8, 12, 16])("is byte-identical for k=%i", async k => {
    await initWasm(wasmBytes);
    const settings = JSON.stringify({ mode: "negative", k, width: 96, height: 64 });
    const native = renderNative(settings);
    const [wasmPng, wasmManifest] = JSON.parse(renderWasm(sourceBytes, settings));

    expect(wasmManifest).toEqual(native.manifest);
    expect(Buffer.from(wasmPng)).toEqual(native.png);
  });

  it.each(["quantised_obverse", "palette_grid"] as const)("is byte-identical for Phase 4 mode %s", async mode => {
    await initWasm(wasmBytes);
    const settings = JSON.stringify({ mode, k: 8, width: 96, height: 64, cell: 8, seed: "object_binding" });
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
});
