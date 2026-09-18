import type { IngredientAnalysis } from "@/lib/robbyCompiler";

export type IngredientAnalysisStatus = "idle" | "running" | "ready" | "error";

function shortHash(value: string) {
  return value.length > 18 ? `${value.slice(0, 10)}…${value.slice(-6)}` : value;
}

function formatBytes(value: number) {
  if (value < 1024) return `${value} B`;
  return `${(value / 1024 / 1024).toFixed(2)} MB`;
}

function FieldGrid({ values, kind }: { values: readonly number[]; kind: "luminance" | "edge" | "texture" }) {
  return (
    <div className={`ingredient-field-grid ingredient-field-${kind}`} role="img" aria-label={`${kind} field, 8 by 8 analysis grid`}>
      {values.map((value, index) => <i key={`${kind}-${index}`} style={{ "--field-value": value / 255 } as React.CSSProperties} title={`${kind} ${value}`} />)}
    </div>
  );
}

function Stage({ number, title, detail, state = "measured" }: { number: string; title: string; detail: string; state?: "measured" | "derived" | "pending" }) {
  return <li className={`ingredient-stage ingredient-stage-${state}`}><span className="ingredient-stage-number">{number}</span><div><strong>{title}</strong><p>{detail}</p></div><em>{state}</em></li>;
}

export default function IngredientAnalysisPanel({ status, analysis, error, paletteK, onAnalyze }: {
  status: IngredientAnalysisStatus;
  analysis: IngredientAnalysis | null;
  error: string | null;
  paletteK: number;
  onAnalyze: () => void;
}) {
  if (status === "idle") {
    return <div className="ingredient-analysis-empty" role="status"><p>Run the Rust ingredient pass to expose how this one reverse is measured.</p><button type="button" className="ingredient-analyze-button" onClick={onAnalyze}>Analyze ingredients</button><small>On demand · no image derivative · bounded 8 × 8 fields</small></div>;
  }

  if (status === "running") {
    return <div className="ingredient-analysis-empty" role="status" aria-live="polite"><p>troid is reading the obverse and calculating its visual ingredients…</p><ol className="ingredient-stage-list"><Stage number="01" title="Read" detail="Exact source bytes and canonical pixels" state="measured" /><Stage number="02" title="Calculate" detail={`Median-cut palette at k=${paletteK}, luminance, structure` } state="pending" /><Stage number="03" title="Derive" detail="Perceptual identity and bounded fields" state="pending" /></ol></div>;
  }

  if (status === "error" || !analysis) {
    return <div className="ingredient-analysis-empty" role="alert"><p>Ingredient analysis could not be completed.</p><small>{error ?? "Try again from the Ingredients tab."}</small><button type="button" className="ingredient-analyze-button" onClick={onAnalyze}>Retry analysis</button></div>;
  }

  const { source, palette, structure, identity } = analysis;
  return <div className="ingredient-analysis" aria-live="polite">
    <div className="ingredient-analysis-head"><div><p className="eyebrow">INGREDIENTS RESOLVED</p><p className="ingredient-analysis-title">One obverse. One measured reverse vocabulary.</p></div><button type="button" className="ingredient-refresh" onClick={onAnalyze}>Recalculate</button></div>
    <ol className="ingredient-stage-list"><Stage number="01" title="Read" detail={`${formatBytes(source.byte_size)} · ${source.width} × ${source.height} · ${source.colour_profile ?? "colour profile not detected"}`} /><Stage number="02" title="Extract" detail={`${palette.entries.length} palette clusters · ${palette.method} · ${palette.ordering}`} /><Stage number="03" title="Measure" detail={`${structure.grid_size} × ${structure.grid_size} spatial cells · luminance, edge, texture`} /><Stage number="04" title="Derive" detail={`aHash ${identity.perceptual_hash} · index map ${shortHash(palette.index_map_sha256)}`} state="derived" /></ol>
    <div className="ingredient-record-grid"><div><dt>BYTE SHA-256</dt><dd>{shortHash(source.byte_sha256)}</dd></div><div><dt>PIXEL SHA-256</dt><dd>{shortHash(source.pixel_sha256)}</dd></div><div><dt>PERCEPTUAL HASH</dt><dd>{identity.perceptual_hash}</dd></div><div><dt>ORIENTATION</dt><dd>{source.orientation ?? "not declared"}</dd></div></div>
    <div className="ingredient-section"><div className="ingredient-section-heading"><strong>PALETTE MATERIAL</strong><span>{palette.requested_k} colours · exact Rust result</span></div><div className="ingredient-palette-list">{palette.entries.map(entry => <div className="ingredient-palette-row" key={`${entry.rank}-${entry.hex}`}><i style={{ background: entry.hex }} /><span>{entry.hex}</span><span>{entry.share_percent.toFixed(1)}%</span></div>)}</div></div>
    <div className="ingredient-fields"><div><div className="ingredient-section-heading"><strong>LUMINANCE</strong><span>8 bands</span></div><FieldGrid values={structure.spatial_cells.map(cell => cell.mean_luminance)} kind="luminance" /></div><div><div className="ingredient-section-heading"><strong>EDGE FIELD</strong><span>cell contrast</span></div><FieldGrid values={structure.edge_field} kind="edge" /></div><div><div className="ingredient-section-heading"><strong>TEXTURE</strong><span>local variation</span></div><FieldGrid values={structure.texture_field} kind="texture" /></div></div>
  </div>;
}
