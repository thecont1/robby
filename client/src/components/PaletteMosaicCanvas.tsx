import p5 from "p5";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPaletteMatrix, paletteMoveFor, shiftPaletteMatrix } from "@/lib/paletteMosaic";

type PaletteMosaicCanvasProps = {
  palette: string[];
  seed: string;
  fallbackUrl: string;
  alt: string;
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

    let matrix: number[][] = [];
    let moveNumber = 0;
    let lastMove = 0;
    let resizeObserver: ResizeObserver | null = null;
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
        if (instance.width !== width || instance.height !== height) instance.resizeCanvas(width, height);
      };

      instance.setup = () => {
        const rect = host.getBoundingClientRect();
        instance.createCanvas(Math.max(1, Math.floor(rect.width)), Math.max(1, Math.floor(rect.height)));
        instance.pixelDensity(Math.min(2, window.devicePixelRatio || 1));
        instance.noStroke();
        resize();
        lastMove = instance.millis();
      };

      instance.draw = () => {
        if (!resizeObserver) {
          resizeObserver = new ResizeObserver(resize);
          resizeObserver.observe(host);
        }
        if (instance.millis() - lastMove > 1500) {
          matrix = shiftPaletteMatrix(matrix, paletteMoveFor(seed, moveNumber, rows, columns));
          moveNumber += 1;
          lastMove = instance.millis();
        }

        const darkMode = document.documentElement.classList.contains("dark");
        instance.background(darkMode ? 0 : 244, darkMode ? 0 : 239, darkMode ? 0 : 225);
        const width = instance.width - padding * 2;
        const height = instance.height - padding * 2;
        for (let row = 0; row < rows; row += 1) {
          for (let column = 0; column < columns; column += 1) {
            const left = padding + (column * width) / columns;
            const right = padding + ((column + 1) * width) / columns;
            const top = padding + (row * height) / rows;
            const bottom = padding + ((row + 1) * height) / rows;
            const colour = colours[matrix[row]?.[column] ?? 0];
            if (!colour) continue;
            instance.fill(...colour);
            instance.rect(left, top, right - left + 0.5, bottom - top + 0.5);
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

  return <div ref={hostRef} className="palette-mosaic-host" role="img" aria-label={alt} />;
}
