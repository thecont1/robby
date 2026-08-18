/**
 * ROBBY VISUAL SYSTEM — Contact-sheet archaeology.
 * This is a specimen workbench, not a second compiler: Compile delegates to
 * the shared Rust/WASM bridge and exposes its authored diagnostic verbatim.
 */

import { compileWithRust, type RobbyIr } from "@/lib/robbyCompiler";
import { AlertTriangle, CheckCircle2, Code2, Play, RotateCcw } from "lucide-react";
import { useEffect, useRef, useState } from "react";

type EditorState =
  | { kind: "idle" }
  | { kind: "compiling" }
  | { kind: "success"; ir: RobbyIr }
  | { kind: "error"; message: string };

type SourceEditorProps = {
  specimenId: string;
  title: string;
  source: string;
  onCompiled: (ir: RobbyIr, source: string) => void;
  onCompileStart: () => void;
  onCompileError: (message: string) => void;
  onDraftChange: () => void;
  onReset: () => void;
};

export default function SourceEditor({ specimenId, title, source, onCompiled, onCompileStart, onCompileError, onDraftChange, onReset }: SourceEditorProps) {
  const [draft, setDraft] = useState(source);
  const [state, setState] = useState<EditorState>({ kind: "idle" });
  const compileGeneration = useRef(0);

  useEffect(() => {
    compileGeneration.current += 1;
    setDraft(source);
    setState({ kind: "idle" });
  }, [specimenId, source]);

  const compile = async () => {
    const generation = ++compileGeneration.current;
    setState({ kind: "compiling" });
    onCompileStart();
    try {
      const ir = await compileWithRust(draft);
      if (generation !== compileGeneration.current) return;
      setState({ kind: "success", ir });
      onCompiled(ir, draft);
    } catch (error) {
      if (generation !== compileGeneration.current) return;
      const message = error instanceof Error ? error.message : String(error);
      setState({ kind: "error", message });
      onCompileError(message);
    }
  };

  const reset = () => {
    compileGeneration.current += 1;
    setDraft(source);
    setState({ kind: "idle" });
    onReset();
  };

  const updateDraft = (nextDraft: string) => {
    if (nextDraft === draft) return;
    compileGeneration.current += 1;
    setDraft(nextDraft);
    onDraftChange();
  };

  const lineCount = Math.max(1, draft.split("\n").length);

  return (
    <section className="source-workbench" aria-labelledby="source-editor-title">
      <div id="source-editor-title" className="source-workbench-heading">
        <div><Code2 size={15} /><span className="mono-label">Live source / Rust compiler</span></div>
        <span className="mono">{title.toUpperCase()} · {lineCount} LINES</span>
      </div>
      <div className="source-editor" data-state={state.kind}>
        <ol className="source-line-numbers" aria-hidden="true">
          {Array.from({ length: lineCount }, (_, index) => <li key={index}>{index + 1}</li>)}
        </ol>
        <textarea
          aria-label={`robby source editor for ${title}`}
          spellCheck="false"
          value={draft}
          onChange={(event) => updateDraft(event.target.value)}
        />
      </div>
      <div className="source-editor-actions">
        <button type="button" className="compile-source" onClick={compile} disabled={state.kind === "compiling"}>
          <Play size={14} fill="currentColor" /> {state.kind === "compiling" ? "Compiling in Rust…" : "Compile with Rust"}
        </button>
        <button type="button" className="reset-source" onClick={reset} disabled={state.kind === "compiling"}>
          <RotateCcw size={13} /> Reset specimen source
        </button>
        <span className="source-boundary">WASM bridge → Rust lexer / parser / validator / IR</span>
      </div>
      {state.kind === "success" && (
        <div className="source-result success" role="status">
          <CheckCircle2 size={16} />
          <div><strong>Valid `robby-ir-v1` from the Rust core.</strong><span>Trace and manifest targets now reflect this source. The gallery bitmap remains the pre-rendered specimen artifact.</span></div>
        </div>
      )}
      {state.kind === "error" && (
        <div className="source-result error" role="alert">
          <AlertTriangle size={16} />
          <div><strong>Compilation stopped.</strong><span>{state.message}</span></div>
        </div>
      )}
    </section>
  );
}
