import { readFileSync } from "node:fs";
import { isAbsolute, resolve } from "node:path";
import { describe, expect, it } from "vitest";

type TemplateEnvelope = {
  files: Record<string, string>;
};

type EmbeddedPackage = {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  pnpm?: { patchedDependencies?: Record<string, string> };
};

const repositoryRoot = resolve(import.meta.dirname, "..");
const template = JSON.parse(
  readFileSync(resolve(repositoryRoot, "template.json"), "utf8")
) as TemplateEnvelope;
const embeddedPackage = JSON.parse(
  template.files["package.json"]
) as EmbeddedPackage;

describe("generated template dependency contract", () => {
  it("embeds every local file required by the generated package", () => {
    for (const [patchedPackage, patchPath] of Object.entries(
      embeddedPackage.pnpm?.patchedDependencies ?? {}
    )) {
      const separator = patchedPackage.lastIndexOf("@");
      const packageName = patchedPackage.slice(0, separator);
      const packageVersion = patchedPackage.slice(separator + 1);
      const declaredVersion =
        embeddedPackage.dependencies?.[packageName] ??
        embeddedPackage.devDependencies?.[packageName];

      expect(declaredVersion).toBe(packageVersion);
      expect(isAbsolute(patchPath)).toBe(false);
      expect(patchPath.split("/")).not.toContain("..");
      expect(template.files[patchPath]).toBe(
        readFileSync(resolve(repositoryRoot, patchPath), "utf8")
      );
    }
  });
});
