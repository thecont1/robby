/**
 * ROBBY VISUAL SYSTEM — Contact-sheet archaeology.
 * A gallery of two-sided photographic objects. The central stage renders one
 * face only; its adjacent trace is evidence of the current object's making.
 * Build 05 adds a Rust/WASM workbench without replacing the approved gallery.
 */

import SourceEditor from "@/components/SourceEditor";
import { verifiedCompilerStatus } from "@/lib/compilerStatus";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useTheme } from "@/contexts/ThemeContext";
import { gallery, type TraceStep } from "@/lib/demoData";
import { footerSocialLinks } from "@/lib/footerLinks";
import { compileWithRust, type RobbyIr } from "@/lib/robbyCompiler";
import { isImageOnlyExitKey, swipeGalleryOffset, themeControlLabel } from "@/lib/visualModes";
import {
  Check,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  CircleDotDashed,
  Download,
  FileJson2,
  FileText,
  Fingerprint,
  FlipHorizontal2,
  RotateCcw,
  LockKeyhole,
  Menu,
  Lightbulb,
  Maximize2,
  Minimize2,
  ShieldCheck,
  ShieldX,
  Sparkles,
} from "lucide-react";
import { Link } from "wouter";
import { useEffect, useRef, useState } from "react";

function MonoLabel({ children }: { children: React.ReactNode }) {
  return <span className="mono-label">{children}</span>;
}

