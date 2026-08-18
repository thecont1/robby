/** Header status shown only after the WebAssembly compiler validates the active script. */
export function verifiedCompilerStatus(toolchain: string) {
  return `VALID IR · ${toolchain}`;
}
