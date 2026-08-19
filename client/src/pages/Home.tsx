/**
 * ROBBY VISUAL SYSTEM — Contact-sheet archaeology.
 * A gallery of two-sided photographic objects. The central stage renders one
 * face only; its adjacent trace is evidence of the current object's making.
 * Build 05 adds a Rust/WASM workbench without replacing the approved gallery.
 */

import SourceEditor from "@/components/SourceEditor";
import { CompilationTraceModes, ProvenanceModule, type RuntimeRecord, type TraceMode } from "@/components/Build06Panels";
import { loadCompileHistory, persistCompileSnapshot, type CompileSnapshot } from "@/lib/compileHistory";
import { verifiedCompilerStatus } from "@/lib/compilerStatus";
import { requestEphemeralReverse, type EphemeralReverseResult } from "@/lib/liveRender";
import { createSignedRegistrarRecord, downloadSignedRegistrarJson, downloadSignedRegistrarPdf } from "@/lib/registrarExport";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useTheme } from "@/contexts/ThemeContext";
import { gallery, type CredentialSignature, type TraceStep } from "@/lib/demoData";
import { inspectC2paCredential } from "@/lib/c2paCredentials";
import { footerSocialLinks } from "@/lib/footerLinks";
import { compileWithRust, rustToolchainVersion, type RobbyIr } from "@/lib/robbyCompiler";
import { gallerySlideDirection, isImageOnlyExitKey, swipeGalleryOffset, themeControlLabel, type GallerySlideDirection } from "@/lib/visualModes";
import {
  BookOpen,
  ChevronLeft,
  ChevronRight,
  CircleDotDashed,
  Download,
  FileText,
  FlipHorizontal2,
  RotateCcw,
  LockKeyhole,
  Menu,
  Lightbulb,
  Maximize2,
  Minimize2,
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
  trace.push({ stage: String(trace.length + 1).padStart(2, "0"), label: "Prepare reverse record", code: `output(…${ir.output.manifest})`, detail: "ephemeral output · generated only when the inverse is requested" });
  return trace;
}

type ProjectionState = "gallery" | "draft" | "compiling" | "error" | "live";
type SlideTransition = { outgoingIndex: number; incomingIndex: number; direction: GallerySlideDirection };

