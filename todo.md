# Gallery revision checklist

- [x] Register the four supplied obverse photographs as durable gallery assets with clear titles and manifest identities.
- [x] Produce a provenance-map reverse and process manifest for each new gallery record.
- [x] Upload obverse and reverse artifacts to project storage for static viewer access.
- [x] Replace the paired-image spread with one mutually exclusive flippable image-object and gallery navigation.
- [x] Keep the active image’s compilation trace visible beside the image-object and synchronize it with gallery selection.
- [x] Verify previous/next cycling, flip state, keyboard access, mobile layout, production build, and updated documentation.

## Filmstrip refinement

- [x] Move the image-library thumbnails below the selected image-object and expand the desktop stage to fit the active face to the available width.
- [x] Confirm that the bottom filmstrip remains navigable and responsive without narrowing the adjacent compilation trace.

## Build 02 — Rust compiler core

- [x] Audit and document the current language/runtime for parsing, validation, IR lowering, execution, and viewer behavior.
- [x] Refactor the Rust compiler into inspectable lexer, parser, validator, IR, and CLI modules without changing `robby-ir-v1`.
- [x] Verify the portable native CLI builds and compiles example `.robby` scripts without browser or web deployment dependencies.
- [x] Compile the same Rust parser/validator/IR source to WebAssembly and use it in the viewer rather than parallel TypeScript logic.
- [x] Add a persistent site link to the actual Rust source on the `dev/ananya` repository branch and state the Rust core explicitly in the footer/manifest area.
- [x] Record remaining non-Rust runtime responsibilities and Build 02 verification results.

## Build 03 — credential and colour signature layer

- [x] Audit the five source assets for embedded C2PA indicators and record exactly what can be verified locally.
- [x] Derive and record a real pixel-based colour signature for every gallery specimen.
- [x] Add per-specimen credential and colour signature fields to the trace and manifest presentation.
- [x] Replace the flip animation with a locked, declarative `face` / `isFlipping` state machine and preloaded 3D faces.
- [x] Verify flip stability, signature updates, gallery cycling, source-data provenance, and responsive presentation.
- [x] Document C2PA verification limits and distinguish real asset-derived data from UI-only absence states.

## Build 04 — verification and hardening

- [x] Verify the public Rust source link and build the crate from a clean clone using the documented native CLI path.
- [x] Confirm every gallery specimen compiles through the same Rust/WASM source with no JavaScript parser or IR fallback.
- [x] Audit credential and colour signature values, source metadata badge states, and palette changes across all five specimens.
- [x] Exercise thumbnail, previous/next, and keyboard navigation plus obverse/inverse flips for every specimen.
- [x] Verify or repair script hashes and output checksums against actual bytes, recording any intentionally unavailable values.
- [x] Run final native, WebAssembly, browser, and production-build regressions and publish a concise Build 04 findings report.

## Build 05 — source editor and language manual

- [x] Audit the Rust/WASM compiler exports, structured diagnostics, current gallery state, and static executor boundary.
- [x] Define an editor state contract that updates trace and manifest from real Rust IR while labelling any unchanged pre-rendered image artifact honestly.
- [x] Add a real Rust/WASM source editor with line-aware success and failure feedback for the active specimen script.
- [x] Add a persistent versioned language manual covering the six supported commands with current grammar, defaults, values, and real examples.
- [x] Verify source edits compile through Rust/WASM, invalid source shows a human-readable error, and gallery/flip/signature behavior remains intact.
- [x] Document the Build 05 runtime boundary and evidence that no JavaScript parser fallback serves the editor.

## Pull request review workflow

- [x] Verify the `dev/ananya` working tree is clean and that its existing commits form logical batches.
- [x] File a detailed, unmerged pull request from `dev/ananya` and confirm its remote branch is current.
- [x] Wait one hour for CodeRabbit and ITO-QA review activity.
- [x] Review CodeRabbit comments first and commit any validated fixes. (No CodeRabbit review record was posted during the requested window.)
- [x] Review ITO-QA comments second and commit validated source-identity fixes. (One medium finding; browser literals now match canonical source bytes for all five specimens.)
- [x] Recompile the repaired Night duality browser source through Rust/WASM and confirm it reports native hash `249ff423…988581`.
- [x] Invoke the repaired Night duality source through the live Rust/WASM compiler from the gallery editor.
- [x] Re-run affected regressions, push all review fixes, and report the unmerged pull request outcome.

## Post-review follow-up

