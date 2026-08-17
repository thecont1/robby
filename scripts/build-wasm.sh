#!/usr/bin/env bash
# Build the browser adapter from the same Rust library used by the native CLI.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BINDGEN="${WASM_BINDGEN:-$HOME/.cargo/bin/wasm-bindgen}"

if [[ ! -x "$BINDGEN" ]]; then
  echo "wasm-bindgen was not found. Install the matching tool with:" >&2
  echo "  cargo install wasm-bindgen-cli --version 0.2.92 --locked" >&2
  exit 1
fi

cd "$ROOT"
cargo build --release --target wasm32-unknown-unknown --features wasm --lib
rm -rf client/src/wasm
mkdir -p client/src/wasm
"$BINDGEN" \
  --target web \
  --out-dir client/src/wasm \
  --out-name robby_compiler \
  target/wasm32-unknown-unknown/release/robby_compiler.wasm

echo "Generated client/src/wasm/ from the robby-compiler Rust library."
