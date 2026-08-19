import crypto from "node:crypto";
import { lstat, readFile, realpath, stat } from "node:fs/promises";
import { basename, resolve } from "node:path";

export function galleryDirectory() {
  return resolve(process.env.ROBBY_GALLERY_DIR ?? resolve(process.cwd(), "gallery"));
}

export type LocalGallerySource = {
  filename: string;
  path: string;
  bytes: Buffer;
  sha256: string;
};

export function validateGalleryFilename(filename: string): string {
  if (
    !filename ||
    filename !== basename(filename) ||
    !/^[A-Za-z0-9_][A-Za-z0-9._ -]*\.jpe?g$/i.test(filename)
  ) {
    throw new Error("Gallery source must be a JPEG basename without path characters");
  }
  return filename;
}

export async function readLocalGallerySource(
  filename: string,
  galleryDir = galleryDirectory(),
): Promise<LocalGallerySource> {
  const safeFilename = validateGalleryFilename(filename);
  const root = resolve(galleryDir);
  const filePath = resolve(root, safeFilename);

  if (!filePath.startsWith(`${root}/`)) {
    throw new Error("Gallery source escapes the watched gallery directory");
  }

  let fileStat;
  try {
    const linkStat = await lstat(filePath);
    if (linkStat.isSymbolicLink()) {
      throw new Error(`Gallery source cannot be a symlink: ${safeFilename}`);
    }
    const [realRoot, realFile] = await Promise.all([realpath(root), realpath(filePath)]);
    if (!realFile.startsWith(`${realRoot}/`)) {
      throw new Error("Gallery source escapes the watched gallery directory");
    }
    fileStat = await stat(filePath);
  } catch (error) {
    if (error instanceof Error && (error.message.includes("symlink") || error.message.includes("escapes"))) {
      throw error;
    }
    throw new Error(`Gallery source not found: ${safeFilename}`);
  }
  if (!fileStat.isFile()) {
    throw new Error(`Gallery source is not a regular file: ${safeFilename}`);
  }

  const bytes = await readFile(filePath);
  return {
    filename: safeFilename,
    path: filePath,
    bytes,
    sha256: crypto.createHash("sha256").update(bytes).digest("hex"),
  };
}
