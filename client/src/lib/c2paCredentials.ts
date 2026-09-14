import type { CredentialSignature } from "./demoData";

/**
 * Requests C2PA inspection of the exact source-byte snapshot used for intake.
 * The server verifies `sourceSha256` against `bytes`; rejected snapshots and
 * other non-success responses are surfaced as errors, and `signal` can abort
 * the request.
 */
export async function inspectC2paCredential(
  source: string,
  bytes: Uint8Array,
  sourceSha256: string,
  signal?: AbortSignal,
): Promise<CredentialSignature> {
  const response = await fetch(`/api/c2pa/${encodeURIComponent(source)}`, {
    method: "POST",
    headers: {
      "Content-Type": "image/jpeg",
      "X-Robby-Source-SHA256": sourceSha256,
    },
    body: bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer,
    cache: "no-store",
    ...(signal ? { signal } : {}),
  });
  const payload = await response.json() as CredentialSignature & { error?: string };
  if (!response.ok) throw new Error(payload.error ?? "Unable to inspect C2PA credentials");
  return payload;
}
