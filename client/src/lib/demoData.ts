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
  status: "absent" | "present";
  sourceSha256: string;
  markerScan: string;
  note: string;
  claimGenerator?: string;
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
base("IMG_20210916_185510.jpg", width: 1440, height: 1080)

cutout(source: "courier.png", mask: "person", id: "courier")
place(cutout: "courier", x: 0.72, y: 0.64, scale: 0.92, rotation: -2, opacity: 0.96, blend: "normal")

palette(k: 8)
reverse(mode: "provenance-map")
reverse(mode: "palette-grid", k: 8)

output(obverse: "night-obverse.png", reverse: "night-reverse.png", manifest: "night-manifest.json")
`,
  ayodhya: String.raw`# A base-only visual object: its reverse is a palette audit of the obverse.
base("MS202401-Ayodhya0041.jpg")
palette(k: 8)
reverse(mode: "palette-grid", k: 8)
output(obverse: "ayodhya-mural-obverse.png", reverse: "ayodhya-mural-reverse.png", manifest: "ayodhya-mural-manifest.json")
`,
  urban: String.raw`# A base-only visual object: the compiler records its colour evidence.
base("_DSF0739-Enhanced-NR.jpg")
palette(k: 8)
reverse(mode: "palette-grid", k: 8)
output(obverse: "urban-fantasy-obverse.png", reverse: "urban-fantasy-reverse.png", manifest: "urban-fantasy-manifest.json")
`,
  murgeshpalya: String.raw`# A base-only visual object: the reverse exposes the obverse’s dominant colours.
base("MS201901-Murgeshpalya0018.jpg")
palette(k: 8)
reverse(mode: "palette-grid", k: 8)
output(obverse: "murgeshpalya-passage-obverse.png", reverse: "murgeshpalya-passage-reverse.png", manifest: "murgeshpalya-passage-manifest.json")
`,
  uganda: String.raw`# A base-only visual object: its reverse is a calculated palette plate.
base("MS201508-Uganda0016.jpg")
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

