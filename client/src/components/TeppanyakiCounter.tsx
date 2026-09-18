import { CircleDotDashed } from "lucide-react";
import type { CompileRun } from "@/lib/compileEvents";
import { counterCopy, counterPresentation, deriveCounterState, stationViews, type StationView } from "@/lib/teppanyakiCounter";

function StationList({ stations }: { stations: StationView[] }) {
  return (
    <ol className="teppanyaki-stations" aria-label="Compilation stations">
      {stations.map(station => (
        <li key={station.stage} className={`teppanyaki-station status-${station.status}${station.status === "started" || station.status === "artifact" ? " is-active" : ""}`} data-stage={station.stage} aria-current={station.status === "started" || station.status === "artifact" ? "step" : undefined}>
          <span className="trace-number">{station.index}</span>
          <div>
            <strong>{station.name}</strong>
            <p>{station.label}</p>
            {station.classification && <em>{station.classification}</em>}
          </div>
        </li>
      ))}
    </ol>
  );
}

const PALETTE_MIN = 3;
const PALETTE_MAX = 64;

export default function TeppanyakiCounter({
  run,
  recipeChanged,
  paletteK,
  onPaletteKChange,
  previewPalette = [],
}: {
  run: CompileRun | null;
  recipeChanged: boolean;
  paletteK: number;
  onPaletteKChange: (value: number) => void;
  /**
   * The specimen's server-precomputed k=8 default palette (see
   * `galleryWatcher.ts`). The swatch grid is a permanent fixture of the
   * counter, not something that only appears after a compile — this is
   * what it shows before the user has ever compiled this specimen, or after
   * switching away from one they compiled a moment ago.
   */
  previewPalette?: readonly string[];
}) {
  const state = deriveCounterState(run, recipeChanged);
  const copy = counterCopy(state);
  const presentation = counterPresentation(state);
  const stations = stationViews(run?.events ?? []);
  const splitStation = stations.find(station => station.stage === "split");
  const compiledSwatches = splitStation?.swatches ?? [];
  const swatches = compiledSwatches.length > 0 ? compiledSwatches : previewPalette;
  const swatchGridLabel = compiledSwatches.length === 0
    ? `${swatches.length} palette swatches in rows of 8 — default preview at k=8, compile to render this recipe`
    : `${swatches.length} palette swatches in rows of 8`;

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
      <div className="palette-slider">
        <label htmlFor="palette-k-slider" className="mono-label">Palette k</label>
        <div className="palette-slider-row">
          <input
            id="palette-k-slider"
            type="range"
            min={PALETTE_MIN}
            max={PALETTE_MAX}
            step={1}
            value={paletteK}
            onChange={(event) => onPaletteKChange(Number(event.target.value))}
            aria-valuetext={`${paletteK} colour clusters`}
          />
          <output htmlFor="palette-k-slider" className="palette-k-value">{paletteK}</output>
        </div>
      </div>
      {swatches.length > 0 && (
        <div className="palette-swatch-grid" role="img" aria-label={swatchGridLabel}>
          {swatches.map((swatch, index) => (
            // Median cut averages each colour box independently, so two boxes
            // can round to the same hex. The index disambiguates those repeats;
            // a bare hex key would collide and drop swatches from the grid.
            <i key={`${index}-${swatch}`} style={{ background: swatch }} title={swatch} />
          ))}
        </div>
      )}
      {presentation.showStations && <StationList stations={stations} />}
      {run?.result?.disclosure && (
        <div className="teppanyaki-audit-window" tabIndex={0} aria-label="Disclosure audit, scrollable">
          <p className="teppanyaki-audit" role="note">
            {run.result.disclosure.safe
              ? `Public-safe: omitted ${run.result.disclosure.omitted.join(" · ")}`
              : `Disclosure warning: ${run.result.disclosure.warnings.join(" · ")}`}
          </p>
        </div>
      )}
    </aside>
  );
}
