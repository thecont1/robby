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

export type CredentialSignature = {
  status: "absent";
  sourceSha256: string;
  markerScan: string;
  note: string;
};

export type ColourSignature = {
  pixelSha256: string;
  paletteSha256: string;
  algorithm: string;
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
  reverseMode: "provenance-map" | "palette-grid";
  reverseKind: string;
  reverseDescription: string;
  scriptHash: string;
  outputHash: string;
  palette: readonly string[];
  trace: readonly TraceStep[];
  script: string;
  credentialSignature: CredentialSignature;
  colourSignature: ColourSignature;
};

const paletteTrace = (source: string, dimensions: string): readonly TraceStep[] => [
  { stage: "01", label: "Base canvas", code: `base(\"${source}\")`, detail: `${dimensions} · source checksum recorded` },
  { stage: "02", label: "Calculate palette", code: "palette(k: 8)", detail: "8 dominant clusters sampled from obverse" },
  { stage: "03", label: "Render inverse", code: 'reverse("palette-grid")', detail: "palette plate derived from the rendered obverse" },
  { stage: "04", label: "Write manifest", code: "output(…manifest.json)", detail: "process graph and output checksums recorded" },
];

const galleryScripts = {
  night: String.raw`# A one-layer composition using the supplied street photograph as its base.
base("night-street.jpg", width: 1440, height: 1080)

cutout(source: "courier.png", mask: "person", id: "courier")
place(cutout: "courier", x: 0.72, y: 0.64, scale: 0.92, rotation: -2, opacity: 0.96, blend: "normal")

palette(k: 8)
reverse(mode: "provenance-map")
reverse(mode: "palette-grid", k: 8)

output(obverse: "night-obverse.png", reverse: "night-reverse.png", manifest: "night-manifest.json")
`,
  ayodhya: String.raw`# A base-only visual object: its reverse is a palette audit of the obverse.
base("MS202401-Ayodhya0041.webp")
palette(k: 8)
reverse(mode: "palette-grid", k: 8)
output(obverse: "ayodhya-mural-obverse.png", reverse: "ayodhya-mural-reverse.png", manifest: "ayodhya-mural-manifest.json")
`,
  urban: String.raw`# A base-only visual object: the compiler records its colour evidence.
base("_DSF0739-Enhanced-NR.webp")
palette(k: 8)
reverse(mode: "palette-grid", k: 8)
output(obverse: "urban-fantasy-obverse.png", reverse: "urban-fantasy-reverse.png", manifest: "urban-fantasy-manifest.json")
`,
  murgeshpalya: String.raw`# A base-only visual object: the reverse exposes the obverse’s dominant colours.
base("MS201901-Murgeshpalya0018.webp")
palette(k: 8)
reverse(mode: "palette-grid", k: 8)
output(obverse: "murgeshpalya-passage-obverse.png", reverse: "murgeshpalya-passage-reverse.png", manifest: "murgeshpalya-passage-manifest.json")
`,
  uganda: String.raw`# A base-only visual object: its reverse is a calculated palette plate.
base("MS201508-Uganda0016.webp")
palette(k: 8)
reverse(mode: "palette-grid", k: 8)
output(obverse: "uganda-diptych-obverse.png", reverse: "uganda-diptych-reverse.png", manifest: "uganda-diptych-manifest.json")
`,
} as const;

const absentCredential = (sourceSha256: string): CredentialSignature => ({
  status: "absent",
  sourceSha256,
  markerScan: "C2PA/JUMBF byte marker scan",
  note: "No embedded C2PA or JUMBF marker detected in the local source bytes.",
});