const presentCredential = (sourceSha256: string, claimGenerator: string): CredentialSignature => ({
  status: "present",
  sourceSha256,
  markerScan: "c2patool detailed manifest validation",
  claimGenerator,
  note: "Embedded C2PA manifest is present. Data-hash and claim checks are valid; the local trust store reports the signing credential as untrusted, so Robby retains the original bytes and surfaces this warning rather than overstating trust.",
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
    source: "IMG_20210916_185510.jpg",
    dimensions: "1440 × 1080",
    ratio: "four-three",
    obverse: "/manus-storage/night-obverse_3cc9652f.png",
    reverse: "/manus-storage/night-reverse_704fbdd1.png",
    reverseMode: "provenance-map",
    reverseKind: "Provenance map",
    reverseDescription: "A spatial contribution map: vermilion identifies the placed courier layer.",
    scriptHash: "365294f8130727987c35fca286cc84789c617e3ddf5c884e1990eeeecc37f4b5",
    outputHash: "6c103e573eff762ea5138e766f27901b955ca8f3ca500b787c95f44193264327",
    palette: ["#423F47", "#6899E6", "#C0A8DD", "#7B787C", "#14151B", "#ABAFA9", "#DAE0E6", "#3B56C5"],
    script: galleryScripts.night,
    credentialSignature: presentCredential("a30fed1f8409c20224935861f158b40b05552bf3b932e264bb262549704843bb", "lightroom_classic/15.3.1"),
    colourSignature: colourSignature("5d3a0e2864b357816e94c417e40a67901ca524f201dd7b9aa5eb724f2b7f12e0", "60f7f329e81c9ca559e407a36c8efb39a756d02c7cd19ecd253213e4f32fb9c8"),
    trace: [
      { stage: "01", label: "Base canvas", code: 'base("IMG_20210916_185510.jpg")', detail: "1440 × 1080 · source checksum recorded" },
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
    source: "MS202401-Ayodhya0041.jpg",
    dimensions: "2276 × 1707",
    ratio: "four-three",
    obverse: "/manus-storage/ayodhya-mural-obverse_36570955.png",
    reverse: "/manus-storage/ayodhya-mural-reverse_3244cb85.png",
    reverseMode: "palette-grid",
    reverseKind: "Palette plate",
    reverseDescription: "Eight calculated colour clusters compress the mural, crowd, and concourse into a companion plate.",
    scriptHash: "76b161d2cdab494c6ab9b49cfa6ada5eb54f92774003cd9e6c8a694de59cba3f",
    outputHash: "b15a500d81e71375c111abc63893eef7ee8220b119bad715bb5137126a321d2f",
    palette: ["#555148", "#23242C", "#ABA093", "#95755C", "#C2C3CE", "#DAC483", "#E7E1D5", "#1674B4"],
    script: galleryScripts.ayodhya,
    credentialSignature: presentCredential("82bf66f71a669a0755793e2c2d40c5817df600b15e9e45fd8f1676c194be5e46", "lightroom_classic/15.2.1"),
    colourSignature: colourSignature("e0de66ebc2c2ca2d6b54a1eca1690dbeb5adbeefba9ac1495d6a8a8cb700136a", "98b123d59761adab121876d4ce21d3029d9af82ae49b02956324b52bc68d5553"),
    trace: paletteTrace("MS202401-Ayodhya0041.jpg", "2276 × 1707"),
  },
  {
    id: "urban-fantasy",
    serial: "03 / 05",
    title: "Urban fantasy",
    subtitle: "Roadside repair / imagined skyline",
    date: "2024",
    source: "_DSF0739-Enhanced-NR.jpg",
    dimensions: "2276 × 1707",
    ratio: "four-three",
    obverse: "/manus-storage/urban-fantasy-obverse_142be99a.png",
    reverse: "/manus-storage/urban-fantasy-reverse_61da6c1c.png",
    reverseMode: "palette-grid",
    reverseKind: "Palette plate",
    reverseDescription: "The inverse resolves the image’s competing cyan, corrugated metal, and gold tones into calculated blocks.",
    scriptHash: "911f48bc6cabcc8772eb379ab24ecda45d778185235b3abb010fd0c7a110e4e0",
    outputHash: "3312ab976659e39bfe85a0b48b1f1a8714350f19a09c8ca8d900ce6b25cf8f7a",
    palette: ["#0C93C7", "#C3D7DE", "#51492D", "#5FAFDB", "#959694", "#536C72", "#182016", "#AD8125"],
    script: galleryScripts.urban,
    credentialSignature: presentCredential("dee92545e6882540392d626217367053db8e0f9095d906f0e98270bf76cc629d", "lightroom_classic/15.1"),
    colourSignature: colourSignature("3cb4b699adf3427a7244dd7cfce375a2d6f6c2a968cc71b279bddce684f4a1a4", "7ab38a5f14f248384dfca6b0bff808829d4b2e46c69cd6006efa37d688515e61"),
    trace: paletteTrace("_DSF0739-Enhanced-NR.jpg", "2276 × 1707"),
  },
  {
    id: "murgeshpalya-passage",
    serial: "04 / 05",
    title: "Murgeshpalya passage",
    subtitle: "Street works / weekday passage",
    date: "2019",
    source: "MS201901-Murgeshpalya0018.jpg",
    dimensions: "2533 × 1900",
    ratio: "four-three",
    obverse: "/manus-storage/murgeshpalya-passage-obverse_2833e01c.png",
    reverse: "/manus-storage/murgeshpalya-passage-reverse_1cc7effc.png",
    reverseMode: "palette-grid",
    reverseKind: "Palette plate",
    reverseDescription: "The inverse reduces a tangled street scene to eight hues without reproducing its spatial arrangement.",
    scriptHash: "b012725be7c576255c4ea127f6d87dbb0f0198b27e210eb0036956a10b6300c3",
    outputHash: "d5cba8ecf1433bd913b124ffd2349e5469dc9df87871ecbc090474b2205cc139",
    palette: ["#131415", "#746F6E", "#323031", "#535051", "#8F8B8D", "#D0E9FA", "#AAA9A9", "#C4C2BF"],
    script: galleryScripts.murgeshpalya,
    credentialSignature: presentCredential("33960e39e0357047ae58fda033e0564f5396db5020b0d361887ce242807e8979", "lightroom_classic/15.3.1"),
    colourSignature: colourSignature("d37d10fbfb1fe9d5d307fa4be53aaee7db5200def8b1081f8f472196384719d6", "85e71223da522db4d89a9f71b561fd6610a0c615608de2eeac092327b0159015"),
    trace: paletteTrace("MS201901-Murgeshpalya0018.jpg", "2533 × 1900"),
  },
  {
    id: "uganda-diptych",
    serial: "05 / 05",
    title: "Uganda diptych",
    subtitle: "Artwork presentation / double portrait",
    date: "2015",
    source: "MS201508-Uganda0016.jpg",
    dimensions: "2560 × 1707",
    ratio: "three-two",
    obverse: "/manus-storage/uganda-diptych-obverse_4cecee7d.png",
    reverse: "/manus-storage/uganda-diptych-reverse_1cbc7886.png",
    reverseMode: "palette-grid",
    reverseKind: "Palette plate",
    reverseDescription: "A monochrome palette plate carries the tonal evidence of the two paintings and their bearers.",
    scriptHash: "c76e533b2b6469ee1ae7611779e6034eff9dbd3da0fb1a25a89556de232c8b04",
    outputHash: "61a53e9a5d956388258364546aed624a23157c19087bfafb95c0fd5aa3bddbb4",
    palette: ["#090909", "#EBEBEB", "#DDDDDD", "#808080", "#C7C7C7", "#2F2F2F", "#565656", "#ACACAC"],
    script: galleryScripts.uganda,
    credentialSignature: presentCredential("c0fc147c67e4b6bf2a4a761a6421a95856bfb7672b79eee13dbad42f29aa4891", "lightroom_classic/15.1"),
    colourSignature: colourSignature("5255afcb5afcc8dc0103c94e3d35cddb0bfbfbd551e3ea3e5b599ee5bc0ee66c", "ca4832150d3ac6d2b034c98224ab9a7cbb227a611652d07fa541475b02fa280c"),
    trace: paletteTrace("MS201508-Uganda0016.jpg", "2560 × 1707"),
  },
] as const;
