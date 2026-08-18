#!/usr/bin/env bash
# Build the browser adapter from the same Rust library used by the native CLI.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
EXPECTED_BINDGEN_VERSION="0.2.92"
BINDGEN="${WASM_BINDGEN:-}"

if [[ -z "$BINDGEN" ]]; then
  BINDGEN="$(command -v wasm-bindgen || true)"
fi

if [[ -z "$BINDGEN" ]]; then
  CARGO_BIN_DIR="${CARGO_HOME:-}"
  if [[ -z "$CARGO_BIN_DIR" && -n "${HOME:-}" ]]; then
    CARGO_BIN_DIR="${HOME}/.cargo"
  fi
  if [[ -n "$CARGO_BIN_DIR" && -x "$CARGO_BIN_DIR/bin/wasm-bindgen" ]]; then
    BINDGEN="$CARGO_BIN_DIR/bin/wasm-bindgen"
  fi
fi

if [[ -z "$BINDGEN" || ! -x "$BINDGEN" ]]; then
  echo "wasm-bindgen was not found. Install the matching tool with:" >&2
  echo "  cargo install wasm-bindgen-cli --version ${EXPECTED_BINDGEN_VERSION} --locked" >&2
  exit 1
fi

FOUND_BINDGEN_VERSION="$("$BINDGEN" --version | awk '{print $2}')"
if [[ "$FOUND_BINDGEN_VERSION" != "$EXPECTED_BINDGEN_VERSION" ]]; then
  echo "wasm-bindgen ${FOUND_BINDGEN_VERSION} does not match the pinned crate version ${EXPECTED_BINDGEN_VERSION}." >&2
  exit 1
fi

cd "$ROOT"
cargo build --release --target wasm32-unknown-unknown --features wasm --lib
STAGING="$(mktemp -d "$ROOT/client/src/.wasm-build.XXXXXX")"
trap 'rm -rf "$STAGING"' EXIT
"$BINDGEN" \
  --target web \
  --out-dir "$STAGING" \
  --out-name robby_compiler \
  target/wasm32-unknown-unknown/release/robby_compiler.wasm
rm -rf client/src/wasm
mv "$STAGING" client/src/wasm
trap - EXIT

echo "Generated client/src/wasm/ from the robby-compiler Rust library."
