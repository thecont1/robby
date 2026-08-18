import type { GalleryItem } from "@/lib/demoData";
import type { CompileSnapshot } from "@/lib/compileHistory";
import type { RuntimeRecord } from "@/components/Build06Panels";

const DATABASE_NAME = "robby-registrar-attestation";
const KEY_STORE = "key-pairs";
const KEY_ID = "browser-local-p256";

type BrowserKeyRecord = { id: string; privateKey: JsonWebKey; publicKey: JsonWebKey };

export type SignedRegistrarRecord = {
  schema: "robby-signed-registrar-record-v1";
  issuedAt: string;
  signer: {
    type: "browser-local-ecdsa-p256";
    scope: "Locally generated browser-profile attestation; not a third-party, institutional, or C2PA signature.";
    publicKeyJwk: JsonWebKey;
    publicKeyFingerprintSha256: string;
  };
  payload: Record<string, unknown>;
  payloadSha256: string;
  signatureBase64Url: string;
};

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>).sort(([left], [right]) => left.localeCompare(right)).map(([key, entry]) => [key, canonicalize(entry)]));
  }
  return value;
}

export function canonicalJson(value: unknown) {
  return JSON.stringify(canonicalize(value));
}

function base64Url(bytes: Uint8Array) {
  let binary = "";
  bytes.forEach(byte => { binary += String.fromCharCode(byte); });
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

function fromBase64Url(value: string) {
  const padded = value.replaceAll("-", "+").replaceAll("_", "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  const binary = atob(padded);
  return Uint8Array.from(binary, character => character.charCodeAt(0));
}

async function sha256(value: string) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest)).map(byte => byte.toString(16).padStart(2, "0")).join("");
}

function openKeyDatabase() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, 1);
    request.onerror = () => reject(request.error);
    request.onupgradeneeded = () => request.result.createObjectStore(KEY_STORE, { keyPath: "id" });
    request.onsuccess = () => resolve(request.result);
  });
}

async function loadOrCreateKeyPair() {
  const database = await openKeyDatabase();
  const existing = await new Promise<BrowserKeyRecord | undefined>((resolve, reject) => {
    const transaction = database.transaction(KEY_STORE, "readonly");
    const request = transaction.objectStore(KEY_STORE).get(KEY_ID);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result as BrowserKeyRecord | undefined);
  });

  if (existing) {
    database.close();
    return {
      privateKey: await crypto.subtle.importKey("jwk", existing.privateKey, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]),
      publicKey: existing.publicKey,
    };
  }

  const keyPair = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]);
  const privateKey = await crypto.subtle.exportKey("jwk", keyPair.privateKey);
  const publicKey = await crypto.subtle.exportKey("jwk", keyPair.publicKey);
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(KEY_STORE, "readwrite");
    transaction.objectStore(KEY_STORE).put({ id: KEY_ID, privateKey, publicKey } satisfies BrowserKeyRecord);
    transaction.onerror = () => reject(transaction.error);
    transaction.oncomplete = () => resolve();
  });
  database.close();
  return { privateKey: keyPair.privateKey, publicKey };
}

export async function createSignedRegistrarRecord({ item, runtime, history }: { item: GalleryItem; runtime: RuntimeRecord | null; history: readonly CompileSnapshot[] }) {
  const issuedAt = new Date().toISOString();
  const payload = {
    artifact: {
      specimenId: item.id,
      serial: item.serial,
      title: item.title,
      sourceImage: item.source,
      dimensions: item.dimensions,
      credentialSignature: item.credentialSignature,
      colourSignature: item.colourSignature,
      reverse: { mode: item.reverseMode, kind: item.reverseKind, description: item.reverseDescription },
    },
    manifest: {
      scriptHashSha256: item.scriptHash,
      outputHashSha256: item.outputHash,
      irVersion: "robby-ir-v1",
      runtime: runtime ? { toolchain: runtime.toolchain, compiledAt: runtime.compiledAt, irHashSha256: runtime.irHash } : null,
    },
    compilationHistory: history.map(snapshot => ({ id: snapshot.id, origin: snapshot.origin, compiledAt: snapshot.compiledAt, irHashSha256: snapshot.irHash, source: snapshot.source, ir: snapshot.ir })),
  };
  const canonicalPayload = canonicalJson(payload);
  const payloadSha256 = await sha256(canonicalPayload);
  const { privateKey, publicKey } = await loadOrCreateKeyPair();
  const signature = await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, privateKey, new TextEncoder().encode(canonicalPayload));
  return {
    schema: "robby-signed-registrar-record-v1" as const,
    issuedAt,
    signer: {
      type: "browser-local-ecdsa-p256" as const,
      scope: "Locally generated browser-profile attestation; not a third-party, institutional, or C2PA signature." as const,
      publicKeyJwk: publicKey,
      publicKeyFingerprintSha256: await sha256(canonicalJson(publicKey)),
    },
    payload,
    payloadSha256,
    signatureBase64Url: base64Url(new Uint8Array(signature)),
  } satisfies SignedRegistrarRecord;
}

