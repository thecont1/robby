import React, { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeAll, describe, expect, it } from "vitest";
import { CredentialEvidence } from "@/components/Build06Panels";
import { gallery, galleryOrder, type CredentialSignature } from "./demoData";

beforeAll(() => {
  Object.assign(globalThis, { React });
});

describe("authentic-source gallery records", () => {
  const authenticIds = galleryOrder;

  it("binds each refreshed specimen to a JPEG original with a measured source hash", () => {
    for (const id of authenticIds) {
      const specimen = gallery.find(item => item.id === id);
      expect(specimen).toBeDefined();
      expect(specimen?.source).toMatch(/\.jpe?g$/i);
      expect(specimen?.script).not.toContain(".webp");
      expect(["absent", "candidate", "present", "checking"]).toContain(specimen?.credentialSignature.status);
      expect(specimen?.credentialSignature.sourceSha256).toMatch(/^[0-9a-f]{64}$/);
      expect(specimen?.credentialSignature.verificationMethod).not.toMatch(/marker scan/i);
    }
  });

  it("starts C2PA evidence in an explicit checking state until the official validator reads each exact managed source", () => {
    expect(gallery.every(item => item.credentialSignature.status === "checking")).toBe(true);
  });

  it("keeps only the immutable JPEG obverse in the catalogue; inverses are generated on demand", () => {
    for (const id of authenticIds) {
      const specimen = gallery.find(item => item.id === id);
      expect(specimen?.obverse).toBe(`/gallery/${specimen?.source}`);
      expect(specimen?.reverse).toBe("");
    }
  });

  it("derives sequence and serial labels solely from the exported gallery order", () => {
    expect(gallery.map(item => item.id)).toEqual(galleryOrder);
    const total = galleryOrder.length;
    const expectedSerials = galleryOrder.map((_, i) => `${String(i + 1).padStart(2, "0")} / ${String(total).padStart(2, "0")}`);
    expect(gallery.map(item => item.serial)).toEqual(expectedSerials);
  });
});

const credential = (over: Partial<CredentialSignature> = {}): CredentialSignature => ({
  status: "absent",
  sourceSha256: "a".repeat(64),
  verificationMethod: "Official CAI C2PA Node SDK validation of exact local JPEG bytes",
  note: "The official C2PA reader found no embedded or resolvable active C2PA manifest.",
  ...over,
});

const renderCredential = (over: Partial<CredentialSignature> = {}) =>
  renderToStaticMarkup(createElement(CredentialEvidence, { credential: credential(over) }));

describe("credential evidence in object provenance", () => {
  it("renders visible status, verification, and validation-note rows", () => {
    const html = renderCredential();
    expect(html).toContain("CREDENTIAL STATUS");
    expect(html).toContain("C2PA ABSENT");
    expect(html).toContain("VERIFICATION");
    expect(html).toContain(credential().verificationMethod);
    expect(html).toContain("VALIDATION NOTE");
    expect(html).toContain(credential().note);
  });

  it("labels every known status distinctly without trusting a candidate", () => {
    expect(renderCredential({ status: "present" })).toContain("C2PA PRESENT");
    expect(renderCredential({ status: "candidate", note: "validation state is Invalid" })).toContain("C2PA CANDIDATE");
    expect(renderCredential({ status: "checking" })).toContain("C2PA CHECKING");
    expect(renderCredential({ status: "absent" })).toContain("C2PA ABSENT");
  });

  it("shows the Content Credentials badge only when a manifest exists", () => {
    expect(renderCredential({ status: "present" })).toContain('alt="Content Credentials"');
    expect(renderCredential({ status: "candidate" })).toContain('alt="Content Credentials"');
    expect(renderCredential({ status: "checking" })).not.toContain('alt="Content Credentials"');
    expect(renderCredential({ status: "absent" })).not.toContain('alt="Content Credentials"');
  });

  it("renders an unknown future status safely without a trusted badge", () => {
    const html = renderCredential({ status: "revoked" as CredentialSignature["status"] });
    expect(html).toContain("C2PA REVOKED");
    expect(html).not.toContain('alt="Content Credentials"');
  });

  it("uses readable fallbacks for empty verification details", () => {
    const html = renderCredential({ verificationMethod: "", note: "" });
    expect(html).toContain("Not reported");
    expect(html).toContain("No additional validation detail was returned.");
  });

  it("marks async credential updates as a polite live region", () => {
    expect(renderCredential()).toContain('aria-live="polite"');
  });
});
