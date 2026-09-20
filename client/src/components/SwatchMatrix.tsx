import gsap from "gsap";
import p5 from "p5";
import { useEffect, useMemo, useRef } from "react";
import GeneralizedTerrain from "@/components/GeneralizedTerrain";
import { splitMix32 } from "@/lib/swatchSeed";
import type { IngredientAnalysis } from "@/lib/robbyCompiler";

type Rgb = [number, number, number];

type Terrain = NonNullable<IngredientAnalysis["terrain"]>;

type SwatchMatrixProps = {
  swatches: readonly string[];
  seed: number;
  active: boolean;
  resetKey: string;
  alt: string;
  terrain?: Terrain | null;
};

type Cell = {
  index: number;
  x: number;
  y: number;
};

type Position = { row: number; column: number };

type MatrixController = {
  setActive: (active: boolean) => void;
};

function hasTerrainLabel(terrain: Terrain | null | undefined) {
  return terrain ? " · GPS-gated terrain panel" : "";
}

function hexToRgb(value: string): Rgb {
  const hex = value.trim().replace(/^#/, "");
  if (!/^[0-9a-f]{6}$/i.test(hex)) return [0, 0, 0];
  return [
    Number.parseInt(hex.slice(0, 2), 16),
    Number.parseInt(hex.slice(2, 4), 16),
    Number.parseInt(hex.slice(4, 6), 16),
  ];
}

/**
 * A provenance-seeded, full-face reverse artwork. The palette remains in
 * canonical compiler order; only its animated spatial arrangement changes.
 */
export default function SwatchMatrix({ swatches, seed, active, resetKey, alt, terrain }: SwatchMatrixProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const controllerRef = useRef<MatrixController | null>(null);
  const paletteKey = swatches.join("|");
  const colours = useMemo(() => swatches.map(hexToRgb), [paletteKey, swatches]);
  const hasTerrain = Boolean(
    terrain && terrain.grid_size > 1 && terrain.heights.length >= terrain.grid_size * terrain.grid_size,
  );

  useEffect(() => {
    controllerRef.current?.setActive(active);
  }, [active]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host || colours.length < 1) return;

    let resizeObserver: ResizeObserver | null = null;
    let animation: gsap.core.Timeline | null = null;
    let schedule: gsap.core.Tween | null = null;
    let activeState = active;
    let reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    let slots: Cell[][] = [];
    let width = 1;
    let height = 1;
    let side = 1;
    let cellSize = 1;
    const choreography = splitMix32(seed ^ 0x6d2b79f5);
    const k = colours.length;

    const killAnimation = () => {
      schedule?.kill();
      schedule = null;
      animation?.kill();
      animation = null;
    };

    // Measure the layout box, never getBoundingClientRect: the matrix mounts
    // while the inverse face is mid-flip, and a transform-projected rect is
    // both wrong and never corrected — the layout size does not change, so
    // the ResizeObserver stays silent and the canvas stays distorted.
    const buildSlots = () => {
      width = Math.max(1, host.clientWidth);
      height = Math.max(1, host.clientHeight);
      // The swatch field is a square anchored to the left edge; any extra
      // width on the right stays empty for the terrain panel (or blank
      // paper when the source carries no GPS evidence).
      side = Math.min(width, height);
      cellSize = side / k;
      host.style.setProperty("--matrix-side", `${side}px`);
      const tiles = Array.from({ length: k * k }, (_, index) => index % k);
      const random = splitMix32(seed);
      for (let index = tiles.length - 1; index > 0; index -= 1) {
        const swapIndex = random() % (index + 1);
        [tiles[index], tiles[swapIndex]] = [tiles[swapIndex], tiles[index]];
      }
      slots = Array.from({ length: k }, (_, rowIndex) =>
        Array.from({ length: k }, (_, columnIndex) => ({
          index: tiles[rowIndex * k + columnIndex],
          x: columnIndex * cellSize,
          y: rowIndex * cellSize,
        })));
    };

    // Burst choreography: k/2 cell-pair swaps play sequentially across k/4
    // seconds, then the matrix rests for half a second and the next burst
    // begins — a repeating pulse, never whole rows or columns.
    const BURST_PAUSE_SECONDS = 0.5;

    const startBurst = () => {
      schedule = null;
      if (!activeState || reducedMotion || animation || k < 2) {
        if (activeState && !reducedMotion && k >= 2) scheduleNext();
        return;
      }
      const pairs = Math.max(1, Math.floor(k / 2));
      const burstSeconds = Math.max(0.5, k / 4);
      const swapDuration = burstSeconds / pairs;
      const chosen = new Set<number>();
      const picks: Array<[Position, Position]> = [];
      while (picks.length < pairs && chosen.size < k * k) {
        const pick = () => {
          let index = choreography() % (k * k);
          while (chosen.has(index)) index = (index + 1) % (k * k);
          chosen.add(index);
          return index;
        };
        const first = pick();
        const second = pick();
        picks.push([
          { row: Math.floor(first / k), column: first % k },
          { row: Math.floor(second / k), column: second % k },
        ]);
      }
      animation = gsap.timeline({
        onComplete: () => {
          animation = null;
          scheduleNext();
        },
      });
      picks.forEach(([a, b], index) => {
        const cellA = slots[a.row][a.column];
        const cellB = slots[b.row][b.column];
        const at = index * swapDuration;
        animation?.to(cellA, { x: b.column * cellSize, y: b.row * cellSize, duration: swapDuration, ease: "power2.inOut" }, at);
        animation?.to(cellB, { x: a.column * cellSize, y: a.row * cellSize, duration: swapDuration, ease: "power2.inOut" }, at);
        animation?.call(() => {
          slots[a.row][a.column] = cellB;
          slots[b.row][b.column] = cellA;
        }, undefined, at + swapDuration);
      });
    };

    function scheduleNext() {
      if (!activeState || reducedMotion || animation || k < 2) return;
      schedule = gsap.delayedCall(BURST_PAUSE_SECONDS, startBurst);
      if (!activeState) schedule.pause();
    }

    const setActive = (next: boolean) => {
      activeState = next;
      if (!next) {
        schedule?.pause();
        animation?.pause();
        return;
      }
      if (animation) animation.resume();
      else if (schedule) schedule.resume();
      else scheduleNext();
    };

    const setReducedMotion = (next: boolean) => {
      reducedMotion = next;
      if (next) killAnimation();
      else if (activeState) scheduleNext();
    };

    // The canvas IS the matrix surface — a square of `side` pixels. The
    // terrain panel lives in its own element to the right, so the matrix
    // element itself measures square at any viewport width.
    const sketch = new p5(instance => {
      instance.setup = () => {
        buildSlots();
        instance.createCanvas(side, side);
        instance.pixelDensity(Math.min(2, window.devicePixelRatio || 1));
        instance.noStroke();
      };

      instance.draw = () => {
        const darkMode = document.documentElement.classList.contains("dark");
        instance.background(darkMode ? 0 : 244, darkMode ? 0 : 239, darkMode ? 0 : 225);
        slots.forEach(row => row.forEach(cell => {
          const colour = colours[cell.index] ?? [0, 0, 0];
          instance.fill(...colour);
          instance.rect(cell.x, cell.y, cellSize + 0.5, cellSize + 0.5);
        }));
      };
    }, host);

    resizeObserver = new ResizeObserver(() => {
      killAnimation();
      buildSlots();
      if (activeState && !reducedMotion) scheduleNext();
      if (sketch.width !== side || sketch.height !== side) sketch.resizeCanvas(side, side);
    });
    resizeObserver.observe(host);

    const media = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    const onMotionPreferenceChange = () => setReducedMotion(media?.matches ?? false);
    media?.addEventListener?.("change", onMotionPreferenceChange);

    controllerRef.current = { setActive };
    setActive(activeState);

    return () => {
      controllerRef.current = null;
      media?.removeEventListener?.("change", onMotionPreferenceChange);
      resizeObserver?.disconnect();
      killAnimation();
      sketch.remove();
    };
  }, [colours, paletteKey, resetKey, seed]);

  return (
    <div ref={hostRef} className="swatch-matrix-host" role="img" aria-label={`${alt} · ${colours.length} by ${colours.length} swatch matrix${hasTerrainLabel(terrain)}`}>
      {hasTerrain && terrain ? <div className="swatch-matrix-terrain"><GeneralizedTerrain terrain={terrain} /></div> : null}
    </div>
  );
}
