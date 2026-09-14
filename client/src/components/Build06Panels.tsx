import { CheckCircle2, ClipboardList, FileDiff, Fingerprint, GraduationCap, History, ShieldCheck, TriangleAlert } from "lucide-react";
import { useState, type KeyboardEvent } from "react";
import type { CredentialSignature, GalleryItem, TraceStep } from "@/lib/demoData";
import type { CompileSnapshot } from "@/lib/compileHistory";
import type { C2paEvidence } from "@/lib/c2paEvidence";
import { c2paEvidenceLabel } from "@/lib/c2paEvidence";

/**
 * Index of the tab a roving-tabindex tablist should move to for a key, or
 * null when the key is not a tablist navigation key.
 *
 * ArrowLeft/ArrowRight wrap (WAI-ARIA authoring practice for horizontal
 * tabs); Home/End jump to the bounds.
 */
export function nextTabIndex(key: string, current: number, count: number): number | null {
  if (count <= 0) return null;
  switch (key) {
    case "ArrowRight":
      return (current + 1) % count;
    case "ArrowLeft":
      return (current - 1 + count) % count;
    case "Home":
      return 0;
    case "End":
      return count - 1;
    default:
      return null;
  }
}

/**
 * Shared keydown handler for a roving-tabindex tablist: moves DOM focus and
 * selects the tab, so keyboard and pointer users reach the same state.
 */
function tablistKeyDown<Id extends string>(
  event: KeyboardEvent<HTMLDivElement>,
  ids: readonly Id[],
  activeId: Id,
  select: (id: Id) => void,
  domId: (id: Id) => string,
) {
  const target = nextTabIndex(event.key, ids.indexOf(activeId), ids.length);
  if (target === null) return;
  event.preventDefault();
  const nextId = ids[target];
  select(nextId);
  // The newly selected tab becomes the only tabbable one; move focus with it.
  requestAnimationFrame(() => document.getElementById(domId(nextId))?.focus());
}

export type ProvenanceTab = "provenance" | "runtime" | "reverse";
export type TraceMode = "diff" | "evidence" | "pedagogic" | "failure";