const colourSignature = (pixelSha256: string, paletteSha256: string): ColourSignature => ({
  pixelSha256,
  paletteSha256,
  algorithm: "robby-executor-v1 deterministic k-means palette",
});

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
    reverseMode: "provenance-map",
    reverseKind: "Provenance map",
    reverseDescription: "A spatial contribution map: vermilion identifies the placed courier layer.",
    scriptHash: "249ff423dff23260416298d0b3bf286fb8af3074761fe3bf21f2f32349388581",
    outputHash: "6c73907fa9ead7e85ad69e0c043ff2d576c6b0f19fc1b9bde63cb62f3597d89f",
    palette: ["#424047", "#649BE8", "#BEA3DB", "#15161B", "#7A777B", "#AAB0A6", "#D7DDE6", "#3A57C6"],
    script: galleryScripts.night,
    credentialSignature: absentCredential("261639173101e8b07f8b77da5104206c2deb7db4e7c42bad2d78b461907c7302"),
    colourSignature: colourSignature("9c178fbb61496cadc7599558cc1bbeef32d1507698398f12a5e6a02e85386af5", "60f267562ff6fd9002ccb4380e0baf287bd1ed7001df6751d6b24b3d559795b6"),
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
    reverseMode: "palette-grid",
    reverseKind: "Palette plate",
    reverseDescription: "Eight calculated colour clusters compress the mural, crowd, and concourse into a companion plate.",
    scriptHash: "c692e96c1e1361b8189ad6f1da8a5590048f841bbc76dc9eaeae83205b64c915",
    outputHash: "64aedad386d543a1a77871112249073463c53e038e554365347b8640463699d5",
    palette: ["#4C4A40", "#CCB38D", "#D6D3D2", "#1E202A", "#726F5A", "#9A997A", "#C15942", "#167BB8"],
    script: galleryScripts.ayodhya,
    credentialSignature: absentCredential("7b97c159e3eb5b021e18cf76d9b3efd3704bf4f1990f985a460524c3d98926c8"),
    colourSignature: colourSignature("78ee78cb60c8b774f1292a30b619645e3f38482f4e0440ff1732535a2421e852", "83c583bdaa06e1566972d0d25751a55b238c7816036784550596688c7c412cd2"),
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
    reverseMode: "palette-grid",
    reverseKind: "Palette plate",
    reverseDescription: "The inverse resolves the image’s competing cyan, corrugated metal, and gold tones into calculated blocks.",
    scriptHash: "75c1cdf2b074ebfdf569264cfcfb06649232c7ecad57d2edd0796b9aa2289f53",
    outputHash: "06157b187295d6d12405276b0227523913c8e43c67df7edadb443bd8fcdcdc4b",
    palette: ["#0F94C7", "#594F34", "#C1D7DE", "#1C2419", "#939A99", "#5FB1DB", "#4E6E79", "#AC8536"],
    script: galleryScripts.urban,
    credentialSignature: absentCredential("5f975d0b13563d5bc54e3fd98c559644a21a0219191afb6ca8e2c3a9c6d8e3a1"),
    colourSignature: colourSignature("a5af195c48a5f8dbcd4da9cd87e5330b9e33a2b709ce6e4bcfdea3929f38d493", "eed0dcb55666e74c9a0dbec4160c5be5ad2f0143e07650b6bc47aca4ba03df8c"),
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
    reverseMode: "palette-grid",
    reverseKind: "Palette plate",
    reverseDescription: "The inverse reduces a tangled street scene to eight hues without reproducing its spatial arrangement.",
    scriptHash: "4a190307c6e4391a87adb1db6db222e5bc3eea5cb9517cd661dab6818cc86b23",
    outputHash: "6c5ce68c16197666fec7dfe0f923b3bdc04278455df6fd9d184c3b89103cc8b8",
    palette: ["#161617", "#393738", "#5C5858", "#7C7675", "#959395", "#B2B1AE", "#CAEBFC", "#C5CCD2"],
    script: galleryScripts.murgeshpalya,
    credentialSignature: absentCredential("a5f88d9555f6b76272ca6975ed05f7b65bc7cf0fb9ce10afe1d512af85b977b5"),
    colourSignature: colourSignature("587bfb208c90ec9c19c1d20582a4da7a17a1d5e421778ae6bec2857bfdb1dac0", "2926615217bcc00932c889d164a3d7a1994fba5f35c9e3551f4bf94747feb3ac"),
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
    reverseMode: "palette-grid",
    reverseKind: "Palette plate",
    reverseDescription: "A monochrome palette plate carries the tonal evidence of the two paintings and their bearers.",
    scriptHash: "764c5592c202ac42160f4c107c682f8385b7abca21b924c32738323df22ad5d6",
    outputHash: "1e66213b9c7d71aabe6ba81daf5322c34bde0c37cb069604484f5fbecee7d6b6",
    palette: ["#E4E4E4", "#070707", "#BEBEBE", "#8E8E8E", "#707070", "#515151", "#363636", "#1A1A1A"],
    script: galleryScripts.uganda,
    credentialSignature: absentCredential("02ab6db06a282c4362d30f5afc7922ece8c72c50a595acaf2c1e0ce936fbee8a"),
    colourSignature: colourSignature("fb72924d45ec7b3832fc6c92f87b764cfcad460b11819d2fdf3a799c269858e9", "44034e1180b32729e124977c4787b968c511775a099aa831e0c356c9246ab928"),
    trace: paletteTrace("MS201508-Uganda0016.webp", "2048 × 1365"),
  },
] as const;