- [x] Manually trigger CodeRabbit on open PR #1 and confirm the request without merging. (Requested via https://github.com/thecont1/robby/pull/1#issuecomment-5319949918)
- [x] Confirm CodeRabbit reviewed the substantive compiler changes despite its head-change notice after the checklist-only commit. (Verified from merged PR #1 review history: CodeRabbit posted a substantive review at 2026-08-18T02:59:16Z.)
- [x] Review and resolve the additional ITO-QA findings. Failed Rust/WASM compiles now withhold stale live output; integrity reports use atomic replacement for concurrent writes.
- [x] Verify in-browser that an invalid recompile withholds the prior live trace, source hash, and output projection.
- [x] Establish a valid Night duality live projection, then prepare the unsupported-mask browser draft for the error-state check.
- [x] Reset the invalid Night draft and submit a fresh canonical compile to verify post-error projection recovery.

## Fresh external review round

- [x] Review and resolve the new CodeRabbit findings first. (Addressed all nine inline findings, the editable-shortcut finding, and the directly related robustness notes.)
- [x] Review and resolve the new ITO-QA findings second. (Draft edits now invalidate obsolete live evidence and supersede prior compile generations.)
- [x] Validate, push, and report the latest unmerged PR review outcome.
- [x] Verify editor shortcut isolation and reset projection behavior in the rebuilt browser preview.
- [x] Focus the Night source editor and issue ArrowRight as the editable-target shortcut regression input. (Night remained selected on its obverse face.)
- [x] Send `f` while the source editor retained focus as the flip-shortcut isolation regression input. (Night remained on its obverse face.)
- [x] Reset the editor after the focused-key regression to restore the canonical Night source.
- [x] Compile the canonical Night source live, then invoke Reset to test that the parent discards the live projection.
- [x] Verify that editing a successfully compiled source immediately withholds its obsolete live projection.
- [x] Establish a valid live Night projection, then replace its editor draft with a distinct valid k=7 source without compiling it.
- [x] Compile the edited k=7 draft, confirm the current live trace, then reset the temporary browser draft to the canonical specimen source.

## Immutable authentic-image workflow

- [x] Sync and audit the five replacement originals without modifying their bytes.
- [x] Move user image data out of Git and introduce a raw-byte-preserving authenticated upload path with provenance records.

## Gallery visual modes

- [x] Render all Robby references in lower-case monotype styling.
- [x] Add a persisted light/dark visual-mode control with black dark surfaces and orange structural borders.
- [x] Add a layout-stable image-only concentration mode that leaves only the active image, flip, and previous/next controls visible.

## Header redesign and Night duality audit

- [x] Reorganize the header around a two-line robby identity, compact compiler state, and hamburger navigation.
- [x] Use the supplied sunglasses and text-visibility SVGs for light/dark and image-only controls.
- [x] Audit the Night duality derivative against the immutable original and correct any confirmed double-image artifact without transforming the source JPEG.

## Footer identity and links

- [x] Replace the footer’s explanatory copy with the orange observation statement, requested social icon links, and linked Mahesh Shantaram copyright notice.

## Managed-storage cleanup

- [x] Audit managed storage references and remove verified obsolete local legacy remnants, preserving authentic originals and files referenced by the current gallery.
- [x] Hard-delete obsolete unreferenced managed `/manus-storage` objects through a supported storage-management path, if one is available.

## Secondary-header and control refinements

- [x] Apply the requested orange/black word treatment, remove redundant secondary-header labels, and reduce its height.
- [x] Preserve the primary header in image-only mode and maintain visible contrast for active visual-mode controls.
- [x] Increase hamburger-menu content size while retaining accessible navigation.

## Gallery controls and evidence composition

- [x] Move flip and previous/next controls directly beneath the image, eliminating the separate navigation bar.
- [x] Join the live-source editor visually with the compilation trace as one reverse-L evidence object.

## Secondary-title reflow

- [x] Reflow the secondary title as “Explainable visual composition” followed by “compiler in rust.”

## Artwork-view and image-area refinement

- [x] Preserve orange Explainable/compiler emphasis while refining the supporting sentence’s line length.
- [x] Add a compact title-size preference and optional full-bleed artwork view.
- [x] Restore title/signatures, controls, image library, and live-source area as three bordered sections with the requested control alignment.

## Full-bleed touch navigation

- [x] Remove the compact title-size control and its supporting state.
- [x] Add accessible touch swipe navigation between gallery images in full-bleed artwork view.

## Identity copy and evidence seam

- [x] Add the requested product subtitle and secondary-header two-sided-image question.
- [x] Increase the gap between image-library thumbnails and the live source section.
- [x] Remove the live-source section’s right border so it attaches seamlessly to the compilation trace column.

## Trace clarity refinement

- [x] Remove the duplicate specimen title and metadata block beneath the image.
- [x] Increase the numbered compilation-trace sections for clearer use of the available trace-column space.
- [x] Restore a valid accessible label for the object stage after removing the under-image title block.

## Identity, controls, trace, and brief pages

- [x] Move the readable product subtitle to the center of the header.
- [x] Move selected image serial and dimensions below the image; top-align Turn to Inverse with signature badges; place previous/next beneath it.
- [x] Increase compilation-trace card typography and spacing for readability.
- [x] Add polished hamburger-menu pages for the hackathon brief and “Even Better Than the Real Thing?” concept document.

## Trace and toolchain-status refinement

- [x] Reduce the compilation-trace step-number cell width by 50 percent.
- [x] Replace the ambiguous header compiler label with the verified Rust toolchain version.

## Trace spacing and dynamic compiler status

- [x] Restore the trace step-number column width and tighten only the gap between step numbers and operation text.
- [x] Increase the header compiler-status text and derive its version from compiler build metadata rather than a hardcoded UI value.

## Build 06 — provenance strip and compilation trace modes

- [x] Create and work from the `dev/brinda` branch for Build 06.
- [x] Replace the pre-footer manifest strip with Object Provenance, Runtime Manifest, and Reverse Record tabs populated from the active specimen.
- [x] Add hover/click disclosure for provenance and runtime fields, including raw values and hash-computation explanations.
- [x] Add five functional trace tabs: Diff, Evidence, Registrar, Pedagogic, and Failure.
- [x] Use active source/editor state for derivable trace-mode data and clearly label simulated failure or unavailable history content.
- [x] Add regression coverage and verify gallery cycling, source editing, tab updates, and production build.
- [x] Report the tabs backed by real data, simulated content, and the future state/backend work needed for persistent compile history.

## Build 06 completion checks

- [x] Cycle to a second specimen and verify the provenance and runtime tabs refresh with that specimen’s source and checksum data.
- [x] Deliver a Build 06 report distinguishing real per-specimen records, browser-session/simulated trace content, and the persistent history work still required.

## Persistent compilation history and signed registrar export

- [x] Persist successful Rust/WASM compilation snapshots across browser sessions using IndexedDB.
- [x] Load persistent specimen history into Diff mode without changing approved gallery or editor mechanics.
- [x] Generate and persist a browser-local signing key for registrar attestation, with clear scope labeling.
- [x] Add Registrar controls to download signed JSON and PDF records.
- [x] Verify stored history reload, signed export structure, download actions, and full regressions.

## Live compiler projection clarity

- [x] Investigate why changing palette and reverse parameters recompiles the IR without changing the flipped bitmap.
- [x] Make the editor and image-object stage accurately communicate or implement live inverse rendering behavior.
- [x] Verify the corrected editor-to-inverse interaction and regression coverage.

## Server-side live image execution

- [x] Audit and select a production-safe server-side executor path compatible with the existing compiler and authentic-source storage.
- [x] Add a validated image-render endpoint that preserves original JPEGs and writes only fresh derived output artifacts.
- [x] Update the editor pipeline so successful execution dynamically replaces the inverse face with the newly rendered derivative.
- [x] Add automated tests showing palette and reverse configuration changes trigger distinct rendering requests and output records.
- [x] Verify source immutability, execution failures, responsive gallery behavior, and production deployment requirements.

## Live executor completion checks

- [x] Verify in the browser that a palette/reverse edit compiles, flips to a fresh inverse URL, and replaces the prior static derivative.
- [x] Add explicit API failure-path tests and confirm stale live derivatives clear when execution fails.
- [x] Verify mobile live-render interaction and confirm the Docker-based production runtime starts Python dependencies successfully.

## Live executor evidence hardening

- [x] Add an automated HTTP test for the `/api/live-render` validation failure response.
- [x] Verify in the browser that a failed recompile clears a previously displayed live derivative and shows the error state.
- [x] Publish and exercise the Docker-based production endpoint to prove the Python executor starts with deployed dependencies.

## Stable gallery viewing window

- [x] Keep the image-object viewport height stable when gallery specimens have different aspect ratios.
- [x] Keep Previous and Next controls at a stationary vertical position while cycling through gallery images.
- [x] Verify the stable stage on desktop and mobile viewports.

## Stable stage mobile interaction check

- [x] Measure the mobile image-window height and Next-control position before and after cycling across specimens.

## Sacred artwork stage and transition

- [x] Remove all artificial interface pixels, controls, and indicators from on-image positions.
- [x] Move the full-bleed action and face/registration indicators into neutral space around the artwork.
- [x] Increase the stable image viewing-window height without moving navigation controls between specimens.
- [x] Add a reduced-motion-safe directional slide transition when the selected image changes, distinct from the 3D face-turn.
- [x] Verify overlay-free artwork, stable controls, and slide/flip behavior on desktop and mobile.

## Pure-slide motion refinement

- [x] Remove all opacity interpolation from gallery specimen navigation so replacement is purely positional.
- [x] Tighten directional gallery-slide timing while preserving the separate 3D face-turn and reduced-motion path.
- [x] Verify forward/backward gallery slides and the obverse–inverse card flip.

## Full-screen layout refinement

- [x] Move the full-screen activation control to the left of the dimensions in the lower-right stage metadata area.
- [x] Constrain full-screen artwork above the bottom orange information separator with a dedicated safe image area.
- [x] Verify the activation control and full-screen image containment on desktop and mobile.

## Authentic gallery refresh and sequencing

- [x] Inspect newly uploaded immutable originals and identify the removed previous specimen.
- [x] Reconcile the active gallery catalogue, immutable-original allowlist, and source metadata without transforming source JPEGs.
- [x] Add clear documentation identifying the exact gallery-order control point for future sequencing changes.
- [x] Verify each refreshed gallery specimen, navigation sequence, and source integrity metadata.

## Native-dimension live rendering

- [x] Accept Rust compiler IR canvas dimensions emitted as null when a base-only script intentionally preserves the source image’s native size.
- [x] Add regression coverage for native-dimension refreshed gallery IR through the live-render validator.

## Stable subfooter tabs

- [x] Keep the provenance subfooter’s overall height fixed while switching Object Provenance, Runtime Manifest, and Reverse Record tabs.
- [x] Correct the Reverse Record triage-link cell alignment so its text stays within the shared panel geometry.
- [x] Verify stationary tab-panel geometry on desktop and mobile.

## Compact gallery and trace hierarchy

- [x] Make the thumbnail gallery beneath the artwork a single left-right scrollable filmstrip rather than a multi-row grid.
- [x] Remove duplicate colour-signature and C2PA status from beneath the artwork, retaining and elevating this evidence in the compilation trace.
- [x] Move compilation-trace tabs left, remove the orange rule above step 01, and increase trace-card spacing and text size slightly.
- [x] Replace the under-image selected-object line with `OBVERSE · dimensions`, center the face-turn control, and place Previous/Next plus the mono serial at bottom-right.
- [x] Verify compact desktop and mobile layout, horizontal thumbnail scroll, navigation, and preserved trace readability.

## Background-only artwork stage

- [x] Remove black letterbox surfaces from the obverse and inverse faces while retaining full-image containment.
- [x] Make unused stable-stage area resolve to the archival page background for portrait and landscape specimens.
- [x] Verify representative 4:3 and 3:2 images on desktop and mobile without clipping or black bars.

## Dark-stage transparency and unified control row

- [x] Remove any remaining dark-mode black letterbox surface from the stable viewing window and image faces.
- [x] Place the expand control before the obverse/dimensions metadata, the face-turn at center, and Previous/Next with orange serial on one desktop control row.
- [x] Preserve an accessible responsive arrangement when the three control groups no longer fit on a phone-width row.
- [x] Verify light/dark face containment and control placement on desktop and mobile.

## Subfooter tab selection refinement

- [x] Increase the baseline visual weight of Object Provenance, Runtime Manifest, and Reverse Record tabs.
- [x] Replace selected-tab weight emphasis with an outlined-box state in light and dark themes.
- [x] Verify tab treatment on desktop and mobile without changing the fixed subfooter height.

## Readable provenance subfooter

- [x] Center selected tab labels inside their outlined boxes and add top breathing room between the tab rail and panel.
- [x] Increase the selected-tab outline thickness so the state reads as a confident tab/button.
- [x] Move the provenance icon into the widened tab rail and remove the duplicate black-panel header.
- [x] Use recovered panel height to increase provenance cell label and value font sizes.
- [x] Verify desktop and mobile tab spacing, centering, and enlarged cell readability.

## Synced gallery repair and permanent authenticity safeguard

- [x] Diagnose and restore active gallery image delivery after the repository sync without changing any authentic source bytes.
- [x] Make provenance-tab outlines slightly thicker and visually attach the tab rail to the black panel below.
- [x] Increase provenance-tab icon size and move the fullscreen expansion control to the right of the face/dimensions metadata.
- [x] Create and validate a reusable agent skill that forbids gallery image crops, conversions, WebP derivatives, or other transformed source substitutes.
- [x] Verify authenticated gallery rendering, tab/control placement, source integrity constraints, and build health.

## C2PA credential detection repair

- [x] Trace the currently rendered managed-storage JPEG bytes through the C2PA badge data flow. (The UI is hardcoded to historical marker-scan records; the current catalogue keys match the served and allowlisted source SHA-256 values.)
- [x] Run an actual C2PA validator against the exact gallery JPEG bytes and preserve its evidence without altering originals. (Official `c2patool` validates a Lightroom Classic 15.1 manifest for Ghana; the other ten currently mapped objects return “No claim found,” indicating the fresh storage uploads have not yet been linked.)
- [x] Replace stale marker-only credential states with measured validation outcomes and claim metadata where available. (The gallery starts as C2PA CHECKING and overlays official CAI Node SDK evidence after checksum-verifying the exact managed source bytes.)
- [x] Add regression coverage so credential-bearing JPEGs cannot silently display C2PA ABSENT. (Validator summaries distinguish present, candidate/invalid, and absent outcomes.)
- [x] Verify gallery badges, TypeScript, unit tests, Rust tests, and production build before deployment. (Ghana renders C2PA PRESENT with `lightroom_classic/15.1`; 33 Vitest tests and 11 Rust tests pass.)
- [x] Reconcile the freshly uploaded credential-bearing storage objects to the gallery when their authorized Manus storage keys or URLs are available. (The File Storage screenshot confirms the same eleven basenames already bound to the active immutable allowlist; each supplied source-of-truth SHA-256 exactly matches its current gallery record.)

## Project storage C2PA source reconciliation

- [x] Reconcile the eleven screenshot-confirmed File Storage names—Bipasha, Addis Ababa, Uganda, FIDH Guinea, Murgeshpalya, Kashmir, Ghana, Nagaland, Hong Kong, Ayodhya, and Bangalore—with exact managed object keys and hashes.
- [x] Inventory the project’s managed-storage JPEG objects and match fresh uploads to their exact hashes and gallery filenames. (The raw filename keys resolve through the storage proxy; current hash-suffixed gallery keys match all eleven source-of-truth SHA-256 values.)
- [x] Validate the exact fresh stored JPEG bytes through the official C2PA reader and retain claim/validation evidence. (C2PA manifests are found only in `MS201910-Ghana9243.jpg`, generated by `lightroom_classic/15.1`; the other ten files return no claim.)
- [x] Bind the gallery and immutable live-render allowlist to the identified authentic storage keys without transforming or copying image bytes. (No remapping is warranted: the existing active keys already bind to the verified exact bytes.)
- [x] Verify served JPEG hashes, C2PA badge outcomes, ephemeral reverse generation, tests, Rust tests, and production build. (All 11 supplied source hashes match the active allowlist; Ghana remains the sole validator-confirmed manifest. TypeScript, 34 Vitest tests, production build, and 11 Rust tests pass.)

## Ephemeral reverse compiler execution

- [x] Inventory all current persistent reverse PNG artifacts and separate them from immutable JPEG originals and approved identity assets. (Eleven catalogue inverse PNGs and the `live-renders/` writer are generated artifacts; JPEG originals and `robby-registration-mark` remain protected identity/source assets.)
- [x] Replace static reverse URLs and persisted live-render derivatives with one on-demand compiler execution when the user requests a turn to inverse.
- [x] Keep generated reverse bytes transient: return them directly to the viewer without S3 upload, database persistence, or a durable derivative URL.
- [x] Confirm repeated requests using the same authenticated source bytes and compiler IR yield byte-identical reverse output. (Two direct requests returned identical PNG SHA-256 `77572195…c59f070`.)
- [x] Delete only verified generated reverse artifacts from managed storage; retain approved logo and non-reverse identity assets. (Removed local generated PNG staging; retired the static gallery-artifact builder and all active reverse storage references. The exposed managed-storage interface has no physical-delete method; unreferenced keys are unreachable.)
- [x] Add regression coverage for on-demand execution, no-persistence behavior, deterministic output, and source immutability.
- [x] Verify gallery flip behavior, C2PA evidence, TypeScript, tests, Rust tests, and production build after the migration.
