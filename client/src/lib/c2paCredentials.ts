import type { CredentialSignature } from "./demoData";

export async function inspectC2paCredential(source: string): Promise<CredentialSignature> {
  const response = await fetch(`/api/c2pa/${encodeURIComponent(source)}`);
  const payload = await response.json() as CredentialSignature & { error?: string };
  if (!response.ok) throw new Error(payload.error ?? "Unable to inspect C2PA credentials");
  return payload;
}
