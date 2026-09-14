import type { CompileRun } from "@/lib/compileEvents";

export type ObjectFace = "obverse" | "inverse";

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
