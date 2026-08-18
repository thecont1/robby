# Sacred artwork stage — verification notes

## 2026-08-18

- The live desktop gallery presents a **690px** fixed artwork viewport for the initial specimen. The active image’s accessible bounding box is `898 × 690`.
- The artwork face contains no visible face-stamp, registration-corner, or full-view control overlays. The four registration marks occupy the neutral outer frame; selected-face information and the full-view action sit in the metadata strip below.
- The compiled gallery still exposes separate **Next image** and **Turn to inverse** controls for testing the two motion paths independently.

The live forward-navigation check replaced Night duality with Ayodhya mural while preserving an identical `898 × 690` artwork viewport and the same neutral metadata/control geometry beneath it. The face-turn button remains available as a separate action after the navigation slide completes.

The subsequent **Turn to inverse** action changed only the active face to Ayodhya mural’s inverse. Its visible image box remained `898 × 690`, demonstrating that the retained face-turn is separate from specimen navigation and does not alter the stable stage geometry.

At a `375px` mobile viewport, the image occupies a fixed `338 × 277` stage box. The metadata, face indication, full-view action, flip control, and gallery navigation remain in distinct surrounding blocks rather than over the image itself.

## Pure-slide refinement

The gallery navigation keyframes now animate only `transform: translateX(...)`: outgoing and incoming specimens travel a full viewport width, with no `opacity` declaration or interpolation. The inner object-turner retains its separate 3D transform transition for face changes.

A refreshed live navigation check advanced from Night duality to Ayodhya mural through the pure-slide path; the successor rendered normally in the fixed stage and the separate flip control remained present for the inverse-only card-turn path.

## Full-screen layout refinement

The stage metadata now exposes the full-screen activation control before the dimensions in the right-aligned lower metadata rail, making the trigger the element immediately to the left of `1440 × 1080 · OBVERSE` for the initial specimen.

The full-screen viewer now has two explicit rows: an upper artwork-safe viewport with additional bottom clearance and a separate bottom information rail divided by a 2px orange rule. The image is constrained within the upper row and cannot occupy the rail.

The opened viewer exposes its title, swipe/escape guidance, and close action as a distinct information rail; none of these controls is rendered over the artwork bitmap.

Measured final mobile-viewer geometry confirms the artwork is reduced to `432 × 324px` and ends **18px above** the image viewport’s lower edge. That edge meets the information rail’s 2px orange separator exactly, so the image remains fully above the rule and cannot overlap the bottom information.

## Gallery refresh — 2026-08-18

The active gallery now starts with **Bipasha & Aashish** rather than the retired Night duality study. Its first rendered face and adjacent trace load from a regenerated Rust compiler → Python executor artifact set, and its base-canvas trace records the preserved source filename and native `2048 × 1535` geometry.

The live gallery control exposed `01 / 10` for Bipasha & Aashish and advanced successfully to the second refreshed specimen, Uganda diptych. The normal gallery slide remained available during this first refreshed navigation transition.

The live server renderer accepted the fresh Bipasha & Aashish IR after its native-dimension compatibility fix, revalidated the immutable source SHA-256, and returned newly generated obverse, inverse, and manifest URLs with an HTTP `201` response.

## Stable subfooter tabs — 2026-08-18

At phone-width layout, the Object Provenance tab now occupies a fixed `338px` content box inside a `393px` provenance module. This establishes the shared baseline used for the Runtime Manifest and Reverse Record comparisons.

The Runtime Manifest tab measured the same `338px` content box and `393px` outer module after activation, confirming that this tab no longer changes the subfooter’s layout footprint.

Reverse Record preserved that same `338px` / `393px` mobile geometry. Its triage cell measured `70px` high, with the explanatory text ending one pixel above the cell boundary. At desktop width, the shared content box measured `158px`, the module measured `221px`, and the `92px` triage cell likewise kept its lower text one pixel inside the cell.

## Compact gallery hierarchy — 2026-08-18

Desktop inspection confirms that the compilation trace tabs now begin nearer the trace’s left edge, leave breathing room after `Failure`, and no longer show the former vermilion rule before step 01. The trace cards use larger type with expanded internal spacing, while signature evidence follows the final evidence step rather than appearing beneath the artwork.

The refreshed desktop gallery now renders six thumbnail crops in one horizontal scrollable strip rather than two rows, with the compact face/dimensions line, centered face-turn control, and mono Previous/Next serial in place. Mobile retains the same single-row thumbnail strip and trace hierarchy; a final CSS adjustment is reserved for the narrow metadata line so its dimensions cannot wrap.