export async function verifySignedRegistrarRecord(record: SignedRegistrarRecord) {
  if (await sha256(canonicalJson(record.payload)) !== record.payloadSha256) return false;
  const publicKey = await crypto.subtle.importKey("jwk", record.signer.publicKeyJwk, { name: "ECDSA", namedCurve: "P-256" }, false, ["verify"]);
  return crypto.subtle.verify({ name: "ECDSA", hash: "SHA-256" }, publicKey, fromBase64Url(record.signatureBase64Url), new TextEncoder().encode(canonicalJson(record.payload)));
}

function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

export function downloadSignedRegistrarJson(record: SignedRegistrarRecord, filenameBase: string) {
  download(new Blob([JSON.stringify(record, null, 2)], { type: "application/json" }), `${filenameBase}.json`);
}

export async function downloadSignedRegistrarPdf(record: SignedRegistrarRecord, filenameBase: string) {
  const { PDFDocument, StandardFonts, rgb } = await import("pdf-lib");
  const document = await PDFDocument.create();
  const page = document.addPage([612, 792]);
  const mono = await document.embedFont(StandardFonts.Courier);
  const serif = await document.embedFont(StandardFonts.TimesRoman);
  const lines = [
    "ROBBY / SIGNED REGISTRAR RECORD",
    "",
    `ISSUED: ${record.issuedAt}`,
    `SPECIMEN: ${String(record.payload.artifact && (record.payload.artifact as Record<string, unknown>).specimenId)}`,
    `SOURCE: ${String(record.payload.artifact && (record.payload.artifact as Record<string, unknown>).sourceImage)}`,
    `SCRIPT SHA-256: ${String(record.payload.manifest && (record.payload.manifest as Record<string, unknown>).scriptHashSha256)}`,
    `OUTPUT SHA-256: ${String(record.payload.manifest && (record.payload.manifest as Record<string, unknown>).outputHashSha256)}`,
    `PAYLOAD SHA-256: ${record.payloadSha256}`,
    `PUBLIC KEY FP: ${record.signer.publicKeyFingerprintSha256}`,
    `ECDSA SIGNATURE: ${record.signatureBase64Url}`,
    "",
    "ATTESTATION SCOPE",
    "Locally generated browser-profile attestation. It is verifiable with the",
    "embedded public JWK in the corresponding JSON export, but is not a",
    "third-party, institutional, or C2PA signature.",
  ];
  page.drawText(lines[0], { x: 48, y: 736, size: 17, font: serif, color: rgb(0.89, 0.27, 0.18) });
  let y = 700;
  lines.slice(2).forEach(line => {
    const chunks = line.match(/.{1,78}(?:\s|$)/g) ?? [line];
    chunks.forEach(chunk => { page.drawText(chunk.trimEnd(), { x: 48, y, size: 8.6, font: mono, color: rgb(0.12, 0.1, 0.1) }); y -= 14; });
  });
  const pdfBuffer = new Uint8Array(await document.save()).buffer as ArrayBuffer;
  download(new Blob([pdfBuffer], { type: "application/pdf" }), `${filenameBase}.pdf`);
}
