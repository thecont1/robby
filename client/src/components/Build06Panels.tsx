import { CheckCircle2, ClipboardList, Download, FileDiff, Fingerprint, GraduationCap, History, ShieldCheck, ShieldX, TriangleAlert } from "lucide-react";
import { useState } from "react";
import type { GalleryItem, TraceStep } from "@/lib/demoData";
import type { RobbyIr } from "@/lib/robbyCompiler";
import type { CompileSnapshot } from "@/lib/compileHistory";

export type ProvenanceTab = "provenance" | "runtime" | "reverse";
export type TraceMode = "diff" | "evidence" | "registrar" | "pedagogic" | "failure";

export type RuntimeRecord = Pick<CompileSnapshot, "compiledAt" | "irHash"> & {
  toolchain: string;
};

type FieldProps = {
  id: string;
  label: string;
  value: React.ReactNode;
  detail: string;
  openId: string | null;
  onToggle: (id: string) => void;
  onAction?: () => void;
};

function DetailField({ id, label, value, detail, openId, onToggle, onAction }: FieldProps) {
  const open = openId === id;
  return <div className={`record-field ${open ? "is-open" : ""}`}>
    <button type="button" onClick={() => onAction ? onAction() : onToggle(id)} aria-expanded={onAction ? undefined : open} title={detail}>
      <span>{label}</span><b>{value}</b>
    </button>
    {open && <p className="record-disclosure" role="status">{detail}</p>}
  </div>;
}

export function pedagogicDetail(step: TraceStep) {
  if (step.code.startsWith("base(")) return "This chooses the original photograph that everything else in this image-object will be built upon.";
  if (step.code.startsWith("cutout(")) return "This finds the chosen subject in the photo and separates it from its background, like tracing around a figure with scissors.";
  if (step.code.startsWith("place(")) return "This positions the separated subject on the canvas and records the choices used to place it.";
  if (step.code.startsWith("palette(")) return "This samples the image and groups its most persistent colours into a small, inspectable palette.";
  if (step.code.startsWith("reverse(")) return "This creates the reverse face: an evidence image that reveals how the visible obverse was interpreted.";
  return "This writes an inspectable record of the source, transformations, and checksums so the result can be traced later.";
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
  prior.forEach(step => {
    if (!currentByStage.has(step.stage)) rows.push({ state: "removed", step });
  });
  return { kind: "records" as const, rows };
}

function TraceList({ trace, pedagogic = false }: { trace: readonly TraceStep[]; pedagogic?: boolean }) {
  return <div className="trace-steps">
    {trace.map(step => <article className="trace-step" key={step.stage} id={`trace-step-${step.stage}`}>
      <span className="trace-number">{step.stage}</span>
      <div><strong>{step.label}</strong><code>{step.code}</code><p>{pedagogic ? pedagogicDetail(step) : step.detail}</p></div>
      {step.color && <i style={{ backgroundColor: step.color }} aria-label="Vermilion provenance colour" />}
    </article>)}
  </div>;
}

