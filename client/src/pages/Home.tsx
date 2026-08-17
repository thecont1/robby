/**
 * ROBBY VISUAL SYSTEM — Contact-sheet archaeology.
 * An asymmetric editorial workspace where obverse and reverse are equal image
 * objects; warm paper, charcoal rules, vermilion provenance and mono metadata
 * make every compiler action readable as a photographic trace.
 */

import { compiledExample, type ReverseMode } from "@/lib/demoData";
import {
  ArrowDownRight,
  Check,
  ChevronRight,
  CircleDotDashed,
  Code2,
  Eye,
  FileJson2,
  Focus,
  Layers3,
  ScanLine,
  Sparkles,
} from "lucide-react";
import { useState } from "react";

const reverseLabels: Record<ReverseMode, { eyebrow: string; description: string }> = {
  "provenance-map": {
    eyebrow: "Reverse 01 · Spatial audit",
    description: "Every vermilion pixel identifies the placed courier layer.",
  },
  "palette-grid": {
    eyebrow: "Reverse 02 · Colour evidence",
    description: "Eight dominant clusters, calculated from the rendered obverse.",
  },
};

function MonoLabel({ children }: { children: React.ReactNode }) {
  return <span className="mono-label">{children}</span>;
}

export default function Home() {
  const [activeNode, setActiveNode] = useState("layer-1");
  const [reverseMode, setReverseMode] = useState<ReverseMode>("provenance-map");
  const activeLayer = activeNode === "layer-1";
  const reverse = reverseLabels[reverseMode];

  return (
    <main className="min-h-screen overflow-hidden bg-[#f4efe1] text-[#1c1a19]">
      <header className="site-header">
        <a className="brand-lockup" href="#composition" aria-label="Robby composition viewer">
          <img src="/manus-storage/robby-registration-mark_658aceee.png" alt="Robby split registration disc" />
          <span>robby<span className="brand-suffix">/ v1</span></span>
        </a>
        <div className="header-center">
          <span className="header-kicker">Explainable visual composition compiler</span>
          <span className="header-dot" />
          <span className="mono text-[10px] tracking-[0.14em]">SEGFAULT 2026 · BUILD 01</span>
        </div>
        <div className="compile-status"><Check size={13} strokeWidth={3} /> VALID IR</div>
      </header>

      <section className="masthead">
        <div className="masthead-index" aria-hidden="true">
          <span>01</span><span>—</span><span>COMPILED</span>
        </div>
        <div className="masthead-copy">
          <p className="eyebrow">A tiny compiler for visual composition</p>
          <h1>Every picture<br />has a <em>reverse.</em></h1>
        </div>
        <div className="masthead-note">
          <span className="note-rule" />
          <p>The obverse is a constructed image. The reverse makes the construction visible without becoming a debug screen.</p>
          <span className="mono text-[10px] tracking-[0.13em]">{compiledExample.irVersion}</span>
        </div>
      </section>

      <section id="composition" className="composition-sheet" aria-label="Compiled composition">
        <aside className="specimen-rail">
          <div className="rail-marker"><span>SPECIMEN</span><span>01 / 01</span></div>
          <div className="rail-copy">
            <MonoLabel>Script</MonoLabel>
            <p>{compiledExample.title}</p>
            <span className="mono text-[10px]">SHA {compiledExample.sourceHash}</span>
          </div>
          <img className="rail-art" src="/manus-storage/robby-provenance-pattern_b9e25bd6.png" alt="Abstract provenance study" />
        </aside>

        <article className="image-object obverse-object">
          <div className="object-meta">
            <div><MonoLabel>Obverse</MonoLabel><span className="object-index">01</span></div>
            <span className="mono text-[10px]">COMPOSITE · 1440 × 1080</span>
          </div>
          <div className="image-frame obverse-frame">
            <img src={compiledExample.obverse} alt="Night street composited with a transformed courier cutout" />
            {activeLayer && (
              <button
                className="layer-region"
                onClick={() => setActiveNode("layer-1")}
                aria-label="Selected region: courier layer"
              >
                <span>01</span>
                <i />
              </button>
            )}
          </div>
          <div className="object-caption">
            <p>Night Street / courier placement</p>
            <span><Focus size={13} /> LAYER 01 ACTIVE</span>
          </div>
        </article>

        <article className="image-object reverse-object">
          <div className="object-meta">
            <div><MonoLabel>Reverse</MonoLabel><span className="object-index">{reverseMode === "provenance-map" ? "01" : "02"}</span></div>
            <span className="mono text-[10px]">{reverse.eyebrow.toUpperCase()}</span>
          </div>
          <div className="reverse-tabs" role="tablist" aria-label="Reverse image mode">
            {(Object.keys(compiledExample.reverses) as ReverseMode[]).map((mode) => (
              <button
                key={mode}
                role="tab"
                aria-selected={reverseMode === mode}
                className={reverseMode === mode ? "active" : ""}
                onClick={() => setReverseMode(mode)}
              >
                {mode === "provenance-map" ? "Provenance" : "Palette"}
              </button>
            ))}
          </div>
          <div className="image-frame reverse-frame">
            <img src={compiledExample.reverses[reverseMode]} alt={reverse.description} />
            {activeLayer && reverseMode === "provenance-map" && <div className="reverse-pulse" aria-hidden="true" />}
          </div>
          <div className="object-caption reverse-caption">
            <p>{reverse.description}</p>
            <span><Eye size={13} /> INSPECTABLE OUTPUT</span>
          </div>
        </article>
      </section>

      <section className="trace-section" aria-labelledby="trace-title">
        <div className="trace-intro">
          <span className="section-number">02</span>
          <div>
            <p className="eyebrow">Process graph</p>
            <h2 id="trace-title">Trace the light<br />back to its source.</h2>
          </div>
          <p className="trace-summary">Click a compiler step. The provenance swatch and selected region follow the same record stored in the generated manifest.</p>
        </div>

        <div className="trace-layout">
          <section className="source-panel" aria-labelledby="source-title">
            <div className="panel-heading">
              <div><Code2 size={15} /><MonoLabel>Source language</MonoLabel></div>
              <span className="mono text-[10px]">night-duality.robby</span>
            </div>
            <ol className="source-code" id="source-title">
              {compiledExample.script.map((line, index) => (
                <li key={line} className={index === 2 ? "active-line" : ""}>
                  <span>{String(index + 1).padStart(2, "0")}</span><code>{line}</code>
                </li>
              ))}
            </ol>
          </section>

          <section className="nodes-panel" aria-label="Compilation steps">
            <div className="panel-heading"><div><CircleDotDashed size={15} /><MonoLabel>Compilation trace</MonoLabel></div><span className="mono text-[10px]">6 NODES · 7 EDGES</span></div>
            <div className="node-list">
              {compiledExample.nodes.map((node, index) => {
                const isActive = activeNode === node.id;
                return (
                  <button
                    type="button"
                    key={node.id}
                    onClick={() => setActiveNode(node.id)}
                    className={`trace-node ${isActive ? "selected" : ""}`}
                  >
                    <span className="node-order">{String(index + 1).padStart(2, "0")}</span>
                    <span className="node-icon">{node.type === "source" ? <ScanLine /> : node.type === "layer" ? <Layers3 /> : node.type === "output" ? <ArrowDownRight /> : <ChevronRight />}</span>
                    <span className="node-copy"><strong>{node.label}</strong><code>{node.code}</code><small>{node.detail}</small></span>
                    {"color" in node && node.color && <i className="provenance-swatch" style={{ backgroundColor: node.color }} />}
                  </button>
                );
              })}
            </div>
          </section>

          <aside className="evidence-panel" aria-label="Selected layer evidence">
            <div className="evidence-disc" style={{ backgroundColor: compiledExample.layer.color }}><span>01</span></div>
            <MonoLabel>Selected evidence</MonoLabel>
            <h3>{compiledExample.layer.cutout}<br />/ person</h3>
            <dl>
              <div><dt>Mask strategy</dt><dd>{compiledExample.layer.strategy}</dd></div>
              <div><dt>Region</dt><dd>{compiledExample.layer.bounds}</dd></div>
              <div><dt>Source</dt><dd>{compiledExample.layer.source}</dd></div>
            </dl>
            <div className="palette-row" aria-label="Calculated dominant palette">
              {compiledExample.palette.map((color) => <span key={color} style={{ backgroundColor: color }} title={color} />)}
            </div>
            <p className="evidence-foot">One layer is selected. Its vermilion is reused in the reverse map and this process record.</p>
          </aside>
        </div>
      </section>

      <section className="manifest-strip" aria-label="Manifest record">
        <div className="manifest-identity"><FileJson2 size={18} /><span>MANIFEST / PROCESS GRAPH</span></div>
        <div className="manifest-fields"><span>VERSION <b>{compiledExample.manifestVersion}</b></span><span>OUTPUT SHA <b>{compiledExample.outputHash}</b></span><span>EXECUTOR <b>CPU · PILLOW / OPENCV</b></span></div>
        <img src="/manus-storage/robby-palette-study_ad20752b.png" alt="Abstract palette study" />
        <Sparkles className="manifest-spark" size={18} />
      </section>

      <footer className="site-footer">
        <p>Robby treats the process graph as a photographic reverse: <em>not proof of perfection, but evidence of a making.</em></p>
        <span className="mono text-[10px]">OBVERSE / REVERSE / MANIFEST</span>
      </footer>
    </main>
  );
}
