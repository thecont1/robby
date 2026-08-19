import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const packageJson = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
const dockerfile = readFileSync(new URL("../Dockerfile", import.meta.url), "utf8");
const liveRender = readFileSync(new URL("./liveRender.ts", import.meta.url), "utf8");

describe("production renderer packaging", () => {
  it("builds the native release renderer in the standard production build", () => {
    expect(packageJson.scripts.build).toContain("cargo build --release");
    expect(liveRender).toContain('"target", "release", "robby"');
  });

  it("ships a release Rust binary and no retired Python image stack", () => {
    expect(dockerfile).toMatch(/FROM rust:1\.97/);
    expect(dockerfile).toContain("cargo build --release");
    expect(dockerfile).toContain("ROBBY_BINARY=/usr/local/bin/robby");
    expect(dockerfile).not.toMatch(/python|opencv|numpy|pillow|python3-pil/i);
  });
});