export function CompilationTraceModes({
  item, trace, activeMode, onModeChange, projectionState, failureMessage, history, runtime, onExportRegistrar,
}: {
  item: GalleryItem;
  trace: readonly TraceStep[];
  activeMode: TraceMode;
  onModeChange: (mode: TraceMode) => void;
  projectionState: "gallery" | "draft" | "compiling" | "error" | "live";
  failureMessage: string | null;
  history: readonly CompileSnapshot[];
  runtime: RuntimeRecord | null;
  onExportRegistrar: (format: "json" | "pdf") => Promise<void>;
}) {
  const unavailable = projectionState === "draft" || projectionState === "compiling" || projectionState === "error";
  const diffCurrent = projectionState === "live" ? trace : history.at(-1)?.trace ?? trace;
  const prior = history.length > 1 ? history.at(-2)?.trace : undefined;
  const diff = traceDiff(prior, diffCurrent);
  const byteLength = new TextEncoder().encode(item.script).byteLength;
  const simulatedLine = item.script.split("\n").findIndex(line => line.startsWith("palette(")) + 1;
  const modeTabs: Array<{ id: TraceMode; label: string }> = [
    { id: "diff", label: "Diff" }, { id: "evidence", label: "Evidence" }, { id: "registrar", label: "Registrar" }, { id: "pedagogic", label: "Pedagogic" }, { id: "failure", label: "Failure" },
  ];

  return <>
    <div className="trace-mode-tabs" role="tablist" aria-label="Compilation trace reading modes">
      {modeTabs.map(tab => <button key={tab.id} type="button" role="tab" aria-selected={activeMode === tab.id} className={activeMode === tab.id ? "active" : ""} onClick={() => onModeChange(tab.id)}>{tab.label}</button>)}
    </div>
    {activeMode === "evidence" && (unavailable ? <div className="projection-unavailable" role="status"><History size={18} aria-hidden="true" /><div><p className="mono-label">Live projection withheld</p><strong>{projectionState === "draft" ? "The source changed after its last successful compile." : projectionState === "compiling" ? "Validating the current Rust source." : "The current source did not compile."}</strong><p>{projectionState === "error" ? "The editor’s live diagnostic is retained below. Correct the source and compile again for a new evidence record." : "Previous trace, hash, and output targets stay hidden until the current source compiles."}</p></div></div> : <TraceList trace={trace} />)}
    {activeMode === "pedagogic" && (unavailable ? <div className="mode-notice"><GraduationCap size={17} /><p>Teaching annotations return after the current source has a valid Rust compilation.</p></div> : <TraceList trace={trace} pedagogic />)}
    {activeMode === "diff" && <div className="trace-mode-body">{history.length > 1 && <p className="diff-history-note">Comparing the latest two persisted Rust/WASM compilations for this specimen.</p>}{diff.kind === "none" ? <div className="mode-notice"><FileDiff size={17} /><p>No prior compilation to diff against. Successful recompilations are retained in this browser’s IndexedDB history; the next one will compare against this record.</p></div> : diff.rows.length === 0 ? <div className="mode-notice"><CheckCircle2 size={17} /><p>No trace-step changes between the last two successful compilations for this specimen.</p></div> : <div className="diff-list">{diff.rows.map(({ state, step }) => <article key={`${state}-${step.stage}-${step.code}`} className={`diff-row ${state}`}><span>{state.toUpperCase()}</span><div><strong>{step.stage} · {step.label}</strong><code>{step.code}</code><p>{step.detail}</p></div></article>)}</div>}</div>}
    {activeMode === "registrar" && <div className="trace-mode-body registrar-record"><p className="mode-intro"><ClipboardList size={16} /> Registry reading of the active specimen. Exports use a browser-local ECDSA attestation; no legal certification or C2PA claim is implied.</p><div className="registrar-exports"><button type="button" onClick={() => void onExportRegistrar("json")}><Download size={12} /> Signed JSON</button><button type="button" onClick={() => void onExportRegistrar("pdf")}><Download size={12} /> Signed PDF</button></div><dl><div><dt>SPECIMEN ID</dt><dd>{item.id}</dd></div><div><dt>SCRIPT HASH</dt><dd title={item.scriptHash}>{item.scriptHash}</dd></div><div><dt>IR HASH</dt><dd title={runtime?.irHash}>{runtime?.irHash ?? "Rust/WASM validation in progress"}</dd></div><div><dt>OUTPUT HASH</dt><dd title={item.outputHash}>{item.outputHash}</dd></div><div><dt>COMPILED AT</dt><dd>{runtime ? new Date(runtime.compiledAt).toLocaleString() : "not yet recorded"}</dd></div><div><dt>IR VERSION</dt><dd>{runtime ? "robby-ir-v1" : "loading"}</dd></div><div><dt>HISTORY</dt><dd>{history.length} stored compile record{history.length === 1 ? "" : "s"} in this browser</dd></div></dl></div>}
    {activeMode === "failure" && <div className="trace-mode-body failure-record">{projectionState === "error" && failureMessage ? <><p className="mode-intro"><TriangleAlert size={16} /> Live compiler failure from the current editor source.</p><dl><div><dt>SPECIMEN</dt><dd>{item.id}</dd></div><div><dt>RUST DIAGNOSTIC</dt><dd>{failureMessage}</dd></div><div><dt>SUGGESTED FIX</dt><dd>Correct the highlighted command or parameter, then compile again to restore the evidence projection.</dd></div></dl></> : <><p className="mode-intro"><TriangleAlert size={16} /> <strong>Simulated failure example</strong> — the active specimen currently compiles cleanly.</p><dl><div><dt>PLAUSIBLE MISTAKE</dt><dd>Line {simulatedLine}: <code>cutout(source: "subject.jpg", mask: "architecture")</code></dd></div><div><dt>RUST DIAGNOSTIC</dt><dd>Unknown mask type `architecture`. Supported masks are `person` and `sky`.</dd></div><div><dt>SUGGESTED FIX</dt><dd>Choose a supported mask type, or remove the cutout command for a base-only composition.</dd></div><div><dt>CONTEXT</dt><dd>The current script is valid; this record is deliberately induced for teaching and review.</dd></div></dl></>}</div>}
    <div className="trace-evidence"><div className="signature-label"><Fingerprint size={13} /> <span className="mono-label">Colour signature</span></div><div className="palette-row" aria-label="Calculated palette signature">{item.palette.map(color => <span key={color} style={{ backgroundColor: color }} title={color} />)}</div><dl><div><dt>credential_signature</dt><dd>{item.credentialSignature.status === "present" ? "C2PA PRESENT" : "C2PA ABSENT"} · {item.credentialSignature.sourceSha256.slice(0, 14)}…</dd></div><div><dt>colour_signature</dt><dd>px:{item.colourSignature.pixelSha256.slice(0, 12)}… · pal:{item.colourSignature.paletteSha256.slice(0, 12)}…</dd></div><div><dt>script_input</dt><dd>{byteLength.toLocaleString()} UTF-8 bytes</dd></div></dl></div>
  </>;
}

