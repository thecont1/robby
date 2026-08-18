import crypto from "crypto";
import express, { type Express, type Request } from "express";
import * as db from "./db";
import { sdk } from "./_core/sdk";
import { storagePutExact } from "./storage";

const MAX_ORIGINAL_BYTES = 25 * 1024 * 1024;
const JPEG_CONTENT_TYPE = "image/jpeg";

export function parseOriginalFilename(raw: string | undefined): string {
  if (!raw) throw new Error("Missing original filename");

  let filename: string;
  try {
    filename = decodeURIComponent(raw);
  } catch {
    throw new Error("Original filename is not URI encoded correctly");
  }

  const isBareFilename = filename === filename.split(/[\\/]/).pop();
  if (!isBareFilename || !/^[A-Za-z0-9_][A-Za-z0-9._ -]*\.jpe?g$/i.test(filename)) {
    throw new Error("Original filename must be a JPEG basename without path characters");
  }
  return filename;
}

export function parseOriginalContentType(raw: string | undefined): string {
  const contentType = raw?.split(";", 1)[0]?.trim().toLowerCase();
  if (contentType !== JPEG_CONTENT_TYPE) {
    throw new Error("Only image/jpeg originals are accepted by the v1 immutable intake");
  }
  return contentType;
}

export function immutableStorageKey(sha256: string, filename: string) {
  return `originals/${sha256}/${filename}`;
}

export function registerOriginalRoutes(app: Express) {
  app.post(
    "/api/originals",
    express.raw({ type: () => true, limit: MAX_ORIGINAL_BYTES }),
    async (req, res) => {
      try {
        const user = await sdk.authenticateRequest(req);
        const filename = parseOriginalFilename(req.header("x-robby-original-filename"));
        const contentType = parseOriginalContentType(req.header("content-type"));
        if (!Buffer.isBuffer(req.body) || req.body.length === 0) {
          res.status(400).json({ error: "An original JPEG byte stream is required" });
          return;
        }

        const sha256 = crypto.createHash("sha256").update(req.body).digest("hex");
        const existing = await db.getOriginalAssetBySha256(sha256);
        if (existing) {
          res.status(200).json({ duplicate: true });
          return;
        }

        // The filename stays intact. The content hash scopes it without exposing any mutable overwrite path.
        const storageKey = immutableStorageKey(sha256, filename);
        const stored = await storagePutExact(storageKey, req.body, contentType);
        const asset = await db.createOriginalAsset({
          ownerId: user.id,
          storageKey: stored.key,
          originalFilename: filename,
          contentType,
          byteLength: req.body.length,
          sha256,
          credentialState: "unverified",
          credentialNote: "Raw bytes stored unchanged. C2PA verification must be recorded by the compiler provenance audit.",
        });

        res.status(201).json({ asset, duplicate: false });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unable to store original";
        const status = message.includes("Invalid session") || message.includes("session cookie") ? 401 : 400;
        res.status(status).json({ error: message });
      }
    },
  );
}
