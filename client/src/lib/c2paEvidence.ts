import type { CredentialSignature } from "./demoData";

export type C2paPresence = "absent" | "present" | "candidate";
export type C2paValidation = "valid" | "invalid" | "not_reported" | "unavailable";
export type C2paSignerTrust = "trusted" | "untrusted" | "not_assessed" | "unavailable";

export type C2paEvidence = {
  presence: C2paPresence;
  validation: C2paValidation;
  signerTrust: C2paSignerTrust;
  availability: "inspected" | "not_inspected" | "unavailable";
  warnings: string[];
  inspectedAt: string;
  sourceSha256: string;
  verificationMethod: string;
  note: string;
  claimGenerator?: string;
};

export function c2paEvidenceFromCredential(credential: CredentialSignature, inspectedAt: string): C2paEvidence {
  const status = credential.status;
  const note = credential.note ?? "";
  const untrusted = /untrusted/i.test(note);
  const presence: C2paPresence = status === "present" || status === "candidate" ? status : "absent";
  const validation: C2paValidation =
    presence === "absent"
      ? "unavailable"
      : /invalid/i.test(note) || status === "candidate"
        ? "invalid"
        : /valid/i.test(note)
          ? "valid"
          : "not_reported";
  const signerTrust: C2paSignerTrust =
    presence === "absent" ? "unavailable" : untrusted ? "untrusted" : "not_assessed";

  return {
    presence,
    validation,
    signerTrust,
    availability: status === "checking"
      ? "not_inspected"
      : /could not inspect/i.test(note)
        ? "unavailable"
        : "inspected",
    warnings: untrusted ? ["signing credential untrusted"] : [],
    inspectedAt,
    sourceSha256: credential.sourceSha256,
    verificationMethod: credential.verificationMethod,
    note,
    claimGenerator: credential.claimGenerator,
  };
}

export function c2paEvidenceLabel(evidence: C2paEvidence): string {
  if (evidence.availability === "not_inspected") return "C2PA NOT INSPECTED";
  const presence = evidence.presence.toUpperCase();
  const validation = evidence.validation.replace("_", " ").toUpperCase();
  const trust =
    evidence.signerTrust === "untrusted"
      ? "UNTRUSTED SIGNER"
      : evidence.signerTrust === "trusted"
        ? "TRUSTED SIGNER"
        : "SIGNER NOT ASSESSED";
  return `C2PA ${presence} · ${validation} · ${trust}`;
}
