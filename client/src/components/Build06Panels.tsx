import { CheckCircle2, ClipboardList, FileDiff, Fingerprint, GraduationCap, History, ShieldCheck, TriangleAlert } from "lucide-react";
import { useState } from "react";
import type { CredentialSignature, GalleryItem, TraceStep } from "@/lib/demoData";
import type { CompileSnapshot } from "@/lib/compileHistory";

export type ProvenanceTab = "provenance" | "runtime" | "reverse";
export type TraceMode = "diff" | "evidence" | "pedagogic" | "failure";

export type RuntimeRecord = Pick<CompileSnapshot, "compiledAt" | "irHash"> & {
  toolchain: string;
  transientReverse?: {
    generatedAt: string;
    outputSha256: string;
    sourceSha256: string;
    mode: string;
    seed: string;
    settingsSha256: string;
    swatches: string[];
  };
};

export function pedagogicDetail(step: TraceStep) {
  if (step.code.startsWith("base(")) return "Reads the exact source bytes and decodes their RGB matrix without classifying image content.";
  if (step.code.startsWith("palette(")) return "This groups RGB values into a deterministic, ordered set of colour clusters.";
  if (step.code.startsWith("reverse(")) return "Runs the selected mathematical module from a seed derived from source bytes and settings.";
  return "Returns the transient PNG and its reproducibility manifest without storing a reverse artifact.";
}

export function traceDiff(prior: readonly TraceStep[] | undefined, current: readonly TraceStep[]) {
  if (!prior) return { kind: "none" as const, rows: [] as Array<{ state: "added" | "removed" | "changed"; step: TraceStep }> };
  const key = (step: TraceStep) => `${step.stage}|${step.label}|${step.code}|${step.detail}`;
  const priorByStage = new Map(prior.map(step => [step.stage, step]));
  const currentByStage = new Map(current.map(step => [step.stage, step]));
  const rows: Array<{ state: "added" | "removed" | "changed"; step: TraceStep }> = [];
  current.forEach(step => {
    const before = priorByStage.get(step.stage);
    if (!before) rows.push({ state: "added", step });
    else if (key(before) !== key(step)) rows.push({ state: "changed", step });
  });
  prior.forEach(step => { if (!currentByStage.has(step.stage)) rows.push({ state: "removed", step }); });
  return { kind: "records" as const, rows };
}

function TraceList({ trace, pedagogic = false }: { trace: readonly TraceStep[]; pedagogic?: boolean }) {
  return <div className="trace-steps">{trace.map(step => <article className="trace-step" key={step.stage} id={`trace-step-${step.stage}`}><span className="trace-number">{step.stage}</span><div><strong>{step.label}</strong><code>{step.code}</code><p>{pedagogic ? pedagogicDetail(step) : step.detail}</p></div></article>)}</div>;
}

export function CompilationTraceModes({ trace, activeMode, onModeChange, projectionState, failureMessage, history }: {
  item: GalleryItem;
  trace: readonly TraceStep[];
  activeMode: TraceMode;
  onModeChange: (mode: TraceMode) => void;
  projectionState: "gallery" | "draft" | "compiling" | "error" | "live";
  failureMessage: string | null;
  history: readonly CompileSnapshot[];
  runtime: RuntimeRecord | null;
}) {
  const unavailable = projectionState === "draft" || projectionState === "compiling" || projectionState === "error";
  const current = projectionState === "live" ? trace : history.at(-1)?.trace ?? trace;
  const diff = traceDiff(history.length > 1 ? history.at(-2)?.trace : undefined, current);
  const tabs: Array<{ id: TraceMode; label: string }> = [
    { id: "diff", label: "Diff" }, { id: "evidence", label: "Evidence" }, { id: "pedagogic", label: "Pedagogic" }, { id: "failure", label: "Failure" },
  ];
  return <>
    <div className="trace-mode-tabs" role="tablist" aria-label="Compilation trace reading modes">{tabs.map(tab => <button key={tab.id} type="button" role="tab" aria-selected={activeMode === tab.id} className={activeMode === tab.id ? "active" : ""} onClick={() => onModeChange(tab.id)}>{tab.label}</button>)}</div>
    {activeMode === "evidence" && (unavailable ? <div className="projection-unavailable" role="status"><History size={18} /><strong>Live projection unavailable until this source compiles.</strong></div> : <TraceList trace={trace} />)}
    {activeMode === "pedagogic" && (unavailable ? <div className="mode-notice"><GraduationCap size={17} /><p>Annotations return after compilation.</p></div> : <TraceList trace={trace} pedagogic />)}
    {activeMode === "diff" && <div className="trace-mode-body">{diff.kind === "none" ? <div className="mode-notice"><FileDiff size={17} /><p>No prior compilation to compare.</p></div> : diff.rows.length === 0 ? <div className="mode-notice"><CheckCircle2 size={17} /><p>No trace changes.</p></div> : <div className="diff-list">{diff.rows.map(({ state, step }) => <article key={`${state}-${step.stage}`} className={`diff-row ${state}`}><span>{state.toUpperCase()}</span><code>{step.code}</code></article>)}</div>}</div>}
    {activeMode === "failure" && <div className="trace-mode-body failure-record"><TriangleAlert size={16} /><p>{failureMessage ?? "No compiler failure in the current source."}</p></div>}
  </>;
}

