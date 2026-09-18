import gsap from "gsap";
import p5 from "p5";
import { useEffect, useMemo, useRef } from "react";
import { seededPermutation, splitMix32 } from "@/lib/swatchSeed";

type Rgb = [number, number, number];

type SwatchMatrixProps = {
  swatches: readonly string[];
  seed: number;
  active: boolean;
  resetKey: string;
  alt: string;
};

type Cell = {
  index: number;
  x: number;
  y: number;
};

type MatrixController = {
  setActive: (active: boolean) => void;
};

function hexToRgb(value: string): Rgb {
  const hex = value.trim().replace(/^#/, "");
  if (!/^[0-9a-f]{6}$/i.test(hex)) return [0, 0, 0];
  return [
    Number.parseInt(hex.slice(0, 2), 16),
    Number.parseInt(hex.slice(2, 4), 16),
    Number.parseInt(hex.slice(4, 6), 16),
  ];
}

function easeInOut(value: number) {
  return value * value * (3 - 2 * value);
}

/**
 * A provenance-seeded, full-face reverse artwork. The palette remains in
 * canonical compiler order; only its animated spatial arrangement changes.
 */
export default function SwatchMatrix({ swatches, seed, active, resetKey, alt }: SwatchMatrixProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const controllerRef = useRef<MatrixController | null>(null);
  const paletteKey = swatches.join("|");
  const colours = useMemo(() => swatches.map(hexToRgb), [paletteKey, swatches]);

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
    let cellSize = 1;
    let gridLeft = 0;
    let gridTop = 0;
    let moveNumber = 0;
    const choreography = splitMix32(seed ^ 0x6d2b79f5);
    const k = colours.length;
    const columnIdentities = Array.from({ length: k }, (_, column) => seededPermutation(k, (seed + k + column) >>> 0));

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
      const side = Math.min(width, height);
      cellSize = side / k;
      gridLeft = (width - side) / 2;
      gridTop = (height - side) / 2;
      const rowPermutations = Array.from({ length: k }, (_, row) => seededPermutation(k, (seed + row) >>> 0));
      slots = rowPermutations.map((row, rowIndex) => row.map((index, columnIndex) => ({
        index,
        x: gridLeft + columnIndex * cellSize,
        y: gridTop + rowIndex * cellSize,
      })));
    };

    const swapRows = (first: number, second: number) => {
      const firstRow = slots[first];
      const secondRow = slots[second];
      if (!firstRow || !secondRow) return;
      animation = gsap.timeline({
        defaults: { duration: 0.6, ease: "power2.inOut" },
        onComplete: () => {
          slots[first] = secondRow;
          slots[second] = firstRow;
          animation = null;
          scheduleNext();
        },
      });
      firstRow.forEach(cell => animation?.to(cell, { y: gridTop + second * cellSize }, 0));
      secondRow.forEach(cell => animation?.to(cell, { y: gridTop + first * cellSize }, 0));
    };

    const swapColumns = (first: number, second: number) => {
      const firstColumn = slots.map(row => row[first]).filter((cell): cell is Cell => Boolean(cell));
      const secondColumn = slots.map(row => row[second]).filter((cell): cell is Cell => Boolean(cell));
      if (firstColumn.length !== k || secondColumn.length !== k) return;
      animation = gsap.timeline({
        defaults: { duration: 0.6, ease: "power2.inOut" },
        onComplete: () => {
          slots.forEach((row, rowIndex) => {
            [row[first], row[second]] = [row[second], row[first]];
          });
          animation = null;
          scheduleNext();
        },
      });
      firstColumn.forEach(cell => animation?.to(cell, { x: gridLeft + second * cellSize }, 0));
      secondColumn.forEach(cell => animation?.to(cell, { x: gridLeft + first * cellSize }, 0));
    };

    const startMove = () => {
      schedule = null;
      if (!activeState || reducedMotion || animation || k < 2) {
        if (activeState && !reducedMotion && k >= 2) scheduleNext();
        return;
      }
      const first = choreography() % k;
      let second = choreography() % k;
      if (second === first) second = (second + 1) % k;
      if (moveNumber % 2 === 0) swapRows(first, second);
      else {
        const columnOrder = columnIdentities[moveNumber % k] ?? [];
        swapColumns(columnOrder[first], columnOrder[second]);
      }
      moveNumber += 1;
    };

    function scheduleNext() {
      if (!activeState || reducedMotion || animation || k < 2) return;
      const delay = 1.5 + (choreography() % 100) / 100 * 2;
      schedule = gsap.delayedCall(delay, startMove);
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

    const sketch = new p5(instance => {
      instance.setup = () => {
        const rect = host.getBoundingClientRect();
        instance.createCanvas(Math.max(1, Math.floor(rect.width)), Math.max(1, Math.floor(rect.height)));
        instance.pixelDensity(Math.min(2, window.devicePixelRatio || 1));
        instance.noStroke();
        buildSlots();
      };

      instance.draw = () => {
        const darkMode = document.documentElement.classList.contains("dark");
        instance.background(darkMode ? 0 : 244, darkMode ? 0 : 239, darkMode ? 0 : 225);
        const progress = animation ? easeInOut(Math.min(1, animation.progress())) : 0;
        void progress;
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
      const rect = host.getBoundingClientRect();
      const nextWidth = Math.max(1, Math.floor(rect.width));
      const nextHeight = Math.max(1, Math.floor(rect.height));
      if (sketch.width !== nextWidth || sketch.height !== nextHeight) sketch.resizeCanvas(nextWidth, nextHeight);
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

  return <div ref={hostRef} className="swatch-matrix-host" role="img" aria-label={`${alt} · ${colours.length} by ${colours.length} swatch matrix`} />;
}
