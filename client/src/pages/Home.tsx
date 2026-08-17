/**
 * ROBBY VISUAL SYSTEM — Contact-sheet archaeology.
 * A gallery of two-sided photographic objects. The central stage renders one
 * face only; its adjacent trace is evidence of the current object's making.
 */

import { gallery } from "@/lib/demoData";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronLeft,
  ChevronRight,
  CircleDotDashed,
  Code2,
  FileJson2,
  FlipHorizontal2,
  Layers3,
  RotateCcw,
  ScanLine,
  Sparkles,
} from "lucide-react";
import { useEffect, useState } from "react";

function MonoLabel({ children }: { children: React.ReactNode }) {
  return <span className="mono-label">{children}</span>;
}

export default function Home() {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isInverse, setIsInverse] = useState(false);
  const [isTurning, setIsTurning] = useState(false);
  const selected = gallery[selectedIndex];
  const activeFace = isInverse ? "inverse" : "obverse";
  const activeImage = isInverse ? selected.reverse : selected.obverse;

  const selectImage = (nextIndex: number) => {
    setSelectedIndex((nextIndex + gallery.length) % gallery.length);
    setIsInverse(false);
    setIsTurning(false);
  };

  const turnOver = () => {
    setIsTurning(true);
    setIsInverse((current) => !current);
  };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "ArrowLeft") selectImage(selectedIndex - 1);
      if (event.key === "ArrowRight") selectImage(selectedIndex + 1);
      if (event.key.toLowerCase() === "f") turnOver();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [selectedIndex]);

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
        <div className="compile-status"><Check size={13} strokeWidth={3} /> COMPILED LIBRARY</div>
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
        <aside className="gallery-rail" aria-label="Gallery navigation">
          <div className="rail-heading"><MonoLabel>Image library</MonoLabel><span>{selected.serial}</span></div>
          <ol className="gallery-list">
            {gallery.map((item, index) => (
              <li key={item.id}>
                <button
                  type="button"
                  className={index === selectedIndex ? "gallery-thumb selected" : "gallery-thumb"}
                  onClick={() => selectImage(index)}
                  aria-current={index === selectedIndex ? "true" : undefined}
                  aria-label={`Select ${item.title}`}
                >
                  <img src={item.obverse} alt="" />
                  <span><b>{String(index + 1).padStart(2, "0")}</b><em>{item.title}</em></span>
                </button>
              </li>
            ))}
          </ol>
          <div className="rail-foot"><span className="rail-line" /><p>All faces are compiler artifacts. Navigate an obverse; turn it over only when you choose.</p></div>
        </aside>

        <section className="object-stage" aria-labelledby="object-title">
          <div className="stage-topline">
            <div><MonoLabel>Selected image-object</MonoLabel><span className="object-serial">{selected.serial}</span></div>
            <span className="mono text-[10px]">{selected.dimensions} · {activeFace.toUpperCase()}</span>
          </div>

          <div className={`two-sided-object ${selected.ratio} ${isTurning ? "turning" : ""}`} onAnimationEnd={() => setIsTurning(false)}>
            <img
              src={activeImage}
              alt={isInverse ? `${selected.title} inverse: ${selected.reverseDescription}` : `${selected.title} obverse`}
              className="object-image"
            />
            <span className="face-stamp">{isInverse ? "I" : "O"}</span>
            <span className="face-corner top-left" /><span className="face-corner top-right" /><span className="face-corner bottom-left" /><span className="face-corner bottom-right" />
          </div>

          <div className="stage-caption">
            <div>
              <p className="caption-face">{isInverse ? selected.reverseKind : "Obverse"}</p>
              <h2 id="object-title">{selected.title}</h2>
              <p className="caption-detail">{isInverse ? selected.reverseDescription : selected.subtitle}</p>
            </div>
            <button type="button" className="flip-control" onClick={turnOver} aria-label={isInverse ? `Return ${selected.title} to its obverse` : `Flip ${selected.title} to its inverse`}>
              {isInverse ? <RotateCcw size={18} /> : <FlipHorizontal2 size={18} />}
              <span>{isInverse ? "Return to obverse" : "Turn to inverse"}</span>
              <small>F</small>
            </button>
          </div>

          <div className="stage-navigation">
            <button type="button" onClick={() => selectImage(selectedIndex - 1)} aria-label="Previous image"><ChevronLeft size={17} /> Previous</button>
            <span className="navigation-current">{selected.serial}</span>
            <button type="button" onClick={() => selectImage(selectedIndex + 1)} aria-label="Next image">Next <ChevronRight size={17} /></button>
          </div>
        </section>

        <aside className="trace-panel" aria-label={`Compilation trace for ${selected.title}`}>
          <div className="trace-heading"><div><CircleDotDashed size={15} /><MonoLabel>Compilation trace</MonoLabel></div><span>{selected.trace.length} STEPS</span></div>
          <div className="trace-title"><p className="eyebrow">Evidence beside object</p><h3>{selected.title}<br /><em>/ {activeFace}</em></h3></div>
          <div className="trace-steps">
            {selected.trace.map((step) => (
              <article className="trace-step" key={step.stage}>
                <span className="trace-number">{step.stage}</span>
                <div><strong>{step.label}</strong><code>{step.code}</code><p>{step.detail}</p></div>
                {step.color && <i style={{ backgroundColor: step.color }} aria-label="Vermilion provenance colour" />}
              </article>
            ))}
          </div>
          <div className="trace-evidence">
            <div className="palette-row" aria-label="Calculated palette">
              {selected.palette.map((color) => <span key={color} style={{ backgroundColor: color }} title={color} />)}
            </div>
            <dl><div><dt>Script hash</dt><dd>{selected.scriptHash}</dd></div><div><dt>Output</dt><dd>{selected.outputHash}</dd></div></dl>
          </div>
        </aside>
      </section>

      <section className="manifest-strip" aria-label="Gallery manifest record">
        <div className="manifest-identity"><FileJson2 size={18} /><span>MANIFEST / PROCESS GRAPH</span></div>
        <div className="manifest-fields"><span>LIBRARY <b>5 COMPILED OBJECTS</b></span><span>ACTIVE FACE <b>{activeFace.toUpperCase()} · MUTUALLY EXCLUSIVE</b></span><span>EXECUTOR <b>CPU · PILLOW / OPENCV</b></span></div>
        <img src="/manus-storage/robby-palette-study_ad20752b.png" alt="Abstract palette study" />
        <Sparkles className="manifest-spark" size={18} />
      </section>

      <footer className="site-footer">
        <p>The trace remains alongside the object, but the image has only one visible face. <em>Observation is a choice.</em></p>
        <span className="mono text-[10px]">OBVERSE ↔ INVERSE / MANIFEST</span>
      </footer>
    </main>
  );
}

