/**
 * ROBBY VISUAL SYSTEM — Contact-sheet archaeology.
 *
 * The gallery is data-led. To change its sequence, edit only `galleryOrder`
 * below: the first id is shown first, and removing an id retires it from the
 * active library without deleting its immutable original or derivatives.
 */

export type TraceStep = {
  stage: string;
  label: string;
  code: string;
  detail: string;
  color?: string;
};

export type CredentialSignature = {
  status: "absent" | "present" | "candidate";
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

type GalleryDefinition = Omit<GalleryItem, "serial" | "trace" | "script">;

const paletteTrace = (source: string, dimensions: string): readonly TraceStep[] => [
  { stage: "01", label: "Base canvas", code: `base("${source}")`, detail: `${dimensions} · source checksum recorded` },
  { stage: "02", label: "Calculate palette", code: "palette(k: 8)", detail: "8 dominant clusters sampled from obverse" },
  { stage: "03", label: "Render inverse", code: 'reverse(mode: "palette-grid", k: 8)', detail: "palette plate derived from the rendered obverse" },
  { stage: "04", label: "Write manifest", code: "output(…manifest.json)", detail: "process graph and output checksums recorded" },
];

const sourceScript = (id: string, source: string) => `# Immutable source study. The original JPEG is read-only; outputs are derived artifacts.
base("${source}")
palette(k: 8)
reverse(mode: "palette-grid", k: 8)
output(obverse: "${id}-obverse.png", reverse: "${id}-inverse.png", manifest: "${id}-manifest.json")
`;

const absentCredential = (sourceSha256: string): CredentialSignature => ({
  status: "absent",
  sourceSha256,
  markerScan: "C2PA/JUMBF raw-byte marker scan",
  note: "No C2PA or JUMBF marker was found in the unchanged source JPEG bytes during the gallery refresh.",
});

const candidateCredential = (sourceSha256: string): CredentialSignature => ({
  status: "candidate",
  sourceSha256,
  markerScan: "C2PA/JUMBF raw-byte marker scan",
  note: "A C2PA/JUMBF marker was found in the unchanged source bytes. The refresh did not run a cryptographic C2PA validator, so Robby labels this evidence conservatively as a candidate rather than a validated claim.",
});

const colourSignature = (pixelSha256: string, paletteSha256: string): ColourSignature => ({
  pixelSha256,
  paletteSha256,
  algorithm: "robby-executor-v1 deterministic k-means palette",
});

const catalogueById: Record<string, GalleryDefinition> = {
  "bipasha-aashish": {
    id: "bipasha-aashish", title: "Bipasha & Aashish", subtitle: "Double portrait / paired study", date: "2013", source: "MS201306-BipashaAashish0192.jpg", dimensions: "2048 × 1535", ratio: "four-three", obverse: "/manus-storage/bipasha-aashish-obverse_e9c89464.png", reverse: "/manus-storage/bipasha-aashish-inverse_4909685a.png", reverseMode: "palette-grid", reverseKind: "Palette plate", reverseDescription: "Eight calculated colour clusters form an audit plate from the immutable double-portrait source.", scriptHash: "7e6201345b5dc94f5e71ffeb94a209c628cf8be380ac39eadbf4a8dcb4cd7882", outputHash: "370ce50eeb41f8a4171ea7514ba2694aeed0c323be2e597001adc808f01542c9", palette: ["#EBBDDB", "#1C1B2D", "#C6B6AF", "#0E4BB8", "#EE7880", "#7F3041", "#99776F", "#7AA2ED"], credentialSignature: absentCredential("b1faf2ba275f8c33c3015705248c14f53ae64969c7f187a26addf78ff01acf68"), colourSignature: colourSignature("1310e62323b79f8dbb392b2d1097f2165fdcab6fbe8f334d72727dee0cd1327c", "3e0887e927ee7ca5bc2423caef9ea68c0d48380691579ce85988ad610de284c1"),
  },
  "uganda-diptych": {
    id: "uganda-diptych", title: "Uganda diptych", subtitle: "Artwork presentation / double portrait", date: "2015", source: "MS201508-Uganda0016.jpg", dimensions: "2048 × 1365", ratio: "three-two", obverse: "/manus-storage/uganda-diptych-obverse_56deb5ff.png", reverse: "/manus-storage/uganda-diptych-inverse_88aa414b.png", reverseMode: "palette-grid", reverseKind: "Palette plate", reverseDescription: "A monochrome palette plate carries the tonal evidence of the two paintings and their bearers.", scriptHash: "059969ec187f7c3dfa54ee46b68f02b9b70a751546dcdd9e539565ae3d8b17dc", outputHash: "1e66213b9c7d71aabe6ba81daf5322c34bde0c37cb069604484f5fbecee7d6b6", palette: ["#E4E4E4", "#070707", "#BEBEBE", "#8E8E8E", "#707070", "#515151", "#363636", "#1A1A1A"], credentialSignature: absentCredential("02ab6db06a282c4362d30f5afc7922ece8c72c50a595acaf2c1e0ce936fbee8a"), colourSignature: colourSignature("fb72924d45ec7b3832fc6c92f87b764cfcad460b11819d2fdf3a799c269858e9", "44034e1180b32729e124977c4787b968c511775a099aa831e0c356c9246ab928"),
  },
  "fidh-guinea": {
    id: "fidh-guinea", title: "FIDH Guinea", subtitle: "Human rights gathering / field record", date: "2018", source: "MS201804-FIDHGuinea0264.jpg", dimensions: "2048 × 1365", ratio: "three-two", obverse: "/manus-storage/fidh-guinea-obverse_a003255e.png", reverse: "/manus-storage/fidh-guinea-inverse_f9ffcd06.png", reverseMode: "palette-grid", reverseKind: "Palette plate", reverseDescription: "The inverse compresses the field record into its measured chromatic evidence.", scriptHash: "ce8c7b7a7764b3541a411c9bff29de70803a38ffd6a20b097b019c5f47ae7684", outputHash: "a9fa3c13fdfe4ada0d3260e1306df3b3996a9dd3bd5a4643e174838e9eaafa89", palette: ["#B4C8D2", "#EFDCC4", "#F6CD5F", "#D0B390", "#A5835C", "#272727", "#645440", "#CA2035"], credentialSignature: absentCredential("86e12a0501ed3f80910ec9c14db42afe83bcb7a15d07c0e371ec23a6a65c71aa"), colourSignature: colourSignature("2864f019fd20193236666eea6bcbc3009699a55b6fa01c28ca8c8cd5e13db1c2", "329db130d2e3ad446d26532ae7fd454dfa41b6a82e926a5cffaa48ab10513b54"),
  },
  "murgeshpalya-passage": {
    id: "murgeshpalya-passage", title: "Murgeshpalya passage", subtitle: "Street works / weekday passage", date: "2019", source: "MS201901-Murgeshpalya0018.jpg", dimensions: "2048 × 1536", ratio: "four-three", obverse: "/manus-storage/murgeshpalya-passage-obverse_a40340cd.png", reverse: "/manus-storage/murgeshpalya-passage-inverse_a204a2af.png", reverseMode: "palette-grid", reverseKind: "Palette plate", reverseDescription: "The inverse reduces a tangled street scene to eight hues without reproducing its spatial arrangement.", scriptHash: "aee10704574f562c32e87548250d375528dddddcd782954bc49ca623d8ea0458", outputHash: "6c5ce68c16197666fec7dfe0f923b3bdc04278455df6fd9d184c3b89103cc8b8", palette: ["#161617", "#393738", "#5C5858", "#7C7675", "#959395", "#B2B1AE", "#CAEBFC", "#C5CCD2"], credentialSignature: absentCredential("a5f88d9555f6b76272ca6975ed05f7b65bc7cf0fb9ce10afe1d512af85b977b5"), colourSignature: colourSignature("587bfb208c90ec9c19c1d20582a4da7a17a1d5e421778ae6bec2857bfdb1dac0", "2926615217bcc00932c889d164a3d7a1994fba5f35c9e3551f4bf94747feb3ac"),
  },
  "kashmir-study": {
    id: "kashmir-study", title: "Kashmir study", subtitle: "Valley field / image study", date: "2019", source: "MS201904-Kashmir0594.jpg", dimensions: "2048 × 1536", ratio: "four-three", obverse: "/manus-storage/kashmir-study-obverse_19071a22.png", reverse: "/manus-storage/kashmir-study-inverse_532f50b2.png", reverseMode: "palette-grid", reverseKind: "Palette plate", reverseDescription: "Eight calculated colours preserve a compact audit record of the valley field.", scriptHash: "9ad4197bebce667e2b719d29e7216aea6872663dd19fb8b3e8584389099c76ac", outputHash: "900e6447e7226bbeb4aaa744e693291da51bceb8d3e7960a33a2cfb7b8124005", palette: ["#D5E8F5", "#1D1C15", "#E6B05D", "#B1B8B0", "#8F632E", "#798D8B", "#F1DFCF", "#2B495C"], credentialSignature: absentCredential("e933b354d8a7909a3713a24fc354899b24063c3b5b8a490d06ac5f4d01c09a66"), colourSignature: colourSignature("70c6f9d92fbfff510370253286e8a806203688311bc748dddc0929e289853409", "ae2ac40a561b50f1c7cdd0df861ca916e11e6a33b20ce1d6ce76a24a84705892"),
  },
  "ghana-study": {
    id: "ghana-study", title: "Ghana study", subtitle: "Portraiture / image study", date: "2019", source: "MS201910-Ghana9243.jpg", dimensions: "1670 × 1252", ratio: "four-three", obverse: "/manus-storage/ghana-study-obverse_efa9dbfd.png", reverse: "/manus-storage/ghana-study-inverse_349a1b6a.png", reverseMode: "palette-grid", reverseKind: "Palette plate", reverseDescription: "The calculated plate records the low-key tonal structure of the source study.", scriptHash: "645eef39c96e705adebe6290689f1145852601ef8608073d7c969c775619e05c", outputHash: "0b0e974cb4854f81289e70de0541e5c7bb1d72e211230711650601d881dbdf56", palette: ["#2A363D", "#3D3E42", "#040907", "#16323B", "#021F25", "#161B10", "#2A2D21", "#6E5F5C"], credentialSignature: candidateCredential("858bee16e500c6ad4d048391e53ab57a6e5622f0affab5a83360176334ecaebf"), colourSignature: colourSignature("4268c626958ddafd4f53aa053dca52b662c280901879591ec5d4c48575302c6c", "dd73547031e71b89c455a43ad5a0f92a5ecc46a81e22d24449028290b7fa87b1"),
  },
  "nagaland-study": {
    id: "nagaland-study", title: "Nagaland study", subtitle: "Hill community / image study", date: "2019", source: "MS201912-Nagaland1300.jpg", dimensions: "2048 × 1536", ratio: "four-three", obverse: "/manus-storage/nagaland-study-obverse_e17beab3.png", reverse: "/manus-storage/nagaland-study-inverse_f5464e0d.png", reverseMode: "palette-grid", reverseKind: "Palette plate", reverseDescription: "Eight colour clusters make the image’s visible evidence legible as a companion plate.", scriptHash: "d10ffcb638fc7fc0f3dfbcefaebdca5ebeee8da73ff68f0bcf73b7318ac5e6b3", outputHash: "1fd4ea7bef28dd28210aa9ab4ac840b460c3ddd3530edeb2d309b455b37bd2ad", palette: ["#958D8D", "#737377", "#555D62", "#3E494F", "#273540", "#C0AFA4", "#0B2130", "#D39B3E"], credentialSignature: absentCredential("f605086bf5182a1c557c1117d2ef8e62b9f8847cab292405c17e94c803e64e4e"), colourSignature: colourSignature("42825d434b459b3a85dc337361d2af51a9edb90bab427bef156581d7d52dd615", "56f20d227be16d68d565759f9d2584810da0318352c2d762e37f9c1dbaa3631a"),
  },
  "hong-kong-study": {
    id: "hong-kong-study", title: "Hong Kong study", subtitle: "Harbour city / image study", date: "2023", source: "MS202309-HongKong0469-Enhanced-NR.jpg", dimensions: "2048 × 1536", ratio: "four-three", obverse: "/manus-storage/hong-kong-study-obverse_d3294b09.png", reverse: "/manus-storage/hong-kong-study-inverse_406ab2a7.png", reverseMode: "palette-grid", reverseKind: "Palette plate", reverseDescription: "The inverse preserves the harbour city’s calculated tonal and chromatic record.", scriptHash: "bc263d669c81012ee824c5ecb7b4bf895ee5acbbb1bb21c856cbe3a67e049f5f", outputHash: "167c4019fa25f9eae18759a776ab95bba0e0d7972827d5e910c11c179827e145", palette: ["#141112", "#3A3D3D", "#D8DBDC", "#726E67", "#A5A9AC", "#724231", "#E3A55D", "#40759B"], credentialSignature: absentCredential("3eb60783974709c44a0088bacccf23d8896aab160d0d51bcdb18f228a8ae395e"), colourSignature: colourSignature("66878815d53647840a7265a9815908c7b8264bf7ce915bca9c061c2cd505aa5e", "145b5947aa66c9f91a1dcbecda613e5ed9d77ed3259573cd02258516e1697bde"),
  },
  "ayodhya-mural": {
    id: "ayodhya-mural", title: "Ayodhya mural", subtitle: "Terminal concourse / visual field", date: "2024", source: "MS202401-Ayodhya0041.jpg", dimensions: "2048 × 1536", ratio: "four-three", obverse: "/manus-storage/ayodhya-mural-obverse_58dc78c4.png", reverse: "/manus-storage/ayodhya-mural-inverse_4c143c0b.png", reverseMode: "palette-grid", reverseKind: "Palette plate", reverseDescription: "Eight calculated colour clusters compress the mural, crowd, and concourse into a companion plate.", scriptHash: "895bbf85715786d0e30cf6861eb3e8e74b3b75a37f123fb24d05bc96011b36a6", outputHash: "64aedad386d543a1a77871112249073463c53e038e554365347b8640463699d5", palette: ["#4C4A40", "#CCB38D", "#D6D3D2", "#1E202A", "#726F5A", "#9A997A", "#C15942", "#167BB8"], credentialSignature: absentCredential("7b97c159e3eb5b021e18cf76d9b3efd3704bf4f1990f985a460524c3d98926c8"), colourSignature: colourSignature("78ee78cb60c8b774f1292a30b619645e3f38482f4e0440ff1732535a2421e852", "83c583bdaa06e1566972d0d25751a55b238c7816036784550596688c7c412cd2"),
  },
  "urban-fantasy": {
    id: "urban-fantasy", title: "Urban fantasy", subtitle: "Roadside repair / imagined skyline", date: "2024", source: "_DSF0739-Enhanced-NR.jpg", dimensions: "2048 × 1536", ratio: "four-three", obverse: "/manus-storage/urban-fantasy-obverse_d2c7e651.png", reverse: "/manus-storage/urban-fantasy-inverse_1f4692ec.png", reverseMode: "palette-grid", reverseKind: "Palette plate", reverseDescription: "The inverse resolves the image’s competing cyan, corrugated metal, and gold tones into calculated blocks.", scriptHash: "cbd76abcdea143e5bf32700e60b5b34c94a32a741bd31df3089c74119f45f738", outputHash: "06157b187295d6d12405276b0227523913c8e43c67df7edadb443bd8fcdcdc4b", palette: ["#0F94C7", "#594F34", "#C1D7DE", "#1C2419", "#939A99", "#5FB1DB", "#4E6E79", "#AC8536"], credentialSignature: absentCredential("5f975d0b13563d5bc54e3fd98c559644a21a0219191afb6ca8e2c3a9c6d8e3a1"), colourSignature: colourSignature("a5af195c48a5f8dbcd4da9cd87e5330b9e33a2b709ce6e4bcfdea3929f38d493", "eed0dcb55666e74c9a0dbec4160c5be5ad2f0143e07650b6bc47aca4ba03df8c"),
  },
};

/**
 * GALLERY ORDER CONTROL
 *
 * Reorder these ids to change Previous/Next, keyboard cycling, the filmstrip,
 * and serial labels. Delete an id from this list to hide that specimen without
 * deleting the immutable source or its generated derivatives.
 */
export const galleryOrder = [
  "bipasha-aashish",
  "uganda-diptych",
  "fidh-guinea",
  "murgeshpalya-passage",
  "kashmir-study",
  "ghana-study",
  "nagaland-study",
  "hong-kong-study",
  "ayodhya-mural",
  "urban-fantasy",
] as const;

export const gallery: readonly GalleryItem[] = galleryOrder.map((id, index) => {
  const item = catalogueById[id];
  if (!item) throw new Error(`Unknown gallery id in galleryOrder: ${id}`);
  return {
    ...item,
    serial: `${String(index + 1).padStart(2, "0")} / ${String(galleryOrder.length).padStart(2, "0")}`,
    script: sourceScript(item.id, item.source),
    trace: paletteTrace(item.source, item.dimensions),
  };
});
