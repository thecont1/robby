import "fake-indexeddb/auto";
import { webcrypto } from "node:crypto";
import { describe, expect, it } from "vitest";
import { gallery } from "./demoData";
import { canonicalJson, createSignedRegistrarRecord, verifySignedRegistrarRecord } from "./registrarExport";

Object.defineProperty(globalThis, "crypto", { value: webcrypto, configurable: true });

describe("registrar export", () => {
  it("canonicalizes object keys before signing", () => {
    expect(canonicalJson({ z: 1, nested: { b: 2, a: 1 }, a: 0 })).toBe('{"a":0,"nested":{"a":1,"b":2},"z":1}');
  });

  it("creates a record that verifies against its embedded local public key", async () => {
    const record = await createSignedRegistrarRecord({ item: gallery[0], runtime: null, history: [] });
    expect(record.signer.type).toBe("browser-local-ecdsa-p256");
    expect(record.signer.scope).toContain("not a third-party");
    await expect(verifySignedRegistrarRecord(record)).resolves.toBe(true);
  });
});
