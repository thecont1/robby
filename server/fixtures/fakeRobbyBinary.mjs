#!/usr/bin/env node
// A minimal stand-in for the compiled Rust `robby` binary, used only by
// tests that run in sandboxes without cargo/rustc available. It honours just
// enough of the CLI contract that `runRustRenderer` (server/liveRender.ts)
// depends on: `render <sourcePath> --settings <json>` on argv, a PNG-shaped
// buffer on stdout, and a `ROBBY_MANIFEST:<json>` line on stderr whose
// `colour_swatches` has exactly `k` entries (mirrors the real renderer's
// invariant that it always returns exactly the requested number of swatches).
//
// Every invocation is appended to `ROBBY_FAKE_CALLS_LOG` (a file path) when
// that env var is set, so tests can assert the binary was or wasn't invoked
// again for an unchanged file (mtime-cache behaviour).
import { appendFileSync, writeFileSync } from "node:fs";

const args = process.argv.slice(2);
const settingsIndex = args.indexOf("--settings");
const settings = settingsIndex >= 0 ? JSON.parse(args[settingsIndex + 1]) : {};
const k = typeof settings.k === "number" ? settings.k : 8;

if (process.env.ROBBY_FAKE_CALLS_LOG) {
  appendFileSync(process.env.ROBBY_FAKE_CALLS_LOG, `${args[0] ?? ""} ${args[1] ?? ""}\n`);
}

const swatches = Array.from({ length: k }, (_, index) => `#${(index * 111111).toString(16).padStart(6, "0").slice(-6)}`);

const manifest = {
  version: "robby-manifest-v1",
  source_obverse_sha256: "0".repeat(64),
  script_settings_sha256: "0".repeat(64),
  derived_seed: "fake",
  output_sha256: "0".repeat(64),
  render_module: settings.mode ?? "observability_sheet",
  colour_swatches: swatches,
  cached_intermediate: null,
};

// A tiny valid PNG (1x1 transparent pixel) is enough — tests only assert on
// the manifest, and `runRustRenderer` only concatenates stdout as opaque bytes.
const onePixelPng = Buffer.from(
  "89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000a49444154789c6360000002000155bfaad40000000049454e44ae426082",
  "hex",
);
writeFileSync(1, onePixelPng);
process.stderr.write(`ROBBY_MANIFEST:${JSON.stringify(manifest)}\n`);
process.exit(0);
