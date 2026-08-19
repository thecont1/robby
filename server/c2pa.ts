import crypto from "node:crypto";
import express, { type Express } from "express";
import { Reader } from "@contentauth/c2pa-node";
import { existsSync, readFileSync, statSync } from "node:fs";
import { basename, join, resolve } from "node:path";

const GALLERY_DIR = resolve(process.cwd(), "gallery");

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

const cache = new Map<string, { expiresAt: number; mtimeMs: number; size: number; result: C2paCredentialInspection }>();
const verificationMethod = "Official CAI C2PA Node SDK validation of exact local JPEG bytes";

/** Validate that sourceName is a single flat JPEG filename — no path separators, no traversal, no non-JPEG names. */
function validateSourceName(sourceName: string): string {
  if (!sourceName || sourceName.includes("/") || sourceName.includes("\\") || sourceName.includes("..")) {
    throw new Error("Invalid source filename");
  }
  const name = basename(sourceName);
  if (!/\.(jpg|jpeg)$/i.test(name)) {
    throw new Error("Source must be a JPEG filename");
  }
  return name;
}

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
      note: "The official C2PA reader examined the exact local JPEG bytes and found no embedded or resolvable active C2PA manifest.",
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
    note: `An embedded C2PA manifest was parsed from the exact local JPEG bytes. Validation state: ${summary.validationState ?? "not reported"}.${suffix}`,
    claimGenerator: summary.active.claim_generator ?? undefined,
  };
}

export async function inspectGalleryCredential(sourceName: string): Promise<C2paCredentialInspection> {
  const safeName = validateSourceName(sourceName);
  const filePath = join(GALLERY_DIR, safeName);
  if (!existsSync(filePath)) throw new Error(`Gallery file not found: ${safeName}`);

  const stat = statSync(filePath);
  const cached = cache.get(safeName);
  if (cached && cached.expiresAt > Date.now() && cached.mtimeMs === stat.mtimeMs && cached.size === stat.size) {
    return cached.result;
  }

  const bytes = readFileSync(filePath);
  const sourceSha256 = crypto.createHash("sha256").update(bytes).digest("hex");

  const reader = await Reader.fromAsset({ buffer: bytes, mimeType: "image/jpeg" });
  const manifestStore = reader?.json();
  const result = credentialFromReaderSummary(sourceSha256, {
    embedded: Boolean(reader?.isEmbedded()),
    active: reader?.getActive(),
    validationState: manifestStore?.validation_state,
    validationStatus: manifestStore?.validation_status,
  });
  cache.set(safeName, { expiresAt: Date.now() + CACHE_TTL_MS, mtimeMs: stat.mtimeMs, size: stat.size, result });
  return result;
}

export function createC2paInspectionHandler() {
  return async (req: express.Request, res: express.Response) => {
    const source = req.params.source;
    if (!source) {
      res.status(400).json({ error: "Missing source filename" });
      return;
    }

    let safeName: string;
    try {
      safeName = validateSourceName(source);
    } catch {
      res.status(400).json({ error: "Invalid source filename" });
      return;
    }

    const filePath = join(GALLERY_DIR, safeName);
    if (!existsSync(filePath)) {
      res.status(404).json({ error: "Gallery file not found" });
      return;
    }

    try {
      res.json(await inspectGalleryCredential(safeName));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to inspect C2PA credentials";
      res.status(500).json({ error: message });
    }
  };
}

export function registerC2paRoutes(app: Express) {
  app.get("/api/c2pa/:source", createC2paInspectionHandler());
}