function SocialGlyph({ icon }: { icon: (typeof footerSocialLinks)[number]["icon"] }) {
  if (icon === "x") {
    return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18.9 2.25h3.68l-8.04 9.19L24 21.75h-7.41l-5.8-7.58-6.63 7.58H.48l8.6-9.83L0 2.25h7.6l5.25 6.94 6.05-6.94Zm-1.29 17.3h2.04L6.49 4.33H4.3L17.61 19.55Z" /></svg>;
  }

  if (icon === "linkedin") {
    return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5.37 3.36a2.13 2.13 0 1 1-4.26 0 2.13 2.13 0 0 1 4.26 0ZM1.46 8.1h3.82v12.29H1.46V8.1Zm6.22 0h3.66v1.68h.05c.51-.97 1.76-2 3.62-2 3.88 0 4.6 2.55 4.6 5.87v6.74h-3.82v-5.97c0-1.42-.03-3.24-1.97-3.24-1.98 0-2.29 1.54-2.29 3.14v6.07H7.68V8.1Z" /></svg>;
  }

  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 1.5a10.5 10.5 0 0 0-3.32 20.46c.53.1.72-.23.72-.51v-1.85c-2.94.64-3.56-1.25-3.56-1.25-.48-1.22-1.18-1.55-1.18-1.55-.96-.66.07-.65.07-.65 1.07.08 1.63 1.09 1.63 1.09.94 1.62 2.48 1.15 3.08.88.1-.69.37-1.15.67-1.42-2.35-.27-4.82-1.17-4.82-5.23 0-1.16.42-2.11 1.09-2.85-.11-.27-.47-1.35.1-2.81 0 0 .89-.29 2.89 1.09A9.96 9.96 0 0 1 12 6.6c.9 0 1.8.12 2.64.36 2-1.38 2.88-1.09 2.88-1.09.58 1.46.22 2.54.11 2.81.68.74 1.09 1.69 1.09 2.85 0 4.07-2.48 4.95-4.84 5.21.38.33.72.97.72 1.96v2.79c0 .28.19.61.73.51A10.5 10.5 0 0 0 12 1.5Z" /></svg>;
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

type ProjectionState = "gallery" | "draft" | "compiling" | "error" | "live";

export default function Home() {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [face, setFace] = useState<"obverse" | "inverse">("obverse");
  const [isFlipping, setIsFlipping] = useState(false);
  const [credentialOpen, setCredentialOpen] = useState(false);
  const [compilerState, setCompilerState] = useState<"checking" | "verified" | "error">("checking");
  const [compilerLabel, setCompilerLabel] = useState("RUST CORE · LOADING");
  const [compiledEdit, setCompiledEdit] = useState<{ specimenId: string; ir: RobbyIr; source: string } | null>(null);
  const [projectionState, setProjectionState] = useState<ProjectionState>("gallery");
  const [imageOnly, setImageOnly] = useState(false);
  const [artworkView, setArtworkView] = useState(false);
  const artworkTouchStartX = useRef<number | null>(null);
  const { theme, toggleTheme } = useTheme();
  const selected = gallery[selectedIndex];
  const hasEmbeddedCredential = selected.credentialSignature.status === "present";
  const activeFace = face;
  const liveIr = projectionState === "live" && compiledEdit?.specimenId === selected.id ? compiledEdit.ir : null;
  const projectionUnavailable = projectionState === "draft" || projectionState === "compiling" || projectionState === "error";
  const trace = projectionUnavailable ? [] : liveIr ? traceFromIr(liveIr) : selected.trace;
  const liveScriptHash = projectionUnavailable ? null : liveIr?.meta.script_sha256 ?? selected.scriptHash;
  const liveReverseMode = projectionUnavailable ? null : liveIr?.reverse.map((item) => item.k ? `${item.mode} (k=${item.k})` : item.mode).join(" + ") ?? selected.reverseMode;

  const selectImage = (nextIndex: number) => {
    if (isFlipping) return;
    setSelectedIndex((nextIndex + gallery.length) % gallery.length);
    setFace("obverse");
    setIsFlipping(false);
    setCredentialOpen(false);
    setCompiledEdit(null);
    setProjectionState("gallery");
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
      const target = event.target as HTMLElement | null;
      if (target?.isContentEditable || target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement) return;
      if (artworkView && event.key === "Escape") {
        setArtworkView(false);
        return;
      }
      if (imageOnly && isImageOnlyExitKey(event.key)) {
        setImageOnly(false);
        return;
      }
      if (event.key === "ArrowLeft") selectImage(selectedIndex - 1);
      if (event.key === "ArrowRight") selectImage(selectedIndex + 1);
      if (event.key.toLowerCase() === "f") turnOver();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [selectedIndex, isFlipping, imageOnly, artworkView]);

  useEffect(() => {
    let active = true;
    setCompilerState("checking");
    setCompilerLabel("RUST CORE · VERIFYING");

    compileWithRust(selected.script)
      .then(() => {
        if (!active) return;
        setCompilerState("verified");
        setCompilerLabel(verifiedCompilerStatus);
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
    setProjectionState("live");
    setFace("obverse");
  };

  const clearLiveProjection = () => {
    setCompiledEdit(null);
    setProjectionState("compiling");
  };

  const markProjectionUnavailable = () => {
    setCompiledEdit(null);
    setProjectionState("error");
  };

  const markDraftProjectionUnavailable = () => {
    setCompiledEdit(null);
    setProjectionState("draft");
  };

  const resetLiveProjection = () => {
    setCompiledEdit(null);
    setProjectionState("gallery");
  };

  const handleArtworkTouchStart = (event: React.TouchEvent<HTMLDivElement>) => {
    artworkTouchStartX.current = event.touches[0]?.clientX ?? null;
  };

  const handleArtworkTouchEnd = (event: React.TouchEvent<HTMLDivElement>) => {
    const startX = artworkTouchStartX.current;
    const endX = event.changedTouches[0]?.clientX;
    artworkTouchStartX.current = null;
    if (startX === null || endX === undefined) return;
    const offset = swipeGalleryOffset(startX, endX);
    if (offset === 0) return;
    selectImage(selectedIndex + offset);
  };

  return (
    <main className={`app-shell min-h-screen overflow-hidden bg-[#f4efe1] text-[#1c1a19]${imageOnly ? " image-only" : ""}`}>
      <header className="site-header">
        <a className="brand-lockup" href="#gallery" aria-label="robby gallery">
          <img src="/manus-storage/robby-registration-mark_658aceee.png" alt="robby split registration disc" />
          <span className="brand-copy">
            <span className="brand-title">robby <span className="brand-slash">/</span> <span className="brand-suffix">v1</span></span>
            <span className={`compile-status ${compilerState}`}>{compilerLabel}</span>
          </span>
        </a>
        <span className="header-product-subtitle">The Reverse-Obverse Image Duality Compiler</span>
        <div className="header-actions header-toolset">
          <button type="button" className="feature-control icon-control" onClick={toggleTheme} aria-label={themeControlLabel(theme)} aria-pressed={theme === "dark"} title={themeControlLabel(theme)}>
            <img src={theme === "light" ? "/manus-storage/thin-sunglasses_23303233.svg" : "/manus-storage/regular-sunglasses_28c9e1cf.svg"} alt="" />
          </button>
          <button type="button" className="feature-control icon-control image-only-toggle" onClick={() => setImageOnly((current) => !current)} aria-pressed={imageOnly} aria-label={imageOnly ? "Restore interface text" : "Enable image-only concentration mode"} title="Image-only concentration mode. Press Escape to return.">
            <img src={imageOnly ? "/manus-storage/text-hidden_1b455537.svg" : "/manus-storage/text-visible_5e9d8f58.svg"} alt="" />
          </button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button type="button" className="menu-control" aria-label="Open site menu" title="Site menu"><Menu size={18} strokeWidth={2.2} /></button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="robby-menu-content">
              <DropdownMenuItem asChild><Link href="/manual"><BookOpen size={17} /> Language manual</Link></DropdownMenuItem>
              <DropdownMenuItem asChild><Link href="/originals"><LockKeyhole size={17} /> Authentic originals</Link></DropdownMenuItem>
              <DropdownMenuItem asChild><Link href="/brief/hackathon"><FileText size={17} /> Hackathon brief</Link></DropdownMenuItem>
              <DropdownMenuItem asChild><Link href="/brief/image-object"><Lightbulb size={17} /> Image-object concept</Link></DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild><a href="https://github.com/thecont1/robby/archive/refs/heads/main.zip" target="_blank" rel="noreferrer"><Download size={17} /> Download Rust source</a></DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      <section className="gallery-intro" inert={imageOnly}>
        <div className="intro-copy">
          <h1><span className="headline-line headline-primary"><span className="headline-accent">Explainable</span> <span className="headline-ink">visual composition</span></span><em className="headline-line"><span className="headline-accent">compiler</span> <span className="headline-ink">in rust.</span></em></h1>
        </div>
        <div className="intro-note">
          <span className="note-rule" />
          <p>What if a digital image could be a two-sided image-object, like a post card or a coin?</p>
          <div className="intro-tools"><span className="mono text-[10px] tracking-[0.13em]">← → TO CYCLE · F TO FLIP</span></div>
        </div>
      </section>

      <section id="gallery" className="gallery-workspace" aria-label="robby image-object gallery">
        <section className="object-stage" aria-label={`${selected.title} ${activeFace} image-object`}>
          <div className={`two-sided-object ${selected.ratio}`} aria-busy={isFlipping}>
            <div className="object-turner" data-face={face} onTransitionEnd={settleFlip}>
              <div className="object-face object-face-obverse" aria-hidden={face !== "obverse"}>
                <img src={selected.obverse} alt={`${selected.title} obverse`} className="object-image" />
                <span className="face-stamp" aria-hidden="true">O</span>
              </div>
              <div className="object-face object-face-inverse" aria-hidden={face !== "inverse"}>
                <img src={selected.reverse} alt={`${selected.title} inverse: ${selected.reverseDescription}`} className="object-image" />
                <span className="face-stamp" aria-hidden="true">I</span>
              </div>
            </div>
            <span className="face-corner top-left" /><span className="face-corner top-right" /><span className="face-corner bottom-left" /><span className="face-corner bottom-right" />
            <button type="button" className="artwork-view-toggle" onClick={() => setArtworkView(true)} aria-label={`Open ${selected.title} in full-bleed artwork view`} title="Open full-bleed artwork view"><Maximize2 size={15} /></button>
          </div>

          <div className="stage-metadata" inert={imageOnly}>
            <div><MonoLabel>Selected image-object</MonoLabel><span className="object-serial">{selected.serial}</span></div>
            <span className="mono text-[10px]">{selected.dimensions} · {activeFace.toUpperCase()}</span>
          </div>

          <div className="stage-caption">
            <div className="caption-record" inert={imageOnly}>
              <div className="signature-row" aria-label="Specimen signatures">
                <div className="credential-wrap">
                  <button
                    type="button"
                    className={`credential-badge ${hasEmbeddedCredential ? "present" : "absent"}`}
                    onClick={() => setCredentialOpen((current) => !current)}
                    aria-expanded={credentialOpen}
                    aria-controls="credential-summary"
                  >
                    {hasEmbeddedCredential ? <ShieldCheck size={14} strokeWidth={2.2} /> : <ShieldX size={14} strokeWidth={2.2} />} {hasEmbeddedCredential ? "C2PA PRESENT" : "C2PA ABSENT"}
                  </button>
                  <div id="credential-summary" className={`credential-popover ${credentialOpen ? "open" : ""}`} role="status">
                    <strong>Credential signature</strong>
                    <p>{selected.credentialSignature.note}</p>
                    <dl>
                      <div><dt>issuer</dt><dd>{selected.credentialSignature.claimGenerator ?? "no embedded record"}</dd></div>
                      <div><dt>validation</dt><dd>{hasEmbeddedCredential ? "manifest present · trust warning" : "no embedded record"}</dd></div>
                      <div><dt>audit</dt><dd>{selected.credentialSignature.markerScan}</dd></div>
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
            <div className="caption-controls">
              <button type="button" className="flip-control" onClick={turnOver} disabled={isFlipping} aria-label={face === "inverse" ? `Return ${selected.title} to its obverse` : `Flip ${selected.title} to its inverse`}>
                {face === "inverse" ? <RotateCcw size={18} /> : <FlipHorizontal2 size={18} />}<span>{isFlipping ? "Turning object" : face === "inverse" ? "Return to obverse" : "Turn to inverse"}</span><small>F</small>
              </button>
              <div className="object-navigation"><button type="button" onClick={() => selectImage(selectedIndex - 1)} disabled={isFlipping} aria-label="Previous image"><ChevronLeft size={17} /> Previous</button><span className="navigation-current">{selected.serial}</span><button type="button" onClick={() => selectImage(selectedIndex + 1)} disabled={isFlipping} aria-label="Next image">Next <ChevronRight size={17} /></button></div>
            </div>
          </div>

          <nav className="bottom-filmstrip" aria-label="Gallery navigation" inert={imageOnly}>
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

        </section>

        <aside className="trace-panel" aria-label={`Compilation trace for ${selected.title}`} inert={imageOnly}>
          <div className="trace-heading"><div><CircleDotDashed size={15} /><MonoLabel>Compilation trace</MonoLabel></div><span>{projectionState === "draft" ? "DRAFT" : projectionState === "compiling" ? "VALIDATING" : projectionState === "error" ? "UNAVAILABLE" : `${trace.length} STEPS`}</span></div>
          <div className="trace-title"><p className="eyebrow">Evidence beside object</p><h3>{selected.title}<br /><em>/ {activeFace}</em></h3></div>
          {projectionUnavailable ? (
            <div className="projection-unavailable" role="status">
              <CircleDotDashed size={18} aria-hidden="true" />
              <div>
                <p className="mono-label">Live projection withheld</p>
                <strong>{projectionState === "draft" ? "The source changed after its last successful compile." : projectionState === "compiling" ? "Validating the current Rust source." : "The current source did not compile."}</strong>
                <p>{projectionState === "draft" ? "Previous trace, hash, and output targets are hidden until this draft is compiled." : projectionState === "compiling" ? "Previous trace, hash, and output targets are hidden until validation finishes." : "Previous trace, hash, and output targets remain hidden. Fix the source and compile again for a new projection."}</p>
              </div>
            </div>
          ) : (
            <div className="trace-steps">
              {trace.map((step) => (
                <article className="trace-step" key={step.stage}>
                  <span className="trace-number">{step.stage}</span>
                  <div><strong>{step.label}</strong><code>{step.code}</code><p>{step.detail}</p></div>
                  {step.color && <i style={{ backgroundColor: step.color }} aria-label="Vermilion provenance colour" />}
                </article>
              ))}
            </div>
          )}
          <div className="trace-evidence">
            {projectionUnavailable ? (
              <div className="projection-evidence-unavailable">
                <MonoLabel>Projection record</MonoLabel>
                <p>Unavailable for the submitted draft.</p>
              </div>
            ) : (
              <>
                <div className="signature-label"><Fingerprint size={13} /> <MonoLabel>Colour signature</MonoLabel></div>
                <div className="palette-row" aria-label="Calculated palette signature">
                  {selected.palette.map((color) => <span key={color} style={{ backgroundColor: color }} title={color} />)}
                </div>
                <dl>
                  <div><dt>credential_signature</dt><dd>{hasEmbeddedCredential ? "C2PA PRESENT" : "C2PA ABSENT"} · {selected.credentialSignature.sourceSha256.slice(0, 14)}…</dd></div>
                  <div><dt>colour_signature</dt><dd>px:{selected.colourSignature.pixelSha256.slice(0, 12)}… · pal:{selected.colourSignature.paletteSha256.slice(0, 12)}…</dd></div>
                  <div><dt>reverse_mode</dt><dd>{liveReverseMode}</dd></div>
                  <div><dt>script_hash</dt><dd title={liveScriptHash!}>{shortHash(liveScriptHash!)}</dd></div>
                  {liveIr ? (
                    <>
                      <div><dt>output_target</dt><dd>{liveIr.output.obverse}</dd></div>
                      <div><dt>manifest_target</dt><dd>{liveIr.output.manifest}</dd></div>
                    </>
                  ) : (
                    <div><dt>output_sha256</dt><dd title={selected.outputHash}>{shortHash(selected.outputHash)}</dd></div>
                  )}
                </dl>
              </>
            )}
          </div>
        </aside>
        <div className="source-workbench-wrap" inert={imageOnly}>
          <SourceEditor
            specimenId={selected.id}
            title={selected.title}
            source={selected.script}
            onCompiled={applyCompiledSource}
            onCompileStart={clearLiveProjection}
            onCompileError={markProjectionUnavailable}
            onDraftChange={markDraftProjectionUnavailable}
            onReset={resetLiveProjection}
          />
        </div>
      </section>

      <section className="manifest-strip" aria-label="Gallery manifest record" inert={imageOnly}>
        <div className="manifest-identity"><FileJson2 size={18} /><span>MANIFEST / PROCESS GRAPH</span></div>
        <div className="manifest-fields"><span>LIBRARY <b>5 COMPILED OBJECTS</b></span><span>ACTIVE FACE <b>{activeFace.toUpperCase()} · MUTUALLY EXCLUSIVE</b></span><span>CORE <b>RUST · robby-compiler-v0.1</b></span><span>EXECUTOR <b>{projectionUnavailable ? "LIVE IR · UNAVAILABLE" : liveIr ? "STATIC ARTIFACT · RENDER PENDING" : "CPU · PILLOW / OPENCV"}</b></span></div>
        <img src="/manus-storage/robby-palette-study_ad20752b.png" alt="Abstract palette study" />
        <Sparkles className="manifest-spark" size={18} />
      </section>

      <footer className="site-footer" inert={imageOnly}>
        <div className="footer-left">
          <p className="footer-observation"><em>Observation is a choice.</em></p>
          <nav className="footer-socials" aria-label="Mahesh Shantaram social links">
            {footerSocialLinks.map(link => (
              <a key={link.label} href={link.href} target="_blank" rel="noreferrer" aria-label={link.label} title={link.label}>
                <SocialGlyph icon={link.icon} />
              </a>
            ))}
          </nav>
        </div>
        <p className="footer-copyright">© 2026 <a href="https://thecontrarian.in/" target="_blank" rel="noreferrer">Mahesh Shantaram / thecontrarian.in</a></p>
      </footer>
      {artworkView && <div className="artwork-view" role="dialog" aria-modal="true" aria-label={`${selected.title} full-bleed artwork view`} onClick={() => setArtworkView(false)}>
        <div className="artwork-view-frame" onClick={event => event.stopPropagation()} onTouchStart={handleArtworkTouchStart} onTouchEnd={handleArtworkTouchEnd}>
          <img src={face === "obverse" ? selected.obverse : selected.reverse} alt={`${selected.title} ${face}`} />
          <div className="artwork-view-meta"><span>{selected.title} / {face}</span><span>SWIPE TO BROWSE · ESC TO CLOSE</span></div>
          <button type="button" onClick={() => setArtworkView(false)} aria-label="Close full-bleed artwork view" title="Close full-bleed artwork view"><Minimize2 size={19} /></button>
        </div>
      </div>}
    </main>
  );
}