export function CredentialEvidence({ credential }: { credential: CredentialSignature }) {
  const status = credential.status?.trim().toLowerCase() || "unknown";
  const showBadge = status === "present" || status === "candidate";
  return <dl aria-live="polite">
    <div><dt>CREDENTIAL STATUS</dt><dd><strong>C2PA {status.toUpperCase()}</strong>{showBadge && <img src="/icons/content_credentials_logo.svg" alt="Content Credentials" className="c2pa-badge" />}</dd></div>
    <div><dt>VERIFICATION</dt><dd>{credential.verificationMethod.trim() || "Not reported"}</dd></div>
    <div><dt>VALIDATION NOTE</dt><dd>{credential.note.trim() || "No additional validation detail was returned."}</dd></div>
  </dl>;
}

export function ProvenanceModule({ item, runtime, onFocusReverse }: { item: GalleryItem; runtime: RuntimeRecord | null; onFocusReverse: () => void }) {
  const [tab, setTab] = useState<ProvenanceTab>("runtime");
  const tabs: Array<{ id: ProvenanceTab; label: string; icon: typeof ShieldCheck }> = [
    { id: "provenance", label: "Object provenance", icon: ShieldCheck },
    { id: "runtime", label: "Runtime manifest", icon: ClipboardList },
    { id: "reverse", label: "Reverse record", icon: Fingerprint },
  ];
  return <section className="manifest-strip provenance-module" aria-label="Object provenance and runtime manifest">
    <div className="provenance-tablist" role="tablist">{tabs.map(next => { const Icon = next.icon; return <button key={next.id} type="button" role="tab" aria-selected={tab === next.id} className={tab === next.id ? "active" : ""} onClick={() => setTab(next.id)}><Icon size={16} /><span>{next.label}</span></button>; })}</div>
    <div className="provenance-content" role="tabpanel">
      {tab === "provenance" && <div className="provenance-records"><dl><div><dt>SOURCE</dt><dd>{item.source}</dd></div><div><dt>SOURCE SHA-256</dt><dd>{runtime?.transientReverse?.sourceSha256 ?? item.credentialSignature.sourceSha256}</dd></div></dl><CredentialEvidence credential={item.credentialSignature} /></div>}
      {tab === "runtime" && <dl><div><dt>MODULE</dt><dd>{runtime?.transientReverse?.mode ?? "ON REQUEST"}</dd></div><div><dt>SEED</dt><dd>{runtime?.transientReverse?.seed ?? "generated on next turn"}</dd></div><div><dt>SETTINGS SHA-256</dt><dd>{runtime?.transientReverse?.settingsSha256 ?? "generated on next turn"}</dd></div><div><dt>OUTPUT SHA-256</dt><dd>{runtime?.transientReverse?.outputSha256 ?? "generated on next turn"}</dd></div><div><dt>CACHED INTERMEDIATE</dt><dd>none</dd></div></dl>}
      {tab === "reverse" && <dl><div><dt>COMMAND</dt><dd><button type="button" onClick={onFocusReverse}>reverse(mode: "negative")</button></dd></div><div><dt>PALETTE K</dt><dd>{item.script.match(/palette\(k:\s*(\d+)\)/)?.[1] ?? "8"}</dd></div><div><dt>SWATCHES</dt><dd>{runtime?.transientReverse?.swatches.join(" · ") ?? "compiled on next turn"}</dd></div></dl>}
    </div>
  </section>;
}
