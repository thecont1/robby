import type { CompileRun } from "@/lib/compileEvents";

export type ObjectFace = "obverse" | "inverse";
export type CompileActionName = "compile" | "turn";

/**
 * Places Turn before Compile only for a completed result whose recipe is still
 * current; otherwise Compile remains first.
 */
export function compileActionOrder(input: { completed: boolean; recipeChanged: boolean }): [CompileActionName, CompileActionName] {
  return input.completed && !input.recipeChanged ? ["turn", "compile"] : ["compile", "turn"];
}

export type CompileActions = {
  compileLabel: string;
  compileEnabled: boolean;
  compileForce: boolean;
  turnLabel: string;
  turnEnabled: boolean;
  showCancel: boolean;
};

/**
 * A newer compile request must reach the controller even while an older
 * reverse is still rendering. The controller cancels the inflight run; Home
 * must not drop the later request with `isRenderingReverse`.
 */
export function shouldStartCompileRequest(input: {
  isFlipping: boolean;
  isRendering: boolean;
  supersedeInflight: boolean;
}): boolean {
  if (input.isFlipping) return false;
  return !input.isRendering || input.supersedeInflight;
}

/**
 * A palette edit is admissible on value alone. It must NOT be refused because a
 * reverse is still rendering: the slider is a controlled input, so dropping the
 * edit snaps the thumb back and strands the authored recipe at the old k while
 * the compile station reports a different one. A later compile supersedes the
 * inflight run (see `shouldStartCompileRequest`), so the edit is safe to accept.
 */
export function shouldAcceptPaletteEdit(value: number, min = 3, max = 64): boolean {
  return Number.isInteger(value) && value >= min && value <= max;
}

/**
 * A delayed palette recompile is current only while its captured specimen and
 * authored source still match the live authority.
 */
export function isPaletteReprocessCurrent(
  scheduled: { specimenId: string; source: string },
  current: { specimenId: string; source: string },
): boolean {
  return scheduled.specimenId === current.specimenId && scheduled.source === current.source;
}

export function compileActions(input: {
  run: CompileRun | null;
  recipeChanged: boolean;
  face: ObjectFace;
  isRendering: boolean;
}): CompileActions {
  const completed = input.run?.status === "completed" && Boolean(input.run.result);
  const running = input.isRendering || input.run?.status === "running";

  if (running) {
    return {
      compileLabel: "Compiling Orio…",
      compileEnabled: false,
      compileForce: false,
      turnLabel: input.face === "inverse" ? "Return to obverse" : "Turn to inverse",
      turnEnabled: false,
      showCancel: true,
    };
  }

  if (completed && input.recipeChanged) {
    return {
      compileLabel: "Compile Revised Orio",
      compileEnabled: true,
      compileForce: true,
      turnLabel: input.face === "inverse" ? "Return to obverse" : "View previous result",
      turnEnabled: true,
      showCancel: false,
    };
  }

  if (completed) {
    return {
      compileLabel: "Recompile Orio",
      compileEnabled: true,
      compileForce: true,
      turnLabel: input.face === "inverse" ? "Return to obverse" : "Turn to inverse",
      turnEnabled: true,
      showCancel: false,
    };
  }

  return {
    compileLabel: "Compile Orio",
    compileEnabled: true,
    compileForce: false,
    turnLabel: input.face === "inverse" ? "Return to obverse" : "Turn to inverse",
    turnEnabled: input.face === "inverse",
    showCancel: false,
  };
}
