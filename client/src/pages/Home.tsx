/**
 * ROBBY VISUAL SYSTEM — Contact-sheet archaeology.
 * A gallery of two-sided photographic objects. The central stage renders one
 * face only; its adjacent trace is evidence of the current object's making.
 * Build 05 adds a Rust/WASM workbench without replacing the approved gallery.
 */

import SourceEditor from "@/components/SourceEditor";
import { gallery, type TraceStep } from "@/lib/demoData";
import { type RobbyIr } from "@/lib/robbyCompiler";
import {
  Check,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  CircleDotDashed,
  Download,
  FileJson2,
  Fingerprint,
  FlipHorizontal2,
  RotateCcw,
  ShieldX,
  Sparkles,
} from "lucide-react";
import { Link } from "wouter";
import { useEffect, useState } from "react";
import initRobbyCompiler, {
  compile_source_json,
  compiler_version,
} from "../wasm/robby_compiler";

function MonoLabel({ children }: { children: React.ReactNode }) {
  return <span className="mono-label">{children}</span>;
}

function shortHash(value: string) {
  return `${value.slice(0, 16)}…${value.slice(-8)}`;
}

function traceFromIr(ir: RobbyIr): TraceStep[] {
  const trace: TraceStep[] = [{ stage: "01", label: "Base canvas", code: `base("${ir.canvas.base}")`, detail: "live Rust IR · validated source" }];
  ir.cutouts.forEach((cutout, index) => trace.push({ stage: String(index + 2).padStart(2, "0"), label: "Extract subject", code: `cutout(mask: "${cutout.mask}")`, detail: `${cutout.id} · ${cutout.source}` }));
  ir.layers.forEach((layer, index) => trace.push({ stage: String(trace.length + 1).padStart(2, "0"), label: "Place layer", code: `place(x: ${layer.x}, y: ${layer.y})`, detail: `${layer.blend} · ${layer.scale} scale · ${layer.rotation}° rotation`, color: index === 0 ? "#E3442F" : undefined }));
  if (ir.palette) trace.push({ stage: String(trace.length + 1).padStart(2, "0"), label: "Calculate palette", code: `palette(k: ${ir.palette.k})`, detail: "live IR palette declaration" });
  ir.reverse.forEach((reverse) => trace.push({ stage: String(trace.length + 1).padStart(2, "0"), label: "Render inverse", code: `reverse("${reverse.mode}")`, detail: reverse.k ? `palette grid · k=${reverse.k}` : "provenance declaration" }));
  trace.push({ stage: String(trace.length + 1).padStart(2, "0"), label: "Write manifest", code: `output(…${ir.output.manifest})`, detail: "static deployment · image render pending" });
  return trace;
}

