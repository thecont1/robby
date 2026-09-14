import express, { type Express, type NextFunction, type Request, type Response } from "express";
import { createHash } from "node:crypto";
import { Reader } from "@contentauth/c2pa-node";
import { basename } from "node:path";
import { readLocalGallerySource } from "./gallerySource";

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

export function unavailableCredentialInspection(sourceSha256: string, error: unknown): C2paCredentialInspection {
  const message = error instanceof Error ? error.message : String(error);
  return {
    status: "absent",
    sourceSha256,
    verificationMethod,
    note: `The official C2PA reader could not inspect this JPEG. Compilation continues without C2PA evidence. ${message}`,
  };
}

/**
 * Inspects supplied JPEG bytes with the C2PA reader. Reader failures are
 * returned as unavailable inspection records rather than rejected promises.
 */
async function inspectCredentialBytes(
  bytes: Buffer,
  sourceSha256: string,
): Promise<C2paCredentialInspection> {
  try {
    const reader = await Reader.fromAsset({ buffer: bytes, mimeType: "image/jpeg" });
    const manifestStore = reader?.json();
    return credentialFromReaderSummary(sourceSha256, {
      embedded: Boolean(reader?.isEmbedded()),
      active: reader?.getActive(),
      validationState: manifestStore?.validation_state,
      validationStatus: manifestStore?.validation_status,
    });
  } catch (error) {
    return unavailableCredentialInspection(sourceSha256, error);
  }
}

/**
 * Inspects a JPEG from the configured gallery and caches the result by path and
 * content digest for five minutes. Invalid names and gallery access failures
 * reject the request.
 */
export async function inspectGalleryCredential(sourceName: string): Promise<C2paCredentialInspection> {
  const safeName = validateSourceName(sourceName);
  const source = await readLocalGallerySource(safeName);
  const cacheKey = `${source.path}:${source.sha256}`;
  const cached = cache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.result;
  }

  const result = await inspectCredentialBytes(source.bytes, source.sha256);
  cache.set(cacheKey, { expiresAt: Date.now() + CACHE_TTL_MS, result });
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

    try {
      res.json(await inspectGalleryCredential(safeName));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to inspect C2PA credentials";
      if (message.includes("not found")) {
        res.status(404).json({ error: message });
        return;
      }
      if (message.includes("symlink") || message.includes("escapes") || message.includes("Invalid")) {
        res.status(400).json({ error: message });
        return;
      }
      res.json(unavailableCredentialInspection("", error));
    }
  };
}

/**
 * Creates a handler that verifies posted JPEG bytes against the intake SHA-256
 * before C2PA inspection. Invalid filenames, bodies, or digests receive a 400;
 * successful inspection responses disable HTTP caching.
 */
export function createC2paByteInspectionHandler() {
  return async (req: express.Request, res: express.Response) => {
    try {
      validateSourceName(req.params.source ?? "");
      if (!Buffer.isBuffer(req.body) || req.body.length === 0) {
        res.status(400).json({ error: "Missing JPEG source bytes" });
        return;
      }
      const expectedSha256 = req.get("X-Robby-Source-SHA256") ?? "";
      if (!/^[0-9a-f]{64}$/i.test(expectedSha256)) {
        res.status(400).json({ error: "Missing or invalid source SHA-256" });
        return;
      }
      const actualSha256 = createHash("sha256").update(req.body).digest("hex");
      if (actualSha256.toLowerCase() !== expectedSha256.toLowerCase()) {
        res.status(400).json({ error: "C2PA source bytes do not match the intake SHA-256" });
        return;
      }
      res.setHeader("Cache-Control", "no-store, max-age=0");
      res.json(await inspectCredentialBytes(req.body, actualSha256));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to inspect C2PA credentials";
      res.status(400).json({ error: message });
    }
  };
}

type C2paGuardOptions = {
  maxConcurrent?: number;
  maxPerWindow?: number;
  windowMs?: number;
  now?: () => number;
};

export function createC2paInspectionGuard({
  maxConcurrent = 2,
  maxPerWindow = 12,
  windowMs = 60_000,
  now = Date.now,
}: C2paGuardOptions = {}) {
  let active = 0;
  const clients = new Map<string, { windowStartedAt: number; count: number }>();
  let nextCleanupAt = 0;

  return (req: Request, res: Response, next: NextFunction) => {
    const time = now();
    if (time >= nextCleanupAt) {
      clients.forEach((rate, key) => {
        if (time - rate.windowStartedAt >= windowMs) clients.delete(key);
      });
      nextCleanupAt = time + windowMs;
    }
    const client = req.ip || req.socket.remoteAddress || "unknown";
    let rate = clients.get(client);
    if (!rate || time - rate.windowStartedAt >= windowMs) {
      rate = { windowStartedAt: time, count: 0 };
      clients.set(client, rate);
    }
    rate.count += 1;
    if (rate.count > maxPerWindow) {
      const retryAfter = Math.max(1, Math.ceil((rate.windowStartedAt + windowMs - time) / 1000));
      res.setHeader("Retry-After", String(retryAfter));
      res.status(429).json({ error: "Too many C2PA inspection requests" });
      return;
    }
    if (active >= maxConcurrent) {
      res.setHeader("Retry-After", "1");
      res.status(503).json({ error: "C2PA inspection capacity is busy" });
      return;
    }

    active += 1;
    let released = false;
    const release = () => {
      if (released) return;
      released = true;
      active = Math.max(0, active - 1);
    };
    res.once("finish", release);
    res.once("close", release);
    next();
  };
}

/** Registers gallery-name GET inspection and byte-snapshot POST inspection. */
export function registerC2paRoutes(app: Express) {
  const inspectionGuard = createC2paInspectionGuard();
  app.get("/api/c2pa/:source", createC2paInspectionHandler());
  app.post(
    "/api/c2pa/:source",
    inspectionGuard,
    express.raw({ type: "image/jpeg", limit: "8mb" }),
    createC2paByteInspectionHandler(),
  );
}