export default function Home() {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [face, setFace] = useState<"obverse" | "inverse">("obverse");
  const [isFlipping, setIsFlipping] = useState(false);
  const [compilerState, setCompilerState] = useState<"checking" | "verified" | "error">("checking");
  const [compilerLabel, setCompilerLabel] = useState("RUST CORE · LOADING");
  const [compiledEdit, setCompiledEdit] = useState<{ specimenId: string; ir: RobbyIr; source: string } | null>(null);
  const [ephemeralReverse, setEphemeralReverse] = useState<{ specimenId: string; url: string; result: EphemeralReverseResult } | null>(null);
  const [projectionState, setProjectionState] = useState<ProjectionState>("gallery");
  const [traceMode, setTraceMode] = useState<TraceMode>("evidence");
  const [failureMessage, setFailureMessage] = useState<string | null>(null);
  const [runtimeRecord, setRuntimeRecord] = useState<RuntimeRecord | null>(null);
  const [historyReady, setHistoryReady] = useState(false);
  const [, setHistoryRevision] = useState(0);
  const [imageOnly, setImageOnly] = useState(false);
  const [artworkView, setArtworkView] = useState(false);
  const [slideTransition, setSlideTransition] = useState<SlideTransition | null>(null);
  const [credentialOverride, setCredentialOverride] = useState<CredentialSignature | null>(null);
  const [isRenderingReverse, setIsRenderingReverse] = useState(false);
  const artworkTouchStartX = useRef<number | null>(null);
  const compileHistory = useRef<Record<string, CompileSnapshot[]>>({});
  const reverseUrlRef = useRef<string | null>(null);
  const discardReverseAfterFlip = useRef(false);
  const { theme, toggleTheme } = useTheme();
  const selected = gallery[selectedIndex];
  const selectedWithCredential = credentialOverride ? { ...selected, credentialSignature: credentialOverride } : selected;
  const activeFace = face;
  const liveIr = projectionState === "live" && compiledEdit?.specimenId === selected.id ? compiledEdit.ir : null;
  const displayedObverse = selected.obverse;
  const displayedInverse = ephemeralReverse?.specimenId === selected.id ? ephemeralReverse.url : undefined;
  const projectionUnavailable = projectionState === "draft" || projectionState === "compiling" || projectionState === "error";
  const trace = projectionUnavailable ? [] : liveIr ? traceFromIr(liveIr) : selected.trace;
  const liveScriptHash = projectionUnavailable ? null : liveIr?.meta.script_sha256 ?? selected.scriptHash;
  const liveReverseMode = projectionUnavailable ? null : liveIr?.reverse.map((item) => item.k ? `${item.mode} (k=${item.k})` : item.mode).join(" + ") ?? selected.reverseMode;
  const currentHistory = compileHistory.current[selected.id] ?? [];
  const isSlideTransitioning = Boolean(slideTransition);

  useEffect(() => {
    let active = true;
    setCredentialOverride(null);
    void inspectC2paCredential(selected.source)
      .then(result => { if (active) setCredentialOverride(result); })
      .catch(() => { /* Retain C2PA CHECKING when the validator cannot complete. */ });
    return () => { active = false; };
  }, [selected.source]);

  const hashValue = async (value: string) => {
    const bytes = new TextEncoder().encode(value);
    const digest = await crypto.subtle.digest("SHA-256", bytes);
    return Array.from(new Uint8Array(digest)).map(byte => byte.toString(16).padStart(2, "0")).join("");
  };

  const discardEphemeralReverse = () => {
    if (reverseUrlRef.current) URL.revokeObjectURL(reverseUrlRef.current);
    reverseUrlRef.current = null;
    setEphemeralReverse(null);
  };

  useEffect(() => () => { if (reverseUrlRef.current) URL.revokeObjectURL(reverseUrlRef.current); }, []);

  useEffect(() => {
    let active = true;
    Promise.all(gallery.map(async item => [item.id, await loadCompileHistory(item.id)] as const))
      .then(entries => {
        if (!active) return;
        compileHistory.current = Object.fromEntries(entries);
        setHistoryRevision(current => current + 1);
        setHistoryReady(true);
      })
      .catch(() => {
        if (!active) return;
        compileHistory.current = {};
        setHistoryReady(true);
      });
    return () => { active = false; };
  }, []);

  const commitSelection = (nextIndex: number) => {
    discardEphemeralReverse();
    setSelectedIndex(nextIndex);
    setFace("obverse");
    setIsFlipping(false);
    setCompiledEdit(null);
    setProjectionState("gallery");
    setFailureMessage(null);
    setTraceMode("evidence");
    setRuntimeRecord(null);
  };

  const selectImage = (nextIndex: number) => {
    if (isFlipping || slideTransition) return;
    const normalizedIndex = (nextIndex + gallery.length) % gallery.length;
    if (normalizedIndex === selectedIndex) return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      commitSelection(normalizedIndex);
      return;
    }
    setSlideTransition({
      outgoingIndex: selectedIndex,
      incomingIndex: normalizedIndex,
      direction: gallerySlideDirection(selectedIndex, normalizedIndex, gallery.length),
    });
  };

  const turnOver = async () => {
    if (isFlipping || isRenderingReverse) return;
    if (face === "inverse") {
      discardReverseAfterFlip.current = true;
      setIsFlipping(true);
      setFace("obverse");
      return;
    }

    setIsRenderingReverse(true);
    setFailureMessage(null);
    try {
      const source = compiledEdit?.specimenId === selected.id ? compiledEdit.source : selected.script;
      const ir = await compileWithRust(source);
      const result = await requestEphemeralReverse(ir);
      const url = URL.createObjectURL(result.blob);
      if (reverseUrlRef.current) URL.revokeObjectURL(reverseUrlRef.current);
      reverseUrlRef.current = url;
      setEphemeralReverse({ specimenId: selected.id, url, result });
      const compiledAt = new Date().toISOString();
      const irHash = await hashValue(JSON.stringify(ir));
      setCompiledEdit({ specimenId: selected.id, ir, source });
      setProjectionState("live");
      setRuntimeRecord(current => ({ compiledAt, irHash, toolchain: current?.toolchain ?? "RUST/WASM", transientReverse: { generatedAt: compiledAt, outputSha256: result.outputSha256, sourceSha256: result.sourceSha256, mode: result.reverseMode } }));
      setIsFlipping(true);
      setFace("inverse");
    } catch (error) {
      setFailureMessage(error instanceof Error ? error.message : "The live compiler could not generate this inverse.");
    } finally {
      setIsRenderingReverse(false);
    }
  };

  const settleFlip = (event: React.TransitionEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget && event.propertyName === "transform") {
      setIsFlipping(false);
      if (discardReverseAfterFlip.current) {
        discardReverseAfterFlip.current = false;
        discardEphemeralReverse();
      }
    }
  };

  const settleStageSlide = (event: React.AnimationEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget || !slideTransition) return;
    // The slide-in animation is longer (190ms vs 150ms), so it ends last.
    // Only commit when the slide-in animation completes.
    if (event.animationName.includes("slide-track")) {
      commitSelection(slideTransition.incomingIndex);
      setSlideTransition(null);
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
  }, [selectedIndex, isFlipping, slideTransition, imageOnly, artworkView]);

  useEffect(() => {
    if (!historyReady) return;
    let active = true;
    setCompilerState("checking");
    setCompilerLabel("RUST CORE · VERIFYING");
    setRuntimeRecord(null);

    Promise.all([compileWithRust(selected.script), rustToolchainVersion()])
      .then(async ([ir, toolchain]) => {
        if (!active) return;
        const compiledAt = new Date().toISOString();
        const irHash = await hashValue(JSON.stringify(ir));
        if (!active) return;
        const baseline: CompileSnapshot = { id: `${selected.id}-${irHash}`, specimenId: selected.id, source: selected.script, ir, trace: traceFromIr(ir), compiledAt, irHash, origin: "baseline" };
        if (!compileHistory.current[selected.id]?.length) {
          const persistedHistory = await persistCompileSnapshot(baseline);
          if (!active) return;
          compileHistory.current[selected.id] = persistedHistory;
          setHistoryRevision(current => current + 1);
        }
        setCompilerState("verified");
        setCompilerLabel(verifiedCompilerStatus(toolchain));
        setRuntimeRecord({ compiledAt, irHash, toolchain });
      })
      .catch(() => {
        if (!active) return;
        setCompilerState("error");
        setCompilerLabel("RUST CORE · CHECK FAILED");
      });

    return () => {
      active = false;
    };
  }, [selected.id, selected.script, historyReady]);

  const applyCompiledSource = async (ir: RobbyIr, source: string) => {
    const compiledAt = new Date().toISOString();
    const irHash = await hashValue(JSON.stringify(ir));
    const snapshot: CompileSnapshot = { id: `${selected.id}-${irHash}`, specimenId: selected.id, source, ir, trace: traceFromIr(ir), compiledAt, irHash, origin: "editor" };
    compileHistory.current[selected.id] = await persistCompileSnapshot(snapshot);
    setHistoryRevision(current => current + 1);
    setCompiledEdit({ specimenId: selected.id, ir, source });
    setProjectionState("live");
    setFace("obverse");
    setFailureMessage(null);
    setRuntimeRecord(current => ({ compiledAt, irHash, toolchain: current?.toolchain ?? "RUST/WASM" }));
  };

  const clearLiveProjection = () => {
    setCompiledEdit(null);
    discardEphemeralReverse();
    setProjectionState("compiling");
    setFailureMessage(null);
  };

  const markProjectionUnavailable = (message: string) => {
    setCompiledEdit(null);
    discardEphemeralReverse();
    setProjectionState("error");
    setFailureMessage(message);
  };

  const markDraftProjectionUnavailable = () => {
    setCompiledEdit(null);
    discardEphemeralReverse();
    setProjectionState("draft");
    setFailureMessage(null);
  };

  const resetLiveProjection = () => {
    setCompiledEdit(null);
    discardEphemeralReverse();
    setProjectionState("gallery");
    setFailureMessage(null);
  };

  const focusReverseStep = () => {
    setTraceMode("evidence");
    const reverseStage = trace.find(step => step.code.startsWith("reverse("))?.stage;
    if (!reverseStage) return;
    requestAnimationFrame(() => document.getElementById(`trace-step-${reverseStage}`)?.scrollIntoView({ behavior: "smooth", block: "center" }));
  };

  const exportRegistrar = async (format: "json" | "pdf") => {
    const record = await createSignedRegistrarRecord({ item: selected, runtime: runtimeRecord, history: compileHistory.current[selected.id] ?? [] });
    const filename = `robby-${selected.id}-registrar-${record.issuedAt.replaceAll(":", "-")}`;
    if (format === "json") downloadSignedRegistrarJson(record, filename);
    else await downloadSignedRegistrarPdf(record, filename);
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
          <p>What if a digital image could be a two-sided image-object, like a postcard or a coin?</p>
          <div className="intro-tools"><span className="mono text-[10px] tracking-[0.13em]">← → TO CYCLE · F TO FLIP</span></div>
        </div>
      </section>

      <section id="gallery" className="gallery-workspace" aria-label="robby image-object gallery">
        <section className="object-stage" aria-label={`${selected.title} ${activeFace} image-object`}>
          <div className="artwork-stage-frame">
            <span className="stage-corner top-left" aria-hidden="true" /><span className="stage-corner top-right" aria-hidden="true" /><span className="stage-corner bottom-left" aria-hidden="true" /><span className="stage-corner bottom-right" aria-hidden="true" />
            <div className="artwork-stage-viewport">
              {slideTransition ? (
                <div className={`slide-track slide-track-${slideTransition.direction}`} onAnimationEnd={settleStageSlide}>
                  {slideTransition.direction === "forward" ? (
                    <>
                      <div className={`two-sided-object ${gallery[slideTransition.outgoingIndex].ratio} slide-track-item`} aria-hidden="true">
                        <div className="object-turner" data-face={face}>
                          <div className="object-face object-face-obverse" aria-hidden={face !== "obverse"}>
                            <img src={displayedObverse} alt="" className="object-image" />
                          </div>
                          <div className="object-face object-face-inverse" aria-hidden={face !== "inverse"}>
                            {displayedInverse && <img src={displayedInverse} alt="" className="object-image" />}
                          </div>
                        </div>
                      </div>
                      <div className={`two-sided-object ${gallery[slideTransition.incomingIndex].ratio} slide-track-item`} aria-busy>
                        <div className="object-turner" data-face="obverse">
                          <div className="object-face object-face-obverse" aria-hidden={false}>
                            <img src={gallery[slideTransition.incomingIndex].obverse} alt={`${gallery[slideTransition.incomingIndex].title} obverse`} className="object-image" />
                          </div>
                          <div className="object-face object-face-inverse" aria-hidden={true}>
                            <img src={gallery[slideTransition.incomingIndex].reverse} alt="" className="object-image" />
                          </div>
                        </div>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className={`two-sided-object ${gallery[slideTransition.incomingIndex].ratio} slide-track-item`} aria-busy>
                        <div className="object-turner" data-face="obverse">
                          <div className="object-face object-face-obverse" aria-hidden={false}>
                            <img src={gallery[slideTransition.incomingIndex].obverse} alt={`${gallery[slideTransition.incomingIndex].title} obverse`} className="object-image" />
                          </div>
                          <div className="object-face object-face-inverse" aria-hidden={true}>
                            <img src={gallery[slideTransition.incomingIndex].reverse} alt="" className="object-image" />
                          </div>
                        </div>
                      </div>
                      <div className={`two-sided-object ${gallery[slideTransition.outgoingIndex].ratio} slide-track-item`} aria-hidden="true">
                        <div className="object-turner" data-face={face}>
                          <div className="object-face object-face-obverse" aria-hidden={face !== "obverse"}>
                            <img src={displayedObverse} alt="" className="object-image" />
                          </div>
                          <div className="object-face object-face-inverse" aria-hidden={face !== "inverse"}>
                            <img src={displayedInverse} alt="" className="object-image" />
                          </div>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              ) : (
                <div className={`two-sided-object ${selected.ratio}`} aria-busy={isFlipping} onAnimationEnd={settleStageSlide}>
                  <div className="object-turner" data-face={face} onTransitionEnd={settleFlip}>
                    <div className="object-face object-face-obverse" aria-hidden={face !== "obverse"}>
                      <img src={displayedObverse} alt={`${selected.title} obverse`} className="object-image" />
                    </div>
                    <div className="object-face object-face-inverse" aria-hidden={face !== "inverse"}>
                      <img src={displayedInverse} alt={`${selected.title} inverse: ${selected.reverseDescription}`} className="object-image" />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="stage-caption">
            <div className="stage-control-row">
              <div className="stage-metadata" inert={imageOnly}>
                <div className="stage-display-tools">
                  <span className="stage-face-record"><MonoLabel>{activeFace}</MonoLabel><span aria-hidden="true">·</span><span className="mono stage-dimensions">{selected.dimensions}</span></span>
                  <button type="button" className="artwork-view-control" onClick={() => setArtworkView(true)} aria-label={`Open ${selected.title} in full-bleed artwork view`} title="Open full-bleed artwork view"><Maximize2 size={15} /></button>
                </div>
              </div>
              <div className="caption-turn">
                <button type="button" className="flip-control" onClick={() => void turnOver()} disabled={isFlipping || isRenderingReverse} aria-label={face === "inverse" ? `Return ${selected.title} to its obverse` : `Compile and turn ${selected.title} to its inverse`}>
                  {face === "inverse" ? <RotateCcw size={18} /> : <FlipHorizontal2 size={18} />}<span>{isRenderingReverse ? "Compiling inverse" : isFlipping ? "Turning object" : face === "inverse" ? "Return to obverse" : "Turn to inverse"}</span><small>F</small>
                </button>
              </div>
              <div className="caption-navigation">
                <div className="object-navigation"><button type="button" onClick={() => selectImage(selectedIndex - 1)} disabled={isFlipping} aria-label="Previous image"><ChevronLeft size={17} /> Previous</button><span className="navigation-current">{selected.serial}</span><button type="button" onClick={() => selectImage(selectedIndex + 1)} disabled={isFlipping} aria-label="Next image">Next <ChevronRight size={17} /></button></div>
              </div>
            </div>
          </div>

          <nav className="bottom-filmstrip" aria-label="Gallery navigation" inert={imageOnly}>
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
          <div className="trace-title"><p className="eyebrow">Evidence beside object</p><h3>{selected.source}<br /><em>/ {activeFace}</em></h3></div>
          <CompilationTraceModes item={selectedWithCredential} trace={trace} activeMode={traceMode} onModeChange={setTraceMode} projectionState={projectionState} failureMessage={failureMessage} history={currentHistory} runtime={runtimeRecord} onExportRegistrar={exportRegistrar} />
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

      <div inert={imageOnly}><ProvenanceModule item={selectedWithCredential} runtime={runtimeRecord} onFocusReverse={focusReverseStep} /></div>

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
          <div className="artwork-view-image-viewport"><img src={face === "obverse" ? displayedObverse : displayedInverse} alt={`${selected.title} ${face}`} /></div>
          <div className="artwork-view-controls"><div className="artwork-view-meta"><span>{selected.title} / {face}</span><span>SWIPE TO BROWSE · ESC TO CLOSE</span></div><button type="button" onClick={() => setArtworkView(false)} aria-label="Close full-bleed artwork view" title="Close full-bleed artwork view"><Minimize2 size={19} /></button></div>
        </div>
      </div>}
    </main>
  );
}
