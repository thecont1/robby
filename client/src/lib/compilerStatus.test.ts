import { describe, expect, it } from "vitest";
import { verifiedCompilerStatus } from "./compilerStatus";

describe("compiler status", () => {
  it("formats the toolchain label supplied by the Rust/WASM build metadata", () => {
    expect(verifiedCompilerStatus("RUST 1.97.1")).toBe("VALID IR · RUST 1.97.1");
  });
});
