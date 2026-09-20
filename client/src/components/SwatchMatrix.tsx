import gsap from "gsap";
import p5 from "p5";
import { useEffect, useMemo, useRef } from "react";
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
  return terrain ? " · GPS-seeded terrain panel" : "";
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
  const terrainKey = terrain ? `${terrain.grid_size}:${terrain.heights.join(",")}` : "";

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
    const hasTerrain = Boolean(terrain && terrain.grid_size > 1 && terrain.heights.length >= terrain.grid_size * terrain.grid_size);

    const killAnimation = () => {
      schedule?.kill();
      schedule = null;
      animation?.kill();
      animation = null;
    };

    const buildSlots = () => {
      const rect = host.getBoundingClientRect();
      width = Math.max(1, Math.floor(rect.width));
      height = Math.max(1, Math.floor(rect.height));
      // The swatch field is a square anchored to the left edge; any extra
      // width on the right stays empty for the terrain panel (or blank
      // paper when the source carries no GPS evidence).
      side = Math.min(width, height);
      cellSize = side / k;
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

    // The GPS-seeded heightfield draws into a WEBGL graphics buffer so the
    // 3D surface can be composited beside the 2D matrix on one canvas.
    let terrainBuffer: p5.Graphics | null = null;
    let rebuildTerrainBuffer = () => {};
    let frame = 0;

    const sketch = new p5(instance => {
      rebuildTerrainBuffer = () => {
        terrainBuffer?.remove();
        terrainBuffer = null;
        const region = width - side;
        if (!hasTerrain || region < 8) return;
        const buffer = instance.createGraphics(region, height, instance.WEBGL);
        buffer.pixelDensity(Math.min(2, window.devicePixelRatio || 1));
        terrainBuffer = buffer;
      };

      const drawTerrain = () => {
        const g = terrainBuffer;
        const field = terrain;
        if (!g || !field) return;
        const grid = field.grid_size;
        const extent = Math.min(g.width, g.height) * 0.82;
        const step = extent / (grid - 1);
        const amplitude = extent * 0.3;
        const darkMode = document.documentElement.classList.contains("dark");
        g.clear();
        g.push();
        g.rotateY(Math.sin(frame / 340) * 0.16);
        g.rotateX(instance.radians(58));
        g.noFill();
        if (darkMode) g.stroke(232, 163, 148);
        else g.stroke(227, 68, 47);
        g.strokeWeight(1);
        const elevation = (row: number, column: number) =>
          -((field.heights[row * grid + column] ?? 0) / 255) * amplitude;
        for (let row = 0; row < grid - 1; row += 1) {
          g.beginShape(instance.TRIANGLE_STRIP);
          for (let column = 0; column < grid; column += 1) {
            const x = column * step - extent / 2;
            g.vertex(x, elevation(row, column), row * step - extent / 2);
            g.vertex(x, elevation(row + 1, column), (row + 1) * step - extent / 2);
          }
          g.endShape();
        }
        g.pop();
      };

      instance.setup = () => {
        const rect = host.getBoundingClientRect();
        instance.createCanvas(Math.max(1, Math.floor(rect.width)), Math.max(1, Math.floor(rect.height)));
        instance.pixelDensity(Math.min(2, window.devicePixelRatio || 1));
        instance.noStroke();
        buildSlots();
        rebuildTerrainBuffer();
      };

      instance.draw = () => {
        frame += 1;
        const darkMode = document.documentElement.classList.contains("dark");
        instance.background(darkMode ? 0 : 244, darkMode ? 0 : 239, darkMode ? 0 : 225);
        slots.forEach(row => row.forEach(cell => {
          const colour = colours[cell.index] ?? [0, 0, 0];
          instance.fill(...colour);
          instance.rect(cell.x, cell.y, cellSize + 0.5, cellSize + 0.5);
        }));
        if (terrainBuffer) {
          drawTerrain();
          instance.image(terrainBuffer, side, 0);
        }
      };
    }, host);

    resizeObserver = new ResizeObserver(() => {
      killAnimation();
      buildSlots();
      if (activeState && !reducedMotion) scheduleNext();
      const rect = host.getBoundingClientRect();
      const nextWidth = Math.max(1, Math.floor(rect.width));
      const nextHeight = Math.max(1, Math.floor(rect.height));
      if (sketch.width !== nextWidth || sketch.height !== nextHeight) sketch.resizeCanvas(nextWidth, nextHeight);
      rebuildTerrainBuffer();
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
      terrainBuffer?.remove();
      sketch.remove();
    };
  }, [colours, paletteKey, resetKey, seed, terrain, terrainKey]);

  return <div ref={hostRef} className="swatch-matrix-host" role="img" aria-label={`${alt} · ${colours.length} by ${colours.length} swatch matrix${hasTerrainLabel(terrain)}`} />;
}
