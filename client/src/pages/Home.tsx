/**
 * ROBBY VISUAL SYSTEM — Contact-sheet archaeology.
 * A gallery of two-sided photographic objects. The central stage renders one
 * face only; its adjacent trace is evidence of the current object's making.
 * Build 05 adds a Rust/WASM workbench without replacing the approved gallery.
 */

import SourceEditor from "@/components/SourceEditor";
import TeppanyakiCounter from "@/components/TeppanyakiCounter";
import { ProvenanceModule, type RuntimeRecord, type TraceMode } from "@/components/Build06Panels";
import { loadCompileHistory, persistCompileSnapshot, type CompileSnapshot } from "@/lib/compileHistory";
import { compileActions } from "@/lib/compileActions";
import { browserCompileController } from "@/lib/compileBrowser";
import type { CompileRun } from "@/lib/compileEvents";
import { verifiedCompilerStatus } from "@/lib/compilerStatus";
import { paletteKFromSource } from "@/lib/paletteSettings";
import { authoredRecipeForCompile, editPaletteInRecipe, isCompiledSourceCurrent, reverseModeFromSource } from "@/lib/recipeAuthority";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useTheme } from "@/contexts/ThemeContext";
import { type CredentialSignature, type TraceStep, type GalleryItem } from "@/lib/demoData";
import { useGallery } from "@/lib/useGallery";
import { createRecipeDraftStore } from "@/lib/recipeDrafts";
import { footerSocialLinks } from "@/lib/footerLinks";
import { rustToolchainVersion, type RobbyIr } from "@/lib/robbyCompiler";
import { gallerySlideDirection, isImageOnlyExitKey, swipeGalleryOffset, themeControlLabel, type GallerySlideDirection } from "@/lib/visualModes";
import { artworkModalKeyAction, focusableArtworkSelector } from "@/lib/artworkModal";
import {
  BookOpen,
  ChevronLeft,
  ChevronRight,
  CircleDotDashed,
  Download,
  FileText,
  FlipHorizontal2,
  RotateCcw,

  Menu,
  Lightbulb,
  Maximize2,
  Minimize2,
} from "lucide-react";
import { Link } from "wouter";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

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
  trace.push({ stage: "02", label: "Calculate palette", code: `palette(k: ${ir.palette.k})`, detail: "deterministic RGB clusters" });
  trace.push({ stage: "03", label: "Render reverse", code: `reverse(mode: "${ir.reverse.mode}")`, detail: "seed-driven registered module" });
  trace.push({ stage: String(trace.length + 1).padStart(2, "0"), label: "Prepare reverse record", code: `output(…${ir.output.manifest})`, detail: "ephemeral output · generated only when the inverse is requested" });
  return trace;
}

type ProjectionState = "gallery" | "draft" | "compiling" | "error" | "live";
type SlideTransition = { outgoingId: string; incomingId: string; incomingIndex: number; direction: GallerySlideDirection };

