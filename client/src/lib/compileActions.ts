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
