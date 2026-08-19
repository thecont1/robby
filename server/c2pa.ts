import crypto from "node:crypto";
import express, { type Express } from "express";
import { Reader } from "@contentauth/c2pa-node";
import { getLiveRenderSource } from "./liveRenderCatalog";
import { storageGetSignedUrl } from "./storage";

const CACHE_TTL_MS = 5 * 60 * 1000;

export type C2paCredentialInspection = {
  status: "absent" | "candidate" | "present";
  sourceSha256: string;
  verificationMethod: string;
  note: string;
  claimGenerator?: string;
};

type ValidationNotice = { code?: string | null; explanation?: string | null };

export type C2paReaderSummary = {
  embedded: boolean;
  active?: { claim_generator?: string | null };
  validationState?: "Invalid" | "Valid" | "Trusted" | null;
  validationStatus?: ValidationNotice[] | null;
};

const cache = new Map<string, { expiresAt: number; result: C2paCredentialInspection }>();
const verificationMethod = "Official CAI C2PA Node SDK validation of exact managed JPEG bytes";

function noticeText(notices: ValidationNotice[] | null | undefined) {
  return (notices ?? [])
    .map(notice => [notice.code, notice.explanation].filter(Boolean).join(": "))
    .filter(Boolean)
    .join("; ");
}

export function credentialFromReaderSummary(
  sourceSha256: string,
  summary: C2paReaderSummary,
): C2paCredentialInspection {
  if (!summary.embedded || !summary.active) {
    return {
      status: "absent",
      sourceSha256,
      verificationMethod,
      note: "The official C2PA reader examined the exact managed JPEG bytes and found no embedded or resolvable active C2PA manifest.",
    };
  }

  const notices = noticeText(summary.validationStatus);
  const suffix = notices ? ` Validation notices: ${notices}.` : "";
  if (summary.validationState === "Invalid") {
    return {
      status: "candidate",
      sourceSha256,
      verificationMethod,
      note: `An embedded C2PA manifest was found, but its validation state is Invalid.${suffix}`,
      claimGenerator: summary.active.claim_generator ?? undefined,
    };
  }

  return {
    status: "present",
    sourceSha256,
    verificationMethod,
    note: `An embedded C2PA manifest was parsed from the exact managed JPEG bytes. Validation state: ${summary.validationState ?? "not reported"}.${suffix}`,
    claimGenerator: summary.active.claim_generator ?? undefined,
  };
}

export async function inspectGalleryCredential(sourceName: string): Promise<C2paCredentialInspection> {
  const source = getLiveRenderSource(sourceName);
  if (!source) throw new Error(`Unknown immutable gallery source: ${sourceName}`);

  const cached = cache.get(sourceName);
  if (cached && cached.expiresAt > Date.now()) return cached.result;

  const signedUrl = await storageGetSignedUrl(source.storageKey);
  const response = await fetch(signedUrl);
  if (!response.ok) throw new Error(`Unable to retrieve immutable source (${response.status})`);

  const bytes = Buffer.from(await response.arrayBuffer());
  const actualSha256 = crypto.createHash("sha256").update(bytes).digest("hex");
  if (actualSha256 !== source.sha256) {
    throw new Error("Immutable source checksum mismatch during C2PA inspection");
  }

  const reader = await Reader.fromAsset({ buffer: bytes, mimeType: "image/jpeg" });
  const manifestStore = reader?.json();
  const result = credentialFromReaderSummary(source.sha256, {
    embedded: Boolean(reader?.isEmbedded()),
    active: reader?.getActive(),
    validationState: manifestStore?.validation_state,
    validationStatus: manifestStore?.validation_status,
  });
  cache.set(sourceName, { expiresAt: Date.now() + CACHE_TTL_MS, result });
  return result;
}

export function createC2paInspectionHandler() {
  return async (req: express.Request, res: express.Response) => {
    const source = req.params.source;
    if (!source || !getLiveRenderSource(source)) {
      res.status(404).json({ error: "Unknown immutable gallery source" });
      return;
    }

    try {
      res.json(await inspectGalleryCredential(source));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to inspect C2PA credentials";
      res.status(500).json({ error: message });
    }
  };
}

export function registerC2paRoutes(app: Express) {
  app.get("/api/c2pa/:source", createC2paInspectionHandler());
}