export default function Home() {
  const { items: gallery, loading: galleryLoading } = useGallery();
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [face, setFace] = useState<"obverse" | "inverse">("obverse");
  const [isFlipping, setIsFlipping] = useState(false);
  const [compilerState, setCompilerState] = useState<"checking" | "verified" | "error">("checking");
  const [compilerLabel, setCompilerLabel] = useState("RUST CORE · LOADING");
  const [compiledEdit, setCompiledEdit] = useState<{ specimenId: string; ir: RobbyIr; source: string } | null>(null);
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
  const [paletteK, setPaletteK] = useState(8);
  const [compileRun, setCompileRun] = useState<CompileRun | null>(null);
  // The draft store is a ref (see `selectedDraft` below) so reads during render
  // never lag a commit. A ref mutation does not re-render on its own, so every
  // write to the store must bump this revision to commit the new authored text
  // to the screen. It is a commit signal, not data: read `selectedDraft` for
  // the actual source.
  const [, commitDraftRevision] = useState(0);
  const bumpDraftRevision = useCallback(() => commitDraftRevision(revision => revision + 1), []);
  const draftStore = useRef(createRecipeDraftStore());
  // Derive the structured palette control from authored text. `fallback` is
  // what to show when the text is not parseable: on a specimen switch we reset
  // to the language default (8), but while the user is mid-edit we keep the
  // last valid value rather than snapping the control around.
  const setPaletteKFromDraft = useCallback((draft: string, fallback?: number) => {
    try {
      setPaletteK(paletteKFromSource(draft));
    } catch {
      if (fallback !== undefined) setPaletteK(fallback);
    }
  }, []);
  const artworkTouchStartX = useRef<number | null>(null);
  const artworkViewRef = useRef<HTMLDivElement>(null);
  const appShellRef = useRef<HTMLElement>(null);
  const mainContentRef = useRef<HTMLElement>(null);
  const artworkOpenerRef = useRef<HTMLButtonElement>(null);
  const compileHistory = useRef<Record<string, CompileSnapshot[]>>({});
  const selectedIdRef = useRef("");
  const selectedRecipeRef = useRef({ specimenId: "", source: "" });
  const paletteReprocessTimer = useRef<number | null>(null);
  const mountedRef = useRef(true);
  const discardReverseAfterFlip = useRef(false);
  const { theme, toggleTheme } = useTheme();

  const clearPaletteReprocessTimer = () => {
    if (paletteReprocessTimer.current !== null) {
      window.clearTimeout(paletteReprocessTimer.current);
      paletteReprocessTimer.current = null;
    }
  };

  // Clamp selectedIndex when gallery changes (e.g. images added/removed)
  useEffect(() => {
    if (gallery.length === 0) return;
    if (selectedIndex >= gallery.length) {
      setSelectedIndex(gallery.length - 1);
    }
  }, [gallery.length, selectedIndex]);

  const safeIndex = gallery.length > 0 ? Math.min(selectedIndex, gallery.length - 1) : 0;
  const selected: GalleryItem = gallery[safeIndex] ?? {
    id: "", serial: "", title: "", subtitle: "", date: "", source: "",
    dimensions: "", ratio: "four-three", obverse: "", reverse: "",
    reverseMode: "negative", reverseKind: "", reverseDescription: "",
    scriptHash: "", outputHash: "", palette: [], trace: [], script: "",
    credentialSignature: { status: "absent", sourceSha256: "", verificationMethod: "", note: "" },
    colourSignature: { pixelSha256: "", paletteSha256: "", algorithm: "" },
  };
  const selectedWithCredential = credentialOverride ? { ...selected, credentialSignature: credentialOverride } : selected;
  const activeFace = face;
  const liveIr = projectionState === "live" && compiledEdit?.specimenId === selected.id ? compiledEdit.ir : null;
  const displayedObverse = selected.obverse;
  const displayedInverse = compileRun?.galleryItemId === selected.id ? compileRun.result?.reverseObjectUrl : undefined;
  // The draft store is the authority for "what source is this specimen
  // showing". Reading the ref directly by the selected id (rather than
  // mirroring it into state, which would lag a render behind a selection
  // change) keeps the visible editor source and the compileOrio input
  // identical when returning to a specimen that was edited earlier in the
  // session. Every write to the store bumps the draft revision above so the
  // new text is actually committed to the screen.
  const selectedDraft = draftStore.current.get(selected.id, selected.script);
  // The selected specimen's stored draft is the single authored-source
  // authority for BOTH editor display and Compile Orio input. A previously
  // compiled projection may describe that draft, but must never replace it.
  const activeRecipe = selectedDraft;
  const recipeChanged = Boolean(compileRun?.result && compileRun.recipeSource !== activeRecipe);
  const actions = compileActions({
    run: compileRun?.galleryItemId === selected.id ? compileRun : null,
    recipeChanged,
    face,
    isRendering: isRenderingReverse,
  });
  const projectionUnavailable = projectionState === "draft" || projectionState === "compiling" || projectionState === "error";
  const trace = projectionUnavailable ? [] : liveIr ? traceFromIr(liveIr) : selected.trace;
  // What reverse module the currently visible authored recipe declares: prefer
  // the current compile result, then parse the selected draft, then fall back
  // to the specimen metadata. This keeps the provenance command synchronized
  // immediately after editing, before validation or rendering finishes.
  const activeReverseMode = compileRun?.galleryItemId === selected.id && compileRun.recipeSource === activeRecipe
    ? compileRun.result?.renderModule ?? reverseModeFromSource(activeRecipe, selected.reverseMode)
    : reverseModeFromSource(activeRecipe, selected.reverseMode);

  // Synchronised during commit, not during render: compile notifications can
  // arrive synchronously, and a render-phase assignment would either be stale
  // (a render that never commits) or a side effect in render. useLayoutEffect
  // runs before paint and before any subscriber can read the ref.
  useLayoutEffect(() => {
    selectedIdRef.current = selected.id;
    selectedRecipeRef.current = { specimenId: selected.id, source: activeRecipe };
  }, [selected.id, activeRecipe]);

  useEffect(() => {
    const draft = draftStore.current.get(selected.id, selected.script);
    setPaletteKFromDraft(draft, 8);
    bumpDraftRevision();
    setCompileRun(current => current?.galleryItemId === selected.id ? current : null);
    setCredentialOverride(null);
  }, [selected.id, selected.script, setPaletteKFromDraft, bumpDraftRevision]);

  const hashValue = async (value: string) => {
    const bytes = new TextEncoder().encode(value);
    const digest = await crypto.subtle.digest("SHA-256", bytes);
    return Array.from(new Uint8Array(digest)).map(byte => byte.toString(16).padStart(2, "0")).join("");
  };

  const discardSessionReverse = () => {
    browserCompileController.cancelActive();
    setCompileRun(null);
    setIsRenderingReverse(false);
  };

  useEffect(() => browserCompileController.subscribe(run => {
    if (run.galleryItemId !== selectedIdRef.current) return;
    setCompileRun(run);
    if (run.status === "running") setIsRenderingReverse(true);
    if (run.status !== "running") setIsRenderingReverse(false);
  }), []);

  // Plan 9B: on unmount, cancel any running compile and revoke every session
  // Blob URL so nothing leaks across navigation.
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      clearPaletteReprocessTimer();
      browserCompileController.dispose();
    };
  }, []);

  useEffect(() => {
    if (gallery.length === 0) return;
    let active = true;
    setHistoryReady(false);
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
  }, [gallery.length > 0]);

  const commitSelection = (nextIndex: number) => {
    clearPaletteReprocessTimer();
    discardSessionReverse();
    // Reject outgoing notifications immediately. The committed render's
    // layout effect installs the real incoming id/source; avoiding an indexed
    // gallery read here also survives gallery mutations mid-animation.
    selectedIdRef.current = "";
    selectedRecipeRef.current = { specimenId: "", source: "" };
    setSelectedIndex(nextIndex);
    setFace("obverse");
    setIsFlipping(false);
    setCompiledEdit(null);
    setProjectionState("gallery");
    setFailureMessage(null);
    setTraceMode("evidence");
    setRuntimeRecord(current => current ? { compiledAt: current.compiledAt, irHash: current.irHash, toolchain: current.toolchain } : null);
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
      outgoingId: selected.id,
      incomingId: gallery[normalizedIndex].id,
      incomingIndex: normalizedIndex,
      direction: gallerySlideDirection(selectedIndex, normalizedIndex, gallery.length),
    });
  };

  const compileOrio = async (force = false) => {
    clearPaletteReprocessTimer();
    if (isFlipping || isRenderingReverse) return;
    const compiledSpecimenId = selected.id;
    const source = authoredRecipeForCompile(activeRecipe);
    setFailureMessage(null);
    setIsRenderingReverse(true);
    setProjectionState("compiling");
    const run = await browserCompileController.compile({
      galleryItemId: compiledSpecimenId,
      sourceName: selected.source,
      sourceUrl: selected.obverse,
      recipeSource: source,
    }, { force });
    const currentAuthority = selectedRecipeRef.current;
    if (!isCompiledSourceCurrent(compiledSpecimenId, source, currentAuthority.specimenId, currentAuthority.source)) return;
    setCompileRun(run);
    if (run.status !== "completed" || !run.result) {
      setProjectionState("error");
      setFailureMessage(run.diagnostic ?? "The live compiler could not generate this inverse.");
      return;
    }
    const orio = run.result;
    setProjectionState("live");
    setRuntimeRecord(current => ({
      compiledAt: orio.createdAt,
      irHash: orio.canonicalRecipeHash,
      toolchain: current?.toolchain ?? "RUST/WASM",
      c2paEvidence: orio.c2paEvidence,
      transientReverse: {
        generatedAt: orio.createdAt,
        outputSha256: orio.reverseOutputSha256,
        sourceSha256: orio.sourceByteSha256,
        mode: orio.renderModule,
        seed: orio.derivedSeed,
        settingsSha256: orio.canonicalRecipeHash,
        swatches: orio.colourSwatches,
      },
    }));
  };

  // Memoized so the keydown effect below re-binds whenever the compilation
  // state this handler captures changes. Without it, the F shortcut keeps
  // calling a closure created before the run completed and silently no-ops.
  const turnOver = useCallback(async () => {
    if (isFlipping || !actions.turnEnabled) return;
    if (face === "inverse") {
      discardReverseAfterFlip.current = false;
      setIsFlipping(true);
      setFace("obverse");
      return;
    }
    if (!compileRun?.result) return;
    setIsFlipping(true);
    setFace("inverse");
  }, [isFlipping, actions.turnEnabled, face, compileRun?.result]);

  const settleFlip = (event: React.TransitionEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget && event.propertyName === "transform") {
      setIsFlipping(false);
      discardReverseAfterFlip.current = false;
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
    if (!artworkView) return;
    const shell = appShellRef.current;
    const background = shell ? Array.from(shell.children).filter((child) => !child.classList.contains("artwork-view")) : [];
    background.forEach((child) => child.setAttribute("inert", ""));
    requestAnimationFrame(() => {
      const first = artworkViewRef.current?.querySelector<HTMLElement>(focusableArtworkSelector());
      first?.focus();
    });
    return () => background.forEach((child) => child.removeAttribute("inert"));
  }, [artworkView]);

  // Skip-to-content helpers: reveal the visually-hidden link when it receives
  // keyboard focus, then return the user (and the link) to the header once
  // focus leaves it. This keeps the skip link usable without ever tapping a key.
  const revealSkipLink = () => {
    const link = document.querySelector<HTMLAnchorElement>(".skip-link");
    link?.classList.add("skip-link-focus");
  };
  const restoreSkipLink = () => {
    const link = document.querySelector<HTMLAnchorElement>(".skip-link");
    if (link && !link.matches(":focus")) link.classList.remove("skip-link-focus");
  };

  // On first load, give the header messaging a short beat, then glide the top of
  // the gallery slider and Teppanyaki Counter up to the top of the viewport.
  // Mirrors the "skip to main content" behaviour, without the intervening click.
  useEffect(() => {
    if (galleryLoading || gallery.length === 0) return;
    const timer = window.setTimeout(() => {
      mainContentRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 1800);
    return () => window.clearTimeout(timer);
  }, [galleryLoading, gallery.length]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (artworkView) {
        const focusables = artworkViewRef.current ? Array.from(artworkViewRef.current.querySelectorAll<HTMLElement>(focusableArtworkSelector())) : [];
        const index = focusables.indexOf(document.activeElement as HTMLElement);
        const action = artworkModalKeyAction(event.key, event.shiftKey, index, focusables.length);
        if (action === "close") {
          event.preventDefault();
          event.stopPropagation();
          closeArtworkView();
          return;
        }
        if (event.key === "Tab" && focusables.length > 0 && (action === "previous" || action === "next")) {
          event.preventDefault();
          focusables[action === "previous" ? focusables.length - 1 : 0]?.focus();
          return;
        }
        return;
      }

      const target = event.target as HTMLElement | null;
      if (target?.isContentEditable || target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement) return;
      // Gallery shortcuts must not steal caret, menu, tab, or control input.
      if (target?.closest("button, a, [role=tab], [role=menuitem], [contenteditable=true]")) return;
      if (imageOnly && isImageOnlyExitKey(event.key)) {
        setImageOnly(false);
        return;
      }
      if (event.key === "ArrowLeft") selectImage(selectedIndex - 1);
      if (event.key === "ArrowRight") selectImage(selectedIndex + 1);
      if (event.key.toLowerCase() === "f") turnOver();
    };
    document.addEventListener("keydown", onKeyDown, true);
    return () => document.removeEventListener("keydown", onKeyDown, true);
  }, [selectedIndex, isFlipping, slideTransition, imageOnly, artworkView, turnOver]);

  useEffect(() => {
    let active = true;
    setCompilerState("checking");
    setCompilerLabel("RUST CORE · READY");
    rustToolchainVersion()
      .then(toolchain => {
        if (!active) return;
        setCompilerState("verified");
        setCompilerLabel(verifiedCompilerStatus(toolchain));
        setRuntimeRecord(current => current ? { ...current, toolchain } : { compiledAt: "", irHash: "", toolchain });
      })
      .catch(() => {
        if (!active) return;
        setCompilerState("error");
        setCompilerLabel("RUST CORE · CHECK FAILED");
      });
    return () => {
      active = false;
    };
  }, []);

  const applyCompiledSource = async (ir: RobbyIr, source: string) => {
    // Capture the authorities before the first await. `selected` is a render
    // snapshot; reading it after persistence cannot tell whether the user has
    // switched specimens or edited/reset this draft in the meantime.
    const compiledSpecimenId = selected.id;
    const specimenScript = selected.script;
    const compiledAt = new Date().toISOString();
    const irHash = await hashValue(JSON.stringify(ir));
    const snapshot: CompileSnapshot = { id: `${compiledSpecimenId}-${irHash}`, specimenId: compiledSpecimenId, source, ir, trace: traceFromIr(ir), compiledAt, irHash, origin: "editor" };
    compileHistory.current[compiledSpecimenId] = await persistCompileSnapshot(snapshot);
    setHistoryRevision(current => current + 1);

    // Keep the historical snapshot, but never let a stale async completion
    // overwrite the currently visible specimen's palette/projection/runtime.
    const currentAuthority = selectedRecipeRef.current;
    if (!isCompiledSourceCurrent(compiledSpecimenId, source, currentAuthority.specimenId, currentAuthority.source)) return;

    setCompiledEdit({ specimenId: compiledSpecimenId, ir, source });
    setPaletteK(ir.palette.k);
    setProjectionState("live");
    setFace("obverse");
    setFailureMessage(null);
    setRuntimeRecord(current => ({ compiledAt, irHash, toolchain: current?.toolchain ?? "RUST/WASM" }));
  };

  const clearLiveProjection = () => {
    clearPaletteReprocessTimer();
    setCompiledEdit(null);
    setProjectionState("compiling");
    setFailureMessage(null);
  };

  const markProjectionUnavailable = (message: string) => {
    setCompiledEdit(null);
    setProjectionState("error");
    setFailureMessage(message);
  };

  const markDraftProjectionUnavailable = (draft: string) => {
    clearPaletteReprocessTimer();
    draftStore.current.set(selected.id, draft);
    selectedRecipeRef.current = { specimenId: selected.id, source: draft };
    // No fallback: keep the last valid structured value while the source is
    // mid-edit and temporarily unparseable.
    setPaletteKFromDraft(draft);
    bumpDraftRevision();
    setCompiledEdit(null);
    setProjectionState("draft");
    setFailureMessage(null);
  };

  const resetLiveProjection = () => {
    clearPaletteReprocessTimer();
    draftStore.current.clear(selected.id);
    selectedRecipeRef.current = { specimenId: selected.id, source: selected.script };
    setPaletteKFromDraft(selected.script, 8);
    bumpDraftRevision();
    setCompiledEdit(null);
    setProjectionState("gallery");
    setFailureMessage(null);
  };

  // The counter slider rewrites the authored recipe and recompiles after a
  // short pause; direct recipe edits remain explicit via Compile Orio.
  const editPaletteK = (value: number) => {
    if (!Number.isInteger(value) || value < 3 || value > 64 || isRenderingReverse) return;
    try {
      const nextRecipe = editPaletteInRecipe(activeRecipe, value);
      draftStore.current.set(selected.id, nextRecipe);
      selectedRecipeRef.current = { specimenId: selected.id, source: nextRecipe };
      bumpDraftRevision();
      setPaletteK(value);
      setCompiledEdit(null);
      setProjectionState("draft");
      setFailureMessage(null);
      clearPaletteReprocessTimer();
      const scheduledAuthority = { specimenId: selected.id, source: nextRecipe };
      paletteReprocessTimer.current = window.setTimeout(() => {
        paletteReprocessTimer.current = null;
        if (!mountedRef.current) return;
        const currentAuthority = selectedRecipeRef.current;
        if (currentAuthority.specimenId !== scheduledAuthority.specimenId || currentAuthority.source !== scheduledAuthority.source) return;
        void compileOrio(true);
      }, 320);
    } catch (error) {
      setFailureMessage(error instanceof Error ? error.message : String(error));
    }
  };

  const focusReverseStep = () => {
    setTraceMode("evidence");
    const reverseStage = trace.find(step => step.code.startsWith("reverse("))?.stage;
    if (!reverseStage) return;
    requestAnimationFrame(() => document.getElementById(`trace-step-${reverseStage}`)?.scrollIntoView({ behavior: "smooth", block: "center" }));
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

  const closeArtworkView = () => {
    setArtworkView(false);
    requestAnimationFrame(() => artworkOpenerRef.current?.focus());
  };

  if (galleryLoading || gallery.length === 0) {
    return (
      <main className="app-shell min-h-screen overflow-hidden bg-[#f4efe1] text-[#1c1a19] flex items-center justify-center">
        <p className="mono text-sm tracking-wider text-[#5b564e]">{galleryLoading ? "Loading gallery…" : "No images in gallery/ folder"}</p>
      </main>
    );
  }

  return (
    <main ref={appShellRef} className={`app-shell min-h-screen overflow-hidden bg-[#f4efe1] text-[#1c1a19]${imageOnly ? " image-only" : ""}`}>
      <a
        className="skip-link"
        href="#gallery"
        onFocus={revealSkipLink}
        onBlur={restoreSkipLink}
      >
        Skip to gallery &amp; compilation
      </a>
      <header className="site-header">
        <a className="brand-lockup" href="#gallery" aria-label="robby gallery">
          <img src="/icons/robby-registration-mark_658aceee.png" alt="robby split registration disc" />
          <span className="brand-copy">
            <span className="brand-title">robby <span className="brand-slash">/</span> <span className="brand-suffix">v1</span></span>
            <span className={`compile-status ${compilerState}`}>{compilerLabel}</span>
          </span>
        </a>
        <span className="header-product-subtitle">The Reverse-Obverse Image Duality Compiler</span>
        <div className="header-actions header-toolset">
          <button type="button" className="feature-control icon-control" onClick={toggleTheme} aria-label={themeControlLabel(theme)} aria-pressed={theme === "dark"} title={themeControlLabel(theme)}>
            <img src={theme === "light" ? "/icons/thin-sunglasses_23303233.svg" : "/icons/regular-sunglasses_28c9e1cf.svg"} alt="" />
          </button>
          <button type="button" className="feature-control icon-control image-only-toggle" onClick={() => setImageOnly((current) => !current)} aria-pressed={imageOnly} aria-label={imageOnly ? "Restore interface text" : "Enable image-only concentration mode"} title="Image-only concentration mode. Press Escape to return.">
            <img src={imageOnly ? "/icons/text-hidden_1b455537.svg" : "/icons/text-visible_5e9d8f58.svg"} alt="" />
          </button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button type="button" className="menu-control" aria-label="Open site menu" title="Site menu"><Menu size={18} strokeWidth={2.2} /></button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="robby-menu-content">
              <DropdownMenuItem asChild><Link href="/manual"><BookOpen size={17} /> Language manual</Link></DropdownMenuItem>

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
          <h1><span className="headline-line headline-primary"><span className="headline-accent">Explainable</span> <span className="headline-ink">image-object</span></span><em className="headline-line"><span className="headline-accent">compiler</span> <span className="headline-ink">in rust.</span></em></h1>
        </div>
        <div className="intro-note">
          <span className="note-rule" />
          <p>What if a digital image could be a two-sided image-object, like a postcard or a coin?</p>
          <div className="intro-tools"><span className="mono text-[10px] tracking-[0.13em]">← → TO CYCLE · F TO FLIP</span></div>
        </div>
      </section>

      <section ref={mainContentRef} id="gallery" className="gallery-workspace" aria-label="robby image-object gallery" tabIndex={-1}>
        <section className="object-stage" aria-label={`${selected.title} ${activeFace} image-object`}>
          <div className="artwork-stage-frame">
            <span className="stage-corner top-left" aria-hidden="true" /><span className="stage-corner top-right" aria-hidden="true" /><span className="stage-corner bottom-left" aria-hidden="true" /><span className="stage-corner bottom-right" aria-hidden="true" />
            <div className="artwork-stage-viewport">
              {(slideTransition && (() => {
                const outgoing = gallery.find(item => item.id === slideTransition.outgoingId);
                const incoming = gallery.find(item => item.id === slideTransition.incomingId);
                if (!outgoing || !incoming) return null;
                return (
                <div className={`slide-track slide-track-${slideTransition.direction}`} onAnimationEnd={settleStageSlide}>
                  {slideTransition.direction === "forward" ? (
                    <>
                      <div className={`two-sided-object ${outgoing.ratio} slide-track-item`} aria-hidden="true">
                        <div className="object-turner" data-face={face}>
                          <div className="object-face object-face-obverse" aria-hidden={face !== "obverse"}>
                            <img src={displayedObverse} alt="" className="object-image" />
                          </div>
                          <div className="object-face object-face-inverse" aria-hidden={face !== "inverse"}>
                            {displayedInverse && <img src={displayedInverse} alt="" className="object-image" />}
                          </div>
                        </div>
                      </div>
                      <div className={`two-sided-object ${incoming.ratio} slide-track-item`} aria-busy>
                        <div className="object-turner" data-face="obverse">
                          <div className="object-face object-face-obverse" aria-hidden={false}>
                            <img src={incoming.obverse} alt={`${incoming.title} obverse`} className="object-image" />
                          </div>
                          <div className="object-face object-face-inverse" aria-hidden={true}>
                          </div>
                        </div>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className={`two-sided-object ${incoming.ratio} slide-track-item`} aria-busy>
                        <div className="object-turner" data-face="obverse">
                          <div className="object-face object-face-obverse" aria-hidden={false}>
                            <img src={incoming.obverse} alt={`${incoming.title} obverse`} className="object-image" />
                          </div>
                          <div className="object-face object-face-inverse" aria-hidden={true}>
                          </div>
                        </div>
                      </div>
                      <div className={`two-sided-object ${outgoing.ratio} slide-track-item`} aria-hidden="true">
                        <div className="object-turner" data-face={face}>
                          <div className="object-face object-face-obverse" aria-hidden={face !== "obverse"}>
                            <img src={displayedObverse} alt="" className="object-image" />
                          </div>
                          <div className="object-face object-face-inverse" aria-hidden={face !== "inverse"}>
                            {displayedInverse && <img src={displayedInverse} alt="" className="object-image" />}
                          </div>
                        </div>
                      </div>
                    </>
                  )}
                </div>
                );
              })()) ?? (
                <div className={`two-sided-object ${selected.ratio}`} aria-busy={isFlipping} onAnimationEnd={settleStageSlide}>
                  <div className="object-turner" data-face={face} onTransitionEnd={settleFlip}>
                    <div className="object-face object-face-obverse" aria-hidden={face !== "obverse"}>
                      <img src={displayedObverse} alt={`${selected.title} obverse`} className="object-image" />
                    </div>
                    <div className="object-face object-face-inverse" aria-hidden={face !== "inverse"}>
                      {displayedInverse && <img src={displayedInverse} alt={`${selected.title} inverse: ${selected.reverseDescription}`} className="object-image" />}
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
                  <button ref={artworkOpenerRef} type="button" className="artwork-view-control" onClick={() => setArtworkView(true)} aria-label={`Open ${selected.title} in full-bleed artwork view`} title="Open full-bleed artwork view"><Maximize2 size={15} /></button>
                </div>
              </div>
              <div className="caption-turn">
                <button type="button" className="compile-orio-control" onClick={() => void compileOrio(actions.compileForce)} disabled={!actions.compileEnabled || isFlipping} aria-label={`${actions.compileLabel} for ${selected.title}`}>
                  <CircleDotDashed size={16} /><span>{actions.compileLabel}</span>
                </button>
                {actions.showCancel && (
                  <button type="button" className="compile-orio-control" onClick={() => browserCompileController.cancelActive()} aria-label={`Cancel compile for ${selected.title}`}>
                    <span>Cancel</span>
                  </button>
                )}
                <button type="button" className="flip-control" onClick={() => void turnOver()} disabled={!actions.turnEnabled || isFlipping} aria-label={face === "inverse" ? `Return ${selected.title} to its obverse` : `Turn ${selected.title} to its inverse`}>
                  {face === "inverse" ? <RotateCcw size={18} /> : <FlipHorizontal2 size={18} />}<span>{isFlipping ? "Turning object" : actions.turnLabel}</span><small>F</small>
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

        <div className="counter-column" inert={imageOnly}>
          <TeppanyakiCounter
            run={compileRun?.galleryItemId === selected.id ? compileRun : null}
            recipeChanged={recipeChanged}
            paletteK={paletteK}
            onPaletteKChange={editPaletteK}
          />
        </div>
        <div className="source-workbench-wrap" inert={imageOnly}>
          <SourceEditor
            specimenId={selected.id}
            title={selected.title}
            source={activeRecipe}
            onCompiled={applyCompiledSource}
            onCompileStart={clearLiveProjection}
            onCompileError={markProjectionUnavailable}
            onDraftChange={markDraftProjectionUnavailable}
            onReset={resetLiveProjection}
          />
        </div>
      </section>

      <div inert={imageOnly}><ProvenanceModule item={selectedWithCredential} runtime={runtimeRecord} onFocusReverse={focusReverseStep} reverseMode={activeReverseMode} paletteK={paletteK} /></div>

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
      {artworkView && <div ref={artworkViewRef} className="artwork-view" role="dialog" aria-modal="true" aria-labelledby="artwork-view-title" tabIndex={-1} onClick={closeArtworkView}>
        <h2 id="artwork-view-title" className="sr-only">{selected.title} full-bleed artwork view</h2>
        <div className="artwork-view-frame" onClick={event => event.stopPropagation()} onTouchStart={handleArtworkTouchStart} onTouchEnd={handleArtworkTouchEnd}>
          <div className="artwork-view-image-viewport">
            {face === "obverse"
              ? <img src={displayedObverse} alt={`${selected.title} obverse`} />
              : displayedInverse && <img src={displayedInverse} alt={`${selected.title} inverse`} />}
          </div>
          <div className="artwork-view-controls"><div className="artwork-view-meta"><span>{selected.title} / {face}</span><span>SWIPE TO BROWSE · ESC TO CLOSE</span></div><button type="button" onClick={closeArtworkView} aria-label="Close full-bleed artwork view" title="Close full-bleed artwork view"><Minimize2 size={19} /></button></div>
        </div>
      </div>}
    </main>
  );
}
