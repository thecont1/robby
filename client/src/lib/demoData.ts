/**
 * ROBBY VISUAL SYSTEM — Contact-sheet archaeology.
 * Every record below is backed by a compiled Robby script and its executor
 * artifacts. An item intentionally exposes one visible face at a time.
 */

export type TraceStep = {
  stage: string;
  label: string;
  code: string;
  detail: string;
  color?: string;
};

export type GalleryItem = {
  id: string;
  serial: string;
  title: string;
  subtitle: string;
  date: string;
  source: string;
  dimensions: string;
  ratio: "four-three" | "three-two";
  obverse: string;
  reverse: string;
  reverseKind: string;
  reverseDescription: string;
  scriptHash: string;
  outputHash: string;
  palette: readonly string[];
  trace: readonly TraceStep[];
};

const paletteTrace = (source: string, dimensions: string): readonly TraceStep[] => [
  { stage: "01", label: "Base canvas", code: `base(\"${source}\")`, detail: `${dimensions} · source checksum recorded` },
  { stage: "02", label: "Calculate palette", code: "palette(k: 8)", detail: "8 dominant clusters sampled from obverse" },
  { stage: "03", label: "Render inverse", code: 'reverse("palette-grid")', detail: "palette plate derived from the rendered obverse" },
  { stage: "04", label: "Write manifest", code: "output(…manifest.json)", detail: "process graph and output checksums recorded" },
];

export const gallery: readonly GalleryItem[] = [
  {
    id: "night-duality",
    serial: "01 / 05",
    title: "Night duality",
    subtitle: "Street image / composite study",
    date: "2021",
    source: "night-street.jpg",
    dimensions: "1440 × 1080",
    ratio: "four-three",
    obverse: "/manus-storage/night-obverse_8af6fb66.png",
    reverse: "/manus-storage/night-reverse-provenance-map_6ff6b825.png",
    reverseKind: "Provenance map",
    reverseDescription: "A spatial contribution map: vermilion identifies the placed courier layer.",
    scriptHash: "249ff423dff23260…49388581",
    outputHash: "6c73907fa9ea…f3597d89f",
    palette: ["#424047", "#649BE8", "#BEA3DB", "#15161B", "#7A777B", "#AAB0A6", "#D7DDE6", "#3A57C6"],
    trace: [
      { stage: "01", label: "Base canvas", code: 'base("night-street.jpg")', detail: "1440 × 1080 · source checksum recorded" },
      { stage: "02", label: "Extract subject", code: 'cutout(mask: "person")', detail: "courier.png · auto-foreground mask" },
      { stage: "03", label: "Place layer", code: "place(x: .72, y: .64)", detail: "normal blend · 0.92 scale · −2° rotation", color: "#E3442F" },
      { stage: "04", label: "Render inverse", code: 'reverse("provenance-map")', detail: "spatial contribution audit" },
      { stage: "05", label: "Write manifest", code: "output(…manifest.json)", detail: "process graph and output checksums recorded" },
    ],
  },
  {
    id: "ayodhya-mural",
    serial: "02 / 05",
    title: "Ayodhya mural",
    subtitle: "Terminal concourse / visual field",
    date: "2024",
    source: "MS202401-Ayodhya0041.webp",
    dimensions: "2048 × 1536",
    ratio: "four-three",
    obverse: "/manus-storage/ayodhya-mural-obverse_f17a84d1.png",
    reverse: "/manus-storage/ayodhya-mural-reverse_1ef067ec.png",
    reverseKind: "Palette plate",
    reverseDescription: "Eight calculated colour clusters compress the mural, crowd, and concourse into a companion plate.",
    scriptHash: "c692e96c1e1361b8…05b64c915",
    outputHash: "executor output · checksum recorded",
    palette: ["#4C4A40", "#CCB38D", "#D6D3D2", "#1E202A", "#726F5A", "#9A997A", "#C15942", "#167BB8"],
    trace: paletteTrace("MS202401-Ayodhya0041.webp", "2048 × 1536"),
  },
  {
    id: "urban-fantasy",
    serial: "03 / 05",
    title: "Urban fantasy",
    subtitle: "Roadside repair / imagined skyline",
    date: "2024",
    source: "_DSF0739-Enhanced-NR.webp",
    dimensions: "2048 × 1536",
    ratio: "four-three",
    obverse: "/manus-storage/urban-fantasy-obverse_56663e81.png",
    reverse: "/manus-storage/urban-fantasy-reverse_3e90b386.png",
    reverseKind: "Palette plate",
    reverseDescription: "The inverse resolves the image’s competing cyan, corrugated metal, and gold tones into calculated blocks.",
    scriptHash: "75c1cdf2b074ebfd…aa2289f53",
    outputHash: "executor output · checksum recorded",
    palette: ["#0F94C7", "#594F34", "#C1D7DE", "#1C2419", "#939A99", "#5FB1DB", "#4E6E79", "#AC8536"],
    trace: paletteTrace("_DSF0739-Enhanced-NR.webp", "2048 × 1536"),
  },
  {
    id: "murgeshpalya-passage",
    serial: "04 / 05",
    title: "Murgeshpalya passage",
    subtitle: "Street works / weekday passage",
    date: "2019",
    source: "MS201901-Murgeshpalya0018.webp",
    dimensions: "2048 × 1536",
    ratio: "four-three",
    obverse: "/manus-storage/murgeshpalya-passage-obverse_19d791cd.png",
    reverse: "/manus-storage/murgeshpalya-passage-reverse_0e6c60ca.png",
    reverseKind: "Palette plate",
    reverseDescription: "The inverse reduces a tangled street scene to eight hues without reproducing its spatial arrangement.",
    scriptHash: "4a190307c6e4391a…18cc86b23",
    outputHash: "executor output · checksum recorded",
    palette: ["#161617", "#393738", "#5C5858", "#7C7675", "#959395", "#B2B1AE", "#CAEBFC", "#C5CCD2"],
    trace: paletteTrace("MS201901-Murgeshpalya0018.webp", "2048 × 1536"),
  },
  {
    id: "uganda-diptych",
    serial: "05 / 05",
    title: "Uganda diptych",
    subtitle: "Artwork presentation / double portrait",
    date: "2015",
    source: "MS201508-Uganda0016.webp",
    dimensions: "2048 × 1365",
    ratio: "three-two",
    obverse: "/manus-storage/uganda-diptych-obverse_6ac779bf.png",
    reverse: "/manus-storage/uganda-diptych-reverse_36b1aea2.png",
    reverseKind: "Palette plate",
    reverseDescription: "A monochrome palette plate carries the tonal evidence of the two paintings and their bearers.",
    scriptHash: "764c5592c202ac42…df22ad5d6",
    outputHash: "executor output · checksum recorded",
    palette: ["#E4E4E4", "#070707", "#BEBEBE", "#8E8E8E", "#707070", "#515151", "#363636", "#1A1A1A"],
    trace: paletteTrace("MS201508-Uganda0016.webp", "2048 × 1365"),
  },
] as const;