export default function Home() {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [face, setFace] = useState<"obverse" | "inverse">("obverse");
  const [isFlipping, setIsFlipping] = useState(false);
  const [credentialOpen, setCredentialOpen] = useState(false);
  const [compilerState, setCompilerState] = useState<"checking" | "verified" | "error">("checking");
  const [compilerLabel, setCompilerLabel] = useState("RUST CORE · LOADING");
  const [compiledEdit, setCompiledEdit] = useState<{ specimenId: string; ir: RobbyIr; source: string } | null>(null);
  const selected = gallery[selectedIndex];
  const activeFace = face;
  const liveIr = compiledEdit?.specimenId === selected.id ? compiledEdit.ir : null;
  const trace = liveIr ? traceFromIr(liveIr) : selected.trace;
  const liveScriptHash = liveIr?.meta.script_sha256 ?? selected.scriptHash;
  const liveReverseMode = liveIr?.reverse.map((item) => item.k ? `${item.mode} (k=${item.k})` : item.mode).join(" + ") ?? selected.reverseMode;

  const selectImage = (nextIndex: number) => {
    if (isFlipping) return;
    setSelectedIndex((nextIndex + gallery.length) % gallery.length);
    setFace("obverse");
    setIsFlipping(false);
    setCredentialOpen(false);
    setCompiledEdit(null);
  };

  const turnOver = () => {
    if (isFlipping) return;
    setIsFlipping(true);
    setFace((current) => current === "obverse" ? "inverse" : "obverse");
  };

  const settleFlip = (event: React.TransitionEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget && event.propertyName === "transform") {
      setIsFlipping(false);
    }
  };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "ArrowLeft") selectImage(selectedIndex - 1);
      if (event.key === "ArrowRight") selectImage(selectedIndex + 1);
      if (event.key.toLowerCase() === "f") turnOver();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [selectedIndex, isFlipping]);

  useEffect(() => {
    let active = true;
    setCompilerState("checking");
    setCompilerLabel("RUST CORE · VERIFYING");

    initRobbyCompiler()
      .then(() => {
        const ir = JSON.parse(compile_source_json(selected.script)) as { version?: string };
        if (!active) return;
        if (ir.version !== "robby-ir-v1") throw new Error("Unexpected IR version");
        setCompilerState("verified");
        setCompilerLabel(`VALID IR · ${compiler_version().replace("robby-compiler-", "RUST ")}`);
      })
      .catch(() => {
        if (!active) return;
        setCompilerState("error");
        setCompilerLabel("RUST CORE · CHECK FAILED");
      });

    return () => {
      active = false;
    };
  }, [selected.id, selected.script]);

  const applyCompiledSource = (ir: RobbyIr, source: string) => {
    setCompiledEdit({ specimenId: selected.id, ir, source });
    setFace("obverse");
  };

  return (
    <main className="min-h-screen overflow-hidden bg-[#f4efe1] text-[#1c1a19]">
      <header className="site-header">
        <a className="brand-lockup" href="#gallery" aria-label="Robby gallery">
          <img src="/manus-storage/robby-registration-mark_658aceee.png" alt="Robby split registration disc" />
          <span>robby<span className="brand-suffix">/ v1</span></span>
        </a>
        <div className="header-center">
          <span className="header-kicker">Explainable visual composition compiler</span>
          <span className="header-dot" />
          <span className="mono text-[10px] tracking-[0.14em]">GALLERY · 05 OBJECTS</span>
        </div>
        <div className="header-actions">
          <Link className="manual-link" href="/manual"><BookOpen size={13} strokeWidth={2.5} /> LANGUAGE MANUAL</Link>
          <a className="source-download" href="https://github.com/thecont1/robby/archive/refs/heads/dev/ananya.zip" target="_blank" rel="noreferrer">
            <Download size={13} strokeWidth={2.5} /> DOWNLOAD RUST SOURCE
          </a>
          <div className={`compile-status ${compilerState}`}><Check size={13} strokeWidth={3} /> {compilerLabel}</div>
        </div>
      </header>

      <section className="gallery-intro">
        <div className="intro-index" aria-hidden="true"><span>01</span><span>—</span><span>GALLERY</span></div>
        <div className="intro-copy">
          <p className="eyebrow">Obverse / inverse image library</p>
          <h1>One object.<br />One face <em>at a time.</em></h1>
        </div>
        <div className="intro-note">
          <span className="note-rule" />
          <p>Like a postcard or coin, Robby’s image-object cannot reveal its obverse and inverse together. Turn it over; keep the trace in view.</p>
          <span className="mono text-[10px] tracking-[0.13em]">← → TO CYCLE · F TO FLIP</span>
        </div>
      </section>

      <section id="gallery" className="gallery-workspace" aria-label="Robby image-object gallery">
        <section className="object-stage" aria-labelledby="object-title">
          <div className="stage-topline">
            <div><MonoLabel>Selected image-object</MonoLabel><span className="object-serial">{selected.serial}</span></div>
            <span className="mono text-[10px]">{selected.dimensions} · {activeFace.toUpperCase()}</span>
          </div>

          <div className={`two-sided-object ${selected.ratio}`} aria-busy={isFlipping}>
            <div className="object-turner" data-face={face} onTransitionEnd={settleFlip}>
              <div className="object-face object-face-obverse" aria-hidden={face !== "obverse"}>
                <img src={selected.obverse} alt={`${selected.title} obverse`} className="object-image" />
                <span className="face-stamp">O</span>
              </div>
              <div className="object-face object-face-inverse" aria-hidden={face !== "inverse"}>
                <img src={selected.reverse} alt={`${selected.title} inverse: ${selected.reverseDescription}`} className="object-image" />
                <span className="face-stamp">I</span>
              </div>
            </div>
            <span className="face-corner top-left" /><span className="face-corner top-right" /><span className="face-corner bottom-left" /><span className="face-corner bottom-right" />
          </div>

          <div className="stage-caption">
            <div className="caption-record">
              <p className="caption-face">{face === "inverse" ? selected.reverseKind : "Obverse"}</p>
              <h2 id="object-title">{selected.title}</h2>
              <p className="caption-detail">{face === "inverse" ? selected.reverseDescription : selected.subtitle}</p>
              <div className="signature-row" aria-label="Specimen signatures">
                <div className="credential-wrap">
                  <button
                    type="button"
                    className="credential-badge absent"
                    onClick={() => setCredentialOpen((current) => !current)}
                    aria-expanded={credentialOpen}
                    aria-controls="credential-summary"
                  >
                    <ShieldX size={14} strokeWidth={2.2} /> C2PA ABSENT
                  </button>
                  <div id="credential-summary" className={`credential-popover ${credentialOpen ? "open" : ""}`} role="status">
                    <strong>Credential signature</strong>
                    <p>{selected.credentialSignature.note}</p>
                    <dl>
                      <div><dt>issuer</dt><dd>no embedded record</dd></div>
                      <div><dt>edit history</dt><dd>no embedded record</dd></div>
                      <div><dt>capture info</dt><dd>no embedded record</dd></div>
                      <div><dt>source sha</dt><dd>{selected.credentialSignature.sourceSha256.slice(0, 16)}…</dd></div>
                    </dl>
                  </div>
                </div>
                <div className="colour-badge">
                  <Fingerprint size={14} strokeWidth={2.2} />
                  <span>COLOUR SIGNATURE</span>
                  <i className="inline-swatches" aria-label="Eight-colour signature">
                    {selected.palette.map((color) => <b key={color} style={{ backgroundColor: color }} />)}
                  </i>
                </div>
              </div>
              <p className="signature-tension">One signature is cryptographic. One is visual. Only one is human-readable.</p>
              {liveIr && <p className="static-artifact-note">STATIC ARTIFACT · RENDER PENDING — the live Rust IR changes this trace and manifest target; bitmap faces remain the selected pre-rendered specimen.</p>}
            </div>
            <button type="button" className="flip-control" onClick={turnOver} disabled={isFlipping} aria-label={face === "inverse" ? `Return ${selected.title} to its obverse` : `Flip ${selected.title} to its inverse`}>
              {face === "inverse" ? <RotateCcw size={18} /> : <FlipHorizontal2 size={18} />}
              <span>{isFlipping ? "Turning object" : face === "inverse" ? "Return to obverse" : "Turn to inverse"}</span>
              <small>F</small>
            </button>
          </div>

          <div className="stage-navigation">
            <button type="button" onClick={() => selectImage(selectedIndex - 1)} disabled={isFlipping} aria-label="Previous image"><ChevronLeft size={17} /> Previous</button>
            <span className="navigation-current">{selected.serial}</span>
            <button type="button" onClick={() => selectImage(selectedIndex + 1)} disabled={isFlipping} aria-label="Next image">Next <ChevronRight size={17} /></button>
          </div>

          <nav className="bottom-filmstrip" aria-label="Gallery navigation">
            <div className="filmstrip-heading"><MonoLabel>Image library</MonoLabel><span>{selected.serial}</span></div>
            <ol className="gallery-list">
              {gallery.map((item, index) => (
                <li key={item.id}>
                  <button
                    type="button"
                    className={index === selectedIndex ? "gallery-thumb selected" : "gallery-thumb"}
                    onClick={() => selectImage(index)}
                    disabled={isFlipping}
                    aria-current={index === selectedIndex ? "true" : undefined}
                    aria-label={`Select ${item.title}`}
                  >
                    <img src={item.obverse} alt="" />
                    <span><b>{String(index + 1).padStart(2, "0")}</b><em>{item.title}</em></span>
                  </button>
                </li>
              ))}
            </ol>
          </nav>

          <SourceEditor specimenId={selected.id} title={selected.title} source={selected.script} onCompiled={applyCompiledSource} />
        </section>

        <aside className="trace-panel" aria-label={`Compilation trace for ${selected.title}`}>
          <div className="trace-heading"><div><CircleDotDashed size={15} /><MonoLabel>Compilation trace</MonoLabel></div><span>{trace.length} STEPS</span></div>
          <div className="trace-title"><p className="eyebrow">Evidence beside object</p><h3>{selected.title}<br /><em>/ {activeFace}</em></h3></div>
          <div className="trace-steps">
            {trace.map((step) => (
              <article className="trace-step" key={step.stage}>
                <span className="trace-number">{step.stage}</span>
                <div><strong>{step.label}</strong><code>{step.code}</code><p>{step.detail}</p></div>
                {step.color && <i style={{ backgroundColor: step.color }} aria-label="Vermilion provenance colour" />}
              </article>
            ))}
          </div>
          <div className="trace-evidence">
            <div className="signature-label"><Fingerprint size={13} /> <MonoLabel>Colour signature</MonoLabel></div>
            <div className="palette-row" aria-label="Calculated palette signature">
              {selected.palette.map((color) => <span key={color} style={{ backgroundColor: color }} title={color} />)}
            </div>
            <dl>
              <div><dt>credential_signature</dt><dd>C2PA ABSENT · {selected.credentialSignature.sourceSha256.slice(0, 14)}…</dd></div>
              <div><dt>colour_signature</dt><dd>px:{selected.colourSignature.pixelSha256.slice(0, 12)}… · pal:{selected.colourSignature.paletteSha256.slice(0, 12)}…</dd></div>
              <div><dt>reverse_mode</dt><dd>{liveReverseMode}</dd></div>
              <div><dt>script_hash</dt><dd title={liveScriptHash}>{shortHash(liveScriptHash)}</dd></div>
              {liveIr ? <><div><dt>output_target</dt><dd>{liveIr.output.obverse}</dd></div><div><dt>manifest_target</dt><dd>{liveIr.output.manifest}</dd></div></> : <div><dt>output_sha256</dt><dd title={selected.outputHash}>{shortHash(selected.outputHash)}</dd></div>}
            </dl>
          </div>
        </aside>
      </section>

      <section className="manifest-strip" aria-label="Gallery manifest record">
        <div className="manifest-identity"><FileJson2 size={18} /><span>MANIFEST / PROCESS GRAPH</span></div>
        <div className="manifest-fields"><span>LIBRARY <b>5 COMPILED OBJECTS</b></span><span>ACTIVE FACE <b>{activeFace.toUpperCase()} · MUTUALLY EXCLUSIVE</b></span><span>CORE <b>RUST · robby-compiler-v0.1</b></span><span>EXECUTOR <b>{liveIr ? "STATIC ARTIFACT · RENDER PENDING" : "CPU · PILLOW / OPENCV"}</b></span></div>
        <img src="/manus-storage/robby-palette-study_ad20752b.png" alt="Abstract palette study" />
        <Sparkles className="manifest-spark" size={18} />
      </section>

      <footer className="site-footer">
        <p>The trace remains alongside the object, but the image has only one visible face. <em>Observation is a choice.</em></p>
        <span className="mono text-[10px]">RUST CORE ↔ PYTHON EXECUTOR / MANIFEST</span>
      </footer>
    </main>
  );
}
