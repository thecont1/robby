import { describe, expect, it } from "vitest";
import { RUST_TOOLCHAIN_VERSION, verifiedCompilerStatus } from "./compilerStatus";

describe("compiler status", () => {
  it("distinguishes the Rust toolchain version from Robby's crate release", () => {
    expect(RUST_TOOLCHAIN_VERSION).toBe("1.97.1");
    expect(verifiedCompilerStatus).toBe("VALID IR · RUST 1.97.1");
  });
});
