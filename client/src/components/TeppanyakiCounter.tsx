import { useEffect, useRef, useState, type CSSProperties } from "react";
import { CircleDotDashed } from "lucide-react";
import type { CompileRun } from "@/lib/compileEvents";
import { STATION_PACE_MS } from "@/lib/compileEvents";
import { counterCopy, counterPresentation, deriveCounterState, stationViews, type StationView } from "@/lib/teppanyakiCounter";

// The rail sweeps the station column at the same pace the pipeline holds
// each station for (STATION_PACE_MS), so the traversal and the real process
// move in lockstep. It may also only pass a cell once that station has truly
// finished — cells ahead of the rail head stay dim even if work completed.
const RAIL_CELLS_PER_SECOND = 1000 / STATION_PACE_MS;

function railGate(stations: StationView[]): number {
  for (let i = 0; i < stations.length; i++) {
    const status = stations[i].status;
    if (status !== "completed" && status !== "failed") {
      return status === "idle" ? i : i + 1;
    }
  }
  return stations.length;
}

function useRailProgress(stations: StationView[]): number {
  const [progress, setProgress] = useState(0);
  const progressRef = useRef(0);
  const stationsRef = useRef(stations);
  stationsRef.current = stations;
  const gateKey = stations.map(station => station.status).join("|");

  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      const allowed = railGate(stationsRef.current);
      let next = progressRef.current;
      if (allowed < next) {
        next = allowed;
      } else if (next < allowed) {
        next = Math.min(next + dt * RAIL_CELLS_PER_SECOND, allowed);
      }
      progressRef.current = next;
      setProgress(next);
      if (next < allowed) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [gateKey]);

  return progress;
}

function StationList({ stations, railProgress }: { stations: StationView[]; railProgress: number }) {
  return (
    <ol className="teppanyaki-stations" aria-label="Compilation stations">
      {stations.map((station, i) => {
        const fill = Math.min(Math.max(railProgress - i, 0), 1);
        const active = station.status === "started" || station.status === "artifact";
        return (
          <li
            key={station.stage}
            className={`teppanyaki-station status-${station.status}${active ? " is-active" : ""}${fill >= 0.3 ? " rail-covered" : ""}`}
            style={{ "--rail-fill": fill.toFixed(3) } as CSSProperties}
            data-stage={station.stage}
            aria-current={active ? "step" : undefined}
          >
            <span className="trace-number">{station.index}</span>
            <div className="teppanyaki-station-copy">
              <div className="teppanyaki-station-heading">
                <strong>{station.name}</strong>
                {station.classification && <em>{station.classification}</em>}
              </div>
              <p>{station.label}</p>
            </div>
          </li>
        );
      })}
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
  liveSwatches = [],
  swatchSeedToken,
  swatchC2paPresent = false,
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
  /**
   * Rust-derived swatches for the *edited* recipe's k (see Home's live
   * palette preview). Real colours for a recipe that has not been compiled
   * yet — same median-cut the Split station will produce.
   */
  liveSwatches?: readonly string[];
  swatchSeedToken?: string;
  swatchC2paPresent?: boolean;
}) {
  const state = deriveCounterState(run, recipeChanged);
  const copy = counterCopy(state);
  const presentation = counterPresentation(state);
  const stations = stationViews(run?.events ?? []);
  const railProgress = useRailProgress(stations);
  const credentialPresence = run?.result?.c2paEvidence.presence;
  const hasContentCredentials = credentialPresence === "present";
  const splitStation = stations.find(station => station.stage === "split");
  const compiledSwatches = splitStation?.swatches ?? [];
  const swatches = compiledSwatches.length > 0 ? compiledSwatches : previewPalette;
  // Swatch colours are only real for the recipe they were derived from. Once
  // the k slider moves (recipeChanged) or the count no longer matches the
  // current k, the grid falls back to the live Rust preview of the edited
  // recipe, then to empty slots while that preview is still computing.
  const paletteMatchesRecipe = !recipeChanged && swatches.length === paletteK;
  const previewSwatches = !paletteMatchesRecipe && liveSwatches.length === paletteK ? liveSwatches : [];
  const pendingSlots = paletteMatchesRecipe || previewSwatches.length > 0 ? 0 : paletteK;
  const gridSwatches = paletteMatchesRecipe ? swatches : previewSwatches;
  const swatchGridLabel = pendingSlots > 0
    ? `${paletteK} palette slots reserved — deriving palette`
    : (paletteMatchesRecipe && compiledSwatches.length === 0
      ? `${gridSwatches.length} palette swatches in rows of 8 — default preview at k=${paletteK}, compile to render this recipe`
      : `${gridSwatches.length} palette swatches in rows of 8`);

  return (
    <aside className={`teppanyaki-counter state-${state}`} data-state={state} aria-labelledby="teppanyaki-counter-title">
      <div className="trace-heading">
        <div>
          <CircleDotDashed size={15} aria-hidden="true" />
          <h2 id="teppanyaki-counter-title" className="mono-label">Teppanyaki counter</h2>
        </div>
        <div className="teppanyaki-heading-status">
          {hasContentCredentials && <span className="content-credentials-salute" title="Content Credentials found in the source image" aria-label={`Content Credentials ${credentialPresence}`}><img src="/icons/content_credentials_cr.svg" alt="" aria-hidden="true" /><span>CR</span></span>}
          <span aria-label={`Compilation state: ${state}`}>{state.toUpperCase()}</span>
        </div>
      </div>
      <p className="teppanyaki-shortcuts" aria-label="Keyboard shortcuts">← → TO CYCLE · F TO FLIP · C TO COMPILE</p>
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
      {(gridSwatches.length > 0 || pendingSlots > 0) && (
        <div className="palette-swatch-grid" role="img" aria-label={swatchGridLabel}>
          {pendingSlots > 0
            ? Array.from({ length: pendingSlots }, (_, index) => (
              <i key={`pending-${index}`} className="pending" aria-hidden="true" />
            ))
            : gridSwatches.map((swatch, index) => (
              // Median cut averages each colour box independently, so two boxes
              // can round to the same hex. The index disambiguates those repeats;
              // a bare hex key would collide and drop swatches from the grid.
              <i key={`${index}-${swatch}`} style={{ background: swatch }} title={swatch} />
            ))}
        </div>
      )}
      {swatchSeedToken && <p className="swatch-seed-line">SWATCH SEED <strong>{swatchSeedToken}</strong> · {swatchC2paPresent ? "C2PA" : "NO C2PA"}</p>}
      {presentation.showStations && <StationList stations={stations} railProgress={railProgress} />}
    </aside>
  );
}
