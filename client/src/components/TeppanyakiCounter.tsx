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
    <aside className={`teppanyaki-counter state-${state}`} aria-label="Teppanyaki compilation counter">
      <div className="trace-heading">
        <div>
          <CircleDotDashed size={15} />
          <span className="mono-label">Teppanyaki Counter</span>
        </div>
        <span>{state.toUpperCase()}</span>
      </div>
      <div className="trace-title" role="status" aria-live="polite" aria-atomic="true">
        <p className="eyebrow">{copy.kicker}</p>
        <h3>{copy.body}</h3>
      </div>
      <ol className="teppanyaki-stations">
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
    </aside>
  );
}
