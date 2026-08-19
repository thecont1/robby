import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import initWasm, { render_reverse_json as renderWasm } from "../client/src/wasm/robby_compiler.js";

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
});
