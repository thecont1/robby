import p5 from "p5";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPaletteMatrix, paletteMoveFor, shiftPaletteMatrix, type PaletteAxis, type PaletteMatrix } from "@/lib/paletteMosaic";

type PaletteMosaicCanvasProps = {
  palette: string[];
  seed: string;
  fallbackUrl: string;
  alt: string;
};

type ActiveGlide = {
  axis: PaletteAxis;
  index: number;
  amount: number;
  startedAt: number;
  duration: number;
  target: PaletteMatrix;
};

function hexToRgb(hex: string): [number, number, number] | null {
  const value = hex.trim().replace(/^#/, "");
  if (!/^[0-9a-f]{6}$/i.test(value)) return null;
  return [
    Number.parseInt(value.slice(0, 2), 16),
    Number.parseInt(value.slice(2, 4), 16),
    Number.parseInt(value.slice(4, 6), 16),
  ];
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function easeInOut(value: number) {
  const t = clamp(value, 0, 1);
  return t * t * (3 - 2 * t);
}

export default function PaletteMosaicCanvas({ palette, seed, fallbackUrl, alt }: PaletteMosaicCanvasProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [reducedMotion, setReducedMotion] = useState(false);
  const colours = useMemo(() => palette.map(hexToRgb).filter((colour): colour is [number, number, number] => colour !== null), [palette]);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(media.matches);
    update();
    media.addEventListener?.("change", update);
    return () => media.removeEventListener?.("change", update);
  }, []);

  useEffect(() => {
    const host = hostRef.current;
    if (!host || reducedMotion || colours.length === 0 || !seed) return;

    let matrix: PaletteMatrix = [];
    let moveNumber = 0;
    let lastMove = 0;
    let resizeObserver: ResizeObserver | null = null;
    let activeGlide: ActiveGlide | null = null;
    const sketch = new p5(instance => {
      const padding = 18;
      let rows = 1;
      let columns = 1;

      const resize = () => {
        const rect = host.getBoundingClientRect();
        const width = Math.max(1, Math.floor(rect.width));
        const height = Math.max(1, Math.floor(rect.height));
        const innerWidth = Math.max(1, width - padding * 2);
        const innerHeight = Math.max(1, height - padding * 2);
        const targetCell = Math.max(22, Math.min(48, Math.floor(Math.min(innerWidth, innerHeight) / 10)));
        columns = Math.max(1, Math.round(innerWidth / targetCell));
        rows = Math.max(1, Math.round(innerHeight / targetCell));
        matrix = createPaletteMatrix(colours.length, rows, columns, seed);
        activeGlide = null;
        lastMove = instance.millis();
        if (instance.width !== width || instance.height !== height) instance.resizeCanvas(width, height);
      };

      const drawTile = (colour: [number, number, number], left: number, top: number, tileWidth: number, tileHeight: number) => {
        instance.fill(...colour);
        instance.rect(left, top, tileWidth + 0.5, tileHeight + 0.5);
      };

      const drawWrappedTile = (colour: [number, number, number], left: number, top: number, tileWidth: number, tileHeight: number, axis: PaletteAxis, innerWidth: number, innerHeight: number) => {
        drawTile(colour, left, top, tileWidth, tileHeight);
        if (axis === "row") {
          if (left < padding) drawTile(colour, left + innerWidth, top, tileWidth, tileHeight);
          if (left + tileWidth > padding + innerWidth) drawTile(colour, left - innerWidth, top, tileWidth, tileHeight);
        } else {
          if (top < padding) drawTile(colour, left, top + innerHeight, tileWidth, tileHeight);
          if (top + tileHeight > padding + innerHeight) drawTile(colour, left, top - innerHeight, tileWidth, tileHeight);
        }
      };

      instance.setup = () => {
        const rect = host.getBoundingClientRect();
        instance.createCanvas(Math.max(1, Math.floor(rect.width)), Math.max(1, Math.floor(rect.height)));
        instance.pixelDensity(Math.min(2, window.devicePixelRatio || 1));
        instance.noStroke();
        resize();
      };

      instance.draw = () => {
        if (!resizeObserver) {
          resizeObserver = new ResizeObserver(resize);
          resizeObserver.observe(host);
        }

        const now = instance.millis();
        if (!activeGlide && now - lastMove > 900) {
          const move = paletteMoveFor(seed, moveNumber, rows, columns);
          activeGlide = {
            ...move,
            startedAt: now,
            duration: 1350,
            target: shiftPaletteMatrix(matrix, move),
          };
          moveNumber += 1;
        }

        const darkMode = document.documentElement.classList.contains("dark");
        instance.background(darkMode ? 0 : 244, darkMode ? 0 : 239, darkMode ? 0 : 225);
        const innerWidth = instance.width - padding * 2;
        const innerHeight = instance.height - padding * 2;
        const tileWidth = innerWidth / columns;
        const tileHeight = innerHeight / rows;
        const progress = activeGlide ? easeInOut((now - activeGlide.startedAt) / activeGlide.duration) : 0;

        for (let row = 0; row < rows; row += 1) {
          for (let column = 0; column < columns; column += 1) {
            if (activeGlide && ((activeGlide.axis === "row" && row === activeGlide.index) || (activeGlide.axis === "column" && column === activeGlide.index))) continue;
            const colour = colours[matrix[row]?.[column] ?? 0];
            if (colour) drawTile(colour, padding + column * tileWidth, padding + row * tileHeight, tileWidth, tileHeight);
          }
        }

        if (activeGlide) {
          for (let row = 0; row < rows; row += 1) {
            for (let column = 0; column < columns; column += 1) {
              const movingRow = activeGlide.axis === "row" && row === activeGlide.index;
              const movingColumn = activeGlide.axis === "column" && column === activeGlide.index;
              if (!movingRow && !movingColumn) continue;
              const colour = colours[matrix[row]?.[column] ?? 0];
              if (!colour) continue;
              const offset = (activeGlide.axis === "row" ? innerWidth / columns : innerHeight / rows) * activeGlide.amount * progress;
              const left = padding + column * tileWidth + (movingRow ? offset : 0);
              const top = padding + row * tileHeight + (movingColumn ? offset : 0);
              drawWrappedTile(colour, left, top, tileWidth, tileHeight, activeGlide.axis, innerWidth, innerHeight);
            }
          }
          if (progress >= 1) {
            matrix = activeGlide.target;
            activeGlide = null;
            lastMove = now;
          }
        }
      };
    }, host);

    return () => {
      resizeObserver?.disconnect();
      sketch.remove();
    };
  }, [colours, reducedMotion, seed]);

  if (reducedMotion || colours.length === 0 || !seed) {
    return <img src={fallbackUrl} alt={alt} className="object-image" />;
  }

  return <div ref={hostRef} className="palette-mosaic-host" role="img" aria-label={`${alt} · ${colours.length} swatches`} />;
}
