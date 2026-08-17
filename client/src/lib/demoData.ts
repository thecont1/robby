/**
 * ROBBY VISUAL SYSTEM — Contact-sheet archaeology.
 * This file mirrors the generated night-duality manifest. It holds display
 * metadata only; image URLs point to the real compiler-produced artifacts.
 */

export const compiledExample = {
  title: "Night duality",
  irVersion: "robby-ir-v1",
  manifestVersion: "robby-manifest-v1",
  sourceHash: "249ff423dff23260…49388581",
  outputHash: "6c73907fa9ea…f3597d89f",
  obverse: "/manus-storage/night-obverse_8af6fb66.png",
  reverses: {
    "provenance-map": "/manus-storage/night-reverse-provenance-map_6ff6b825.png",
    "palette-grid": "/manus-storage/night-reverse-palette-grid_b06e9353.png",
  },
  script: [
    'base("night-street.jpg", width: 1440, height: 1080)',
    'cutout(source: "courier.png", mask: "person", id: "courier")',
    'place(cutout: "courier", x: 0.72, y: 0.64, scale: 0.92, rotation: -2, opacity: 0.96, blend: "normal")',
    "palette(k: 8)",
    'reverse(mode: "provenance-map")',
    'reverse(mode: "palette-grid", k: 8)',
    'output(obverse: "night-obverse.png", reverse: "night-reverse.png", manifest: "night-manifest.json")',
  ],
  nodes: [
    {
      id: "base",
      label: "Base canvas",
      code: 'base("night-street.jpg")',
      detail: "2048 × 1536 · 579 KB · SHA-256 verified",
      type: "source",
    },
    {
      id: "cutout:courier",
      label: "Extract subject",
      code: 'cutout(mask: "person")',
      detail: "courier.png · auto-foreground mask",
      type: "mask",
    },
    {
      id: "layer-1",
      label: "Place layer 01",
      code: "place(x: .72, y: .64)",
      detail: "normal blend · 0.92 scale · −2° rotation",
      type: "layer",
      color: "#E3442F",
    },
    {
      id: "obverse",
      label: "Render obverse",
      code: "compose()",
      detail: "1440 × 1080 · checksum recorded",
      type: "output",
    },
    {
      id: "reverse:provenance-map",
      label: "Render provenance map",
      code: 'reverse("provenance-map")',
      detail: "spatial contribution audit",
      type: "reverse",
    },
    {
      id: "reverse:palette-grid",
      label: "Render palette grid",
      code: 'reverse("palette-grid")',
      detail: "8 dominant colour clusters",
      type: "reverse",
    },
  ],
  layer: {
    id: "layer-1",
    color: "#E3442F",
    source: "courier.png",
    cutout: "courier",
    mask: "person",
    strategy: "opencv-grabcut-auto-foreground",
    bounds: "x 143–1440 · y 21–1080",
  },
  palette: ["#424047", "#649BE8", "#BEA3DB", "#15161B", "#7A777B", "#AAB0A6", "#D7DDE6", "#3A57C6"],
} as const;

export type ReverseMode = keyof typeof compiledExample.reverses;

