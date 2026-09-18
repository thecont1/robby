import type { IngredientAnalysis } from "@/lib/robbyCompiler";

function EvidenceRow({ label, state, note }: { label: string; state: string; note: string }) {
  return <div className="embedded-evidence-row"><dt>{label}</dt><dd><strong>{state.toUpperCase()}</strong><span>{note}</span></dd></div>;
}

export default function EmbeddedEvidencePanel({ analysis, onAnalyze, running }: { analysis: IngredientAnalysis | null; onAnalyze: () => void; running: boolean }) {
  if (!analysis) {
    return <div className="ingredient-analysis-empty" role="status"><p>Inspect embedded evidence separately from the visual ingredients.</p><button type="button" className="ingredient-analyze-button" onClick={onAnalyze} disabled={running}>{running ? "Inspecting evidence" : "Inspect evidence"}</button><small>Values remain private; only extraction states enter this view.</small></div>;
  }
  return <div className="embedded-evidence-panel" aria-live="polite">
    <div className="ingredient-analysis-head"><div><p className="eyebrow">EVIDENCE INSPECTED</p><p className="ingredient-analysis-title">Metadata is evidence, not decoration.</p></div><button type="button" className="ingredient-refresh" onClick={onAnalyze} disabled={running}>{running ? "Reading" : "Reinspect"}</button></div>
    <dl className="embedded-evidence-list">
      <EvidenceRow label="EXIF" state={analysis.evidence.exif} note="Camera and capture metadata state; values are not displayed here." />
      <EvidenceRow label="IPTC" state={analysis.evidence.iptc} note="Editorial metadata state; values remain private by default." />
      <EvidenceRow label="XMP" state={analysis.evidence.xmp} note="Application metadata state; values remain private by default." />
      <EvidenceRow label="GPS" state={analysis.evidence.gps} note={analysis.evidence.gps === "present" ? "Coordinates detected but withheld from the public panel." : "No coordinates exposed by this analysis."} />
      <EvidenceRow label="C2PA" state={analysis.evidence.c2pa} note="Credential state is distinct from authorship or ownership." />
    </dl>
    <div className="embedded-evidence-policy"><strong>PUBLIC-SAFE POLICY</strong><p>Robby may measure private evidence, but it does not publish raw EXIF, IPTC, XMP, or GPS values. A future terrain view can use a deliberately generalized location representation only after an explicit consent decision.</p></div>
  </div>;
}
