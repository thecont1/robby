# TECH-SPEC.md

Version: v0.1 (living document, updated per build)
Status: **Constitutional purge in progress** — see §5.

***

## 1. What kind of system this is

`robby` is a small compiler: a source language (`.robby` scripts) is lexed, parsed, validated, lowered into a JSON intermediate representation (`robby-ir-v1`), and executed to produce artifacts. It is architecturally a compiler, not an image-editing application — the distinction matters because it determines the correctness properties this document holds the system to: determinism, traceability, and explicit, inspectable stages.

### 1.1 What counts as a "machine" here

A compiler is formally defined as a translator from a source representation into a target representation executable by some machine — and "machine" does not require a CPU. It only requires a deterministic interpreter with a formal specification for what a given byte sequence causes it to do.

Under that definition, a JPEG, PNG, or WebP decoder is a machine in exactly the relevant sense: each is a deterministic interpreter with a formal specification (e.g., ITU-T T.81 for JPEG) that consumes a byte stream and produces defined output — a pixel grid — through a fixed sequence of operations (entropy decoding, dequantization, inverse transform, colour reconstruction). This is structurally the same relationship a CPU has to machine code: bytes in, defined interpreter, defined effects out.

`robby`'s target machine is therefore not a CPU — it is the family of raster-image decoders that every browser, OS, and viewer already ships. Compiling to a raster image format is compiling to a machine, in the same sense that compiling to WebAssembly or to a GPU shader ISA is targeting a machine. This is worth stating precisely rather than loosely: it is the basis for calling `robby` a compiler rather than an image tool that merely resembles one.

Two honest caveats keep this claim precise rather than overstated:

- **Direction of information flow differs from CPU machine code.** CPU instructions are prescriptive — a sequence of imperative operations. Image-format bytes are closer to descriptive — an encoded signal that the decoder reconstructs. This is closer to compiling toward a structured data format than toward an imperative instruction set; both are legitimate compiler targets, but the character of "execution" differs.
- **Current codegen is a thin wrapper around existing encoders**, not a bespoke backend that hand-emits bitstream syntax (DCT coefficients, Huffman tables). This is architecturally normal — many real compiler backends hand off to assemblers/linkers rather than emitting final bytes themselves — but it should not be overstated as "robby writes JPEG bitstreams from scratch."

***

## 2. Core architecture

```text
.robby script
  → lexer / parser (Rust)
  → AST
  → validator (semantic checks)
  → IR (robby-ir-v1, JSON)
  → executor
      → obverse render (if composite)
      → inverse render (on-demand, at flip time — see §4)
  → manifest (process record)
```

- **Language/parser/validator/IR core**: Rust. This is the single source of truth for compilation logic and is compiled to two targets:
  - WASM, embedded in the web client for in-browser parsing/validation.
  - A native CLI binary (`robby compile script.robby`), independently downloadable and runnable with no browser dependency.
- **Web client**: TypeScript/React, consuming the same Rust core via WASM bridge — not a parallel reimplementation of parsing/validation logic.
- **Manifest**: a JSON process record per compiled specimen, capturing hashes, trace steps, and signature metadata (see §6).

***

## 3. The DSL (current command set)

| Command | Purpose | Notes |
|---|---|---|
| `base(path, width?, height?)` | Declares the source obverse image. | No analysis performed at this step — file is read as opaque bytes plus a pixel matrix. |
| `palette(k)` | Extracts `k` dominant colour swatches from the obverse. | Pure numerical clustering (k-means or equivalent) over RGB/Lab pixel values. No spatial or semantic information is retained — output is a flat list of colours only. |
| `reverse(mode, settings…)` | Declares how the inverse should be generated. | See §4 for the generation contract. `mode` selects a `RenderModule`. |
| `output(obverse, reverse, manifest)` | Declares output naming/targets. | Bookkeeping only. |

**Removed as of the current purge (§5):** `cutout`, and any mask/subject/region-dependent parameters. These commands and their supporting infrastructure (segmentation dependencies, mask-strategy fields, region metadata) are being fully excised — not deprecated, removed.

***

## 4. Reverse generation: the governing contract

This is the most important section of this document. It defines both what the system is allowed to do and why, so that future contributors — human or automated — do not reintroduce forbidden behavior by well-intentioned accident.

### 4.1 The sacred rule

> **The compiler must never attempt to understand, interpret, segment, classify, or semantically analyze the obverse image.**