export function ProvenanceModule({ item, runtime, onFocusReverse }: { item: GalleryItem; runtime: RuntimeRecord | null; onFocusReverse: () => void }) {
  const [tab, setTab] = useState<ProvenanceTab>("provenance");
  const [openId, setOpenId] = useState<string | null>(null);
  const toggle = (id: string) => setOpenId(current => current === id ? null : id);
  const sourceBytes = new TextEncoder().encode(item.script).byteLength;
  const paletteValues = item.palette.join(" · ");
  const reverseK = item.script.match(/reverse\(mode:\s*"palette-grid",\s*k:\s*(\d+)\)/)?.[1];
  const tabs: Array<{ id: ProvenanceTab; label: string }> = [{ id: "provenance", label: "Object provenance" }, { id: "runtime", label: "Runtime manifest" }, { id: "reverse", label: "Reverse record" }];

  return <section className="manifest-strip provenance-module" aria-label="Object provenance, runtime manifest, and reverse record" id="provenance-module">
    <div className="provenance-tablist" role="tablist" aria-label="Pre-footer records">
      {tabs.map(next => <button key={next.id} type="button" role="tab" aria-selected={tab === next.id} className={tab === next.id ? "active" : ""} onClick={() => { setTab(next.id); setOpenId(null); }}>{next.label}</button>)}
    </div>
    <div className="provenance-content" role="tabpanel">
      {tab === "provenance" && <><div className="provenance-title"><ShieldCheck size={18} /><span>Object provenance</span><small>{item.serial}</small></div><div className="record-grid"><DetailField id="source" label="SOURCE IMAGE" value={item.source} detail={`Original filename retained as supplied. Image dimensions: ${item.dimensions}.`} openId={openId} onToggle={toggle} /><DetailField id="capture" label="IMAGE RECORD" value={`${item.date} · ${item.subtitle}`} detail="Capture metadata available to the gallery is limited to this source record; the original JPEG bytes remain untouched in authenticated storage." openId={openId} onToggle={toggle} /><DetailField id="credential" label="CREDENTIAL SIGNATURE" value={item.credentialSignature.status === "present" ? "C2PA PRESENT" : "C2PA ABSENT"} detail={`${item.credentialSignature.note} Verification: ${item.credentialSignature.markerScan}. Generator: ${item.credentialSignature.claimGenerator ?? "none recorded"}. Raw source SHA-256: ${item.credentialSignature.sourceSha256}.`} openId={openId} onToggle={toggle} /><DetailField id="colour" label="COLOUR SIGNATURE" value={<span className="mini-swatches">{item.palette.map(color => <i key={color} style={{ backgroundColor: color }} />)}</span>} detail={`Exact RGB palette: ${paletteValues}. Fingerprint: ${item.colourSignature.pixelSha256}. Method: ${item.colourSignature.algorithm}.`} openId={openId} onToggle={toggle} /></div></>}
      {tab === "runtime" && <><div className="provenance-title"><ClipboardList size={18} /><span>Runtime manifest</span><small>LIVE RECORD</small></div><div className="record-grid"><DetailField id="script" label="SCRIPT HASH" value={`${item.scriptHash.slice(0, 18)}…`} detail={`SHA-256 of the canonical active .robby source, ${sourceBytes.toLocaleString()} UTF-8 bytes. Raw value: ${item.scriptHash}`} openId={openId} onToggle={toggle} /><DetailField id="output" label="OUTPUT CHECKSUM" value={`${item.outputHash.slice(0, 18)}…`} detail={`SHA-256 recorded for the selected rendered output bytes. Raw value: ${item.outputHash}`} openId={openId} onToggle={toggle} /><DetailField id="core" label="CORE" value={runtime?.toolchain ?? "RUST/WASM LOADING"} detail="Toolchain metadata is captured from the exact rustc invoked by Cargo when this WASM compiler was built; it is not a hardcoded browser value." openId={openId} onToggle={toggle} /><DetailField id="ir" label="IR / COMPILED AT" value={runtime ? "robby-ir-v1" : "VALIDATING"} detail={runtime ? `IR SHA-256: ${runtime.irHash}. Current Rust/WASM compilation: ${new Date(runtime.compiledAt).toLocaleString()}. Executor: CPU · Pillow / OpenCV.` : "The active script is being compiled through the Rust/WASM bridge."} openId={openId} onToggle={toggle} /></div></>}
      {tab === "reverse" && <><div className="provenance-title"><Fingerprint size={18} /><span>Reverse record</span><small>{item.reverseKind}</small></div><div className="record-grid"><DetailField id="mode" label="REVERSE MODE" value={<span className="reverse-mode-link">reverse(mode: "{item.reverseMode}")</span>} detail="Exact active reverse command. Select it to jump to the corresponding evidence step in the trace." openId={openId} onToggle={toggle} onAction={onFocusReverse} /><DetailField id="parameters" label="PARAMETERS" value={reverseK ? `k: ${reverseK}` : "none"} detail={reverseK ? `palette-grid samples ${reverseK} dominant colour clusters from the obverse.` : "This reverse mode has no additional named parameters in the active source."} openId={openId} onToggle={toggle} /><DetailField id="reading" label="WHAT IT REVEALS" value={item.reverseKind} detail={item.reverseDescription} openId={openId} onToggle={toggle} /><div className="record-field reverse-jump"><button type="button" onClick={onFocusReverse}><span>TRACE LINK</span><b>Find reverse step ↑</b></button><p>Opens Evidence mode and scrolls to the reverse operation in the compilation trace.</p></div></div></>}
    </div>
  </section>;
}