export type RuntimeRecord = Pick<CompileSnapshot, "compiledAt" | "irHash"> & {
  toolchain: string;
  c2paEvidence?: C2paEvidence;
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
    <div className="trace-mode-tabs" role="tablist" aria-label="Compilation trace reading modes" onKeyDown={event => tablistKeyDown(event, tabs.map(tab => tab.id), activeMode, onModeChange, id => `trace-tab-${id}`)}>{tabs.map(tab => <button key={tab.id} id={`trace-tab-${tab.id}`} type="button" role="tab" aria-controls="trace-panel" aria-selected={activeMode === tab.id} tabIndex={activeMode === tab.id ? 0 : -1} className={activeMode === tab.id ? "active" : ""} onClick={() => onModeChange(tab.id)}>{tab.label}</button>)}</div>
    <div id="trace-panel" role="tabpanel" aria-labelledby={`trace-tab-${activeMode}`}>
      {activeMode === "evidence" && (unavailable ? <div className="projection-unavailable" role="status"><History size={18} /><strong>Live projection unavailable until this source compiles.</strong></div> : <TraceList trace={trace} />)}
      {activeMode === "pedagogic" && (unavailable ? <div className="mode-notice"><GraduationCap size={17} /><p>Annotations return after compilation.</p></div> : <TraceList trace={trace} pedagogic />)}
      {activeMode === "diff" && <div className="trace-mode-body">{diff.kind === "none" ? <div className="mode-notice"><FileDiff size={17} /><p>No prior compilation to compare.</p></div> : diff.rows.length === 0 ? <div className="mode-notice"><CheckCircle2 size={17} /><p>No trace changes.</p></div> : <div className="diff-list">{diff.rows.map(({ state, step }) => <article key={`${state}-${step.stage}`} className={`diff-row ${state}`}><span>{state.toUpperCase()}</span><code>{step.code}</code></article>)}</div>}</div>}
      {activeMode === "failure" && <div className="trace-mode-body failure-record"><TriangleAlert size={16} /><p>{failureMessage ?? "No compiler failure in the current source."}</p></div>}
    </div>
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

/**
 * The Reverse record's derived facts. These MUST come from the live authored
 * state, never from re-parsing `item.script` — that field is the immutable
 * gallery source, so regexing it makes the panel report a stale k after the
 * user edits the palette. `item` supplies fallbacks only.
 */
export function reverseRecordFacts({ item, reverseMode, paletteK }: { item: Pick<GalleryItem, "reverseMode">; reverseMode?: string; paletteK: number }) {
  return {
    command: `reverse(mode: "${reverseMode ?? item.reverseMode ?? "negative"}")`,
    paletteK,
  };
}

export function ProvenanceModule({ item, runtime, onFocusReverse, reverseMode, paletteK }: { item: GalleryItem; runtime: RuntimeRecord | null; onFocusReverse: () => void; reverseMode?: string; paletteK: number }) {
  const [tab, setTab] = useState<ProvenanceTab>("runtime");
  const c2paEvidence = runtime?.c2paEvidence;
  // The displayed command must match the active recipe's reverse(mode), not a
  // hard-coded module name. Fall back to the item's own declared mode.
  const reverseFacts = reverseRecordFacts({ item, reverseMode, paletteK });
  const tabs: Array<{ id: ProvenanceTab; label: string; icon: typeof ShieldCheck }> = [
    { id: "provenance", label: "Object provenance", icon: ShieldCheck },
    { id: "runtime", label: "Runtime manifest", icon: ClipboardList },
    { id: "reverse", label: "Reverse record", icon: Fingerprint },
  ];
  return <section className="manifest-strip provenance-module" aria-label="Object provenance and runtime manifest">
    <div className="provenance-tablist" role="tablist" aria-label="Object provenance and runtime manifest views" onKeyDown={event => tablistKeyDown(event, tabs.map(next => next.id), tab, setTab, id => `provenance-tab-${id}`)}>{tabs.map(next => { const Icon = next.icon; return <button key={next.id} id={`provenance-tab-${next.id}`} type="button" role="tab" aria-controls="provenance-panel" aria-selected={tab === next.id} tabIndex={tab === next.id ? 0 : -1} className={tab === next.id ? "active" : ""} onClick={() => setTab(next.id)}><Icon size={16} aria-hidden="true" /><span>{next.label}</span></button>; })}</div>
    <div id="provenance-panel" className="provenance-content" role="tabpanel" aria-labelledby={`provenance-tab-${tab}`}>
      {tab === "provenance" && <div className="provenance-records"><dl><div><dt>SOURCE</dt><dd>{item.source}</dd></div><div><dt>SOURCE SHA-256</dt><dd>{runtime?.transientReverse?.sourceSha256 ?? item.credentialSignature.sourceSha256}</dd></div></dl>{c2paEvidence ? <dl aria-live="polite"><div><dt>C2PA RECORD</dt><dd><strong>{c2paEvidenceLabel(c2paEvidence)}</strong></dd></div><div><dt>AVAILABILITY</dt><dd>{c2paEvidence.availability.toUpperCase()}</dd></div><div><dt>INSPECTED AT</dt><dd>{c2paEvidence.inspectedAt}</dd></div><div><dt>VERIFICATION</dt><dd>{c2paEvidence.verificationMethod}</dd></div><div><dt>WARNINGS</dt><dd>{c2paEvidence.warnings.length ? c2paEvidence.warnings.join(" · ") : "none"}</dd></div></dl> : <CredentialEvidence credential={item.credentialSignature} />}</div>}
      {tab === "runtime" && <dl><div><dt>MODULE</dt><dd>{runtime?.transientReverse?.mode ?? "ON REQUEST"}</dd></div><div><dt>SEED</dt><dd>{runtime?.transientReverse?.seed ?? "generated on next turn"}</dd></div><div><dt>SETTINGS SHA-256</dt><dd>{runtime?.transientReverse?.settingsSha256 ?? "generated on next turn"}</dd></div><div><dt>OUTPUT SHA-256</dt><dd>{runtime?.transientReverse?.outputSha256 ?? "generated on next turn"}</dd></div><div><dt>CACHED INTERMEDIATE</dt><dd>none</dd></div></dl>}
      {tab === "reverse" && <dl><div><dt>COMMAND</dt><dd><button type="button" onClick={onFocusReverse}>{reverseFacts.command}</button></dd></div><div><dt>PALETTE K</dt><dd>{reverseFacts.paletteK}</dd></div><div><dt>SWATCHES</dt><dd>{runtime?.transientReverse?.swatches.join(" · ") ?? "compiled on next turn"}</dd></div></dl>}
    </div>
  </section>;
}
