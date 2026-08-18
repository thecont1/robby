"""Derive deterministic visual signatures for authentic-source gallery renders.

The source JPEGs are opened read-only. This helper never rewrites source images.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import sys
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from executor.run import kmeans_palette


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for block in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def signature(source: Path, obverse: Path) -> dict[str, object]:
    rgb = Image.open(obverse).convert("RGB")
    palette = ["#{:02X}{:02X}{:02X}".format(*colour) for colour in kmeans_palette(rgb, 8)]
    return {
        "source_sha256": sha256_file(source),
        "pixel_sha256": hashlib.sha256(rgb.tobytes()).hexdigest(),
        "palette_sha256": hashlib.sha256("|".join(palette).encode("ascii")).hexdigest(),
        "palette": palette,
        "width": rgb.width,
        "height": rgb.height,
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="Derive signatures for authenticated Robby gallery renders.")
    parser.add_argument("--assets-root", type=Path, required=True)
    parser.add_argument("--renders-root", type=Path, required=True)
    parser.add_argument("--out", type=Path, required=True)
    arguments = parser.parse_args()

    mapping = {
        "night-duality": ("IMG_20210916_185510.jpg", "night-obverse.png"),
        "ayodhya-mural": ("MS202401-Ayodhya0041.jpg", "ayodhya-mural-obverse.png"),
        "urban-fantasy": ("_DSF0739-Enhanced-NR.jpg", "urban-fantasy-obverse.png"),
        "murgeshpalya-passage": ("MS201901-Murgeshpalya0018.jpg", "murgeshpalya-passage-obverse.png"),
        "uganda-diptych": ("MS201508-Uganda0016.jpg", "uganda-diptych-obverse.png"),
    }
    records = {
        specimen: signature(arguments.assets_root / source, arguments.renders_root / specimen / output)
        for specimen, (source, output) in mapping.items()
    }
    arguments.out.write_text(json.dumps(records, indent=2) + "\n", encoding="utf-8")
    print(f"Wrote {len(records)} authentic-source signature records to {arguments.out}")


if __name__ == "__main__":
    main()
