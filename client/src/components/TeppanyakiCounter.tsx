import { CircleDotDashed } from "lucide-react";
import type { CompileRun } from "@/lib/compileEvents";
import { counterCopy, deriveCounterState, stationViews } from "@/lib/teppanyakiCounter";

export default function TeppanyakiCounter({
  run,
  recipeChanged,
}: {
  run: CompileRun | null;
  recipeChanged: boolean;
}) {
  const state = deriveCounterState(run, recipeChanged);
  const copy = counterCopy(state);
  const stations = stationViews(run?.events ?? []);

  return (
    <aside className={`teppanyaki-counter state-${state}`} data-state={state} aria-labelledby="teppanyaki-counter-title">
      <div className="trace-heading">
        <div>
          <CircleDotDashed size={15} aria-hidden="true" />
          <h2 id="teppanyaki-counter-title" className="mono-label">Teppanyaki counter</h2>
        </div>
        <span aria-label={`Compilation state: ${state}`}>{state.toUpperCase()}</span>
      </div>
      <div className="trace-title" role="status" aria-live="polite" aria-atomic="true">
        <p className="eyebrow">{copy.kicker}</p>
        <p className="counter-message">{copy.body}</p>
      </div>
      <ol className="teppanyaki-stations" aria-label="Compilation stations">
        {stations.map(station => (
          <li key={station.stage} className={`teppanyaki-station status-${station.status}`} data-stage={station.stage}>
            <span className="trace-number">{station.index}</span>
            <div>
              <strong>{station.name}</strong>
              <p>{station.label}</p>
              {station.swatches.length > 0 && (
                <span className="teppanyaki-swatches" aria-label={`${station.swatches.length} palette swatches`}>
                  {station.swatches.map(swatch => (
                    <i key={swatch} style={{ background: swatch }} title={swatch} />
                  ))}
                </span>
              )}
              {station.classification && <em>{station.classification}</em>}
            </div>
          </li>
        ))}
      </ol>
      {run?.result?.disclosure && (
        <p className="teppanyaki-audit" role="note">
          {run.result.disclosure.safe
            ? `Public-safe: omitted ${run.result.disclosure.omitted.join(" · ")}`
            : `Disclosure warning: ${run.result.disclosure.warnings.join(" · ")}`}
        </p>
      )}
    </aside>
  );
}