The obverse is treated strictly as:
1. A sequence of raw bytes (hashable, but otherwise opaque).
2. A matrix of RGB pixel values (usable only for unsupervised colour statistics — clustering, histograms — never for detecting *what* is depicted).
3. File-level metadata read directly from structure/headers (dimensions, format, embedded C2PA credentials) — never inferred from pixel content.

Anything resembling object detection, foreground/background segmentation, subject masking, captioning, or classification is forbidden, regardless of where in the pipeline it might be introduced.

### 4.2 Why this rule exists

Early builds computed the inverse via spatial "provenance maps" that required knowing which pixels belonged to which detected object (e.g., GrabCut-based foreground extraction). This quietly turned `robby` into a small computer-vision pipeline wearing a compiler's clothing, and undermined the core artistic claim: that the inverse is generated mathematically, not interpretively. A compiler that "looks at" its input to decide what the input "means" is no longer explainable in the sense this project claims — it becomes exactly the kind of black box the project argues against.

### 4.3 The generation pipeline (post-purge target state)

```text
obverse_bytes
  → sha256(obverse_bytes)                     # identity + integrity
  → colour_swatches = kmeans(pixels, k)        # pure numeric clustering
  → seed = derive_seed(sha256, hash(settings)) # deterministic seed derivation
  → prng = seed_prng(seed)                     # e.g. splitmix64 / xoshiro256
  → inverse = render_module(colour_swatches, settings, prng)
```

- `derive_seed` is a deterministic function, not encryption. Its role is reproducibility, not security. Document this distinction explicitly in code comments to avoid future confusion with cryptographic key usage.
- `render_module` is resolved from a **registry** of pluggable implementations, selected by `reverse(mode: "...")`. v1 ships exactly one module: `"negative"` (colour inversion of swatches, combined with seed-driven procedural arrangement — block sizes, positions, ordering all derived from the PRNG stream, never from image content).
- This registry pattern is structurally analogous to how compilers like LLVM support multiple target backends (x86, ARM, RISC-V) from one shared IR — here, multiple render modules consume the same (swatches, settings, seed) input to produce different deterministic artworks. Future contributors can add new modules without modifying the compiler core.

### 4.4 Determinism guarantees

- **Same obverse bytes + same settings → byte-identical inverse**, every time, with no exceptions. This must hold under repeated calls, server restarts, and across the WASM/native build targets.
- **Any change to obverse bytes → an entirely different inverse.** A single-pixel resize changes the SHA-256 completely (hash avalanche effect), which changes the seed completely, which changes every downstream random draw. This is treated as a feature: the inverse functions as a tamper-evidence mechanism, not merely decoration.
- No unseeded randomness may exist anywhere in the render path. Any stochastic step (e.g., k-means initialization) must itself be seeded deterministically from the same derived seed.

### 4.5 Reverse generation is ephemeral

- No reverse image is persisted as ground truth. The only durable artifacts are: the source script, the original obverse bytes, and the manifest describing what was computed.
- The reverse is recomputed live on every flip request. Expensive intermediate results may be cached for performance only if explicitly labeled as such in the manifest (e.g., `cached_intermediate: colour_swatches`) — the final inverse pixels themselves are never served from a pre-rendered file.

***

## 5. Constitutional purge — status

An audit and removal pass is in progress to eliminate all obverse-understanding logic (`cutout`, `mask`, segmentation dependencies, region metadata, and related UI/documentation references) from the codebase. This section will be updated with the audit results and verification confirmation once complete. Until this is marked resolved, assume any documentation or UI copy referencing mask types, detected subjects, or region-based provenance is stale and scheduled for removal.

***

## 6. Manifest and signature layer

Each compiled specimen's manifest records:
- `credential_signature` — from embedded C2PA content credentials (cryptographic, machine-verifiable).
- `colour_signature` — derived colour fingerprint from pixel statistics (visual, human-recognizable).
- `script_hash`, `ir_hash`, `output` checksums, and compile timestamps — proving each render was a genuine recomputation event, not a cache hit.

These two signature types are deliberately kept distinct and separately labeled, since the tension between cryptographic and human-recognizable identity is a central argument of the project, not an implementation detail.

***

## 7. Open questions / pending decisions

- Whether image composition from multiple source files (previously implemented via `cutout`/`place`) survives in any form — only permissible if it performs no content understanding (e.g., manual, user-specified geometric placement with no auto-detection).
- Scope and legitimacy of the Registrar tab's "browser-local ECDSA attestation" and signed export features, introduced without an explicit work order — pending review.
- MCP/WebMCP integration — deferred until the purge and live-compilation work are verified complete.