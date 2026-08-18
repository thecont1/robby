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
        "MS201306-BipashaAashish0192": ("MS201306-BipashaAashish0192.jpg", "MS201306-BipashaAashish0192-obverse.png"),
        "MS201412-AddisAbaba0315": ("MS201412-AddisAbaba0315.jpg", "MS201412-AddisAbaba0315-obverse.png"),
        "MS201508-Uganda0016": ("MS201508-Uganda0016.jpg", "MS201508-Uganda0016-obverse.png"),
        "MS201804-FIDHGuinea0264": ("MS201804-FIDHGuinea0264.jpg", "MS201804-FIDHGuinea0264-obverse.png"),
        "MS201901-Murgeshpalya0018": ("MS201901-Murgeshpalya0018.jpg", "MS201901-Murgeshpalya0018-obverse.png"),
        "MS201904-Kashmir0594": ("MS201904-Kashmir0594.jpg", "MS201904-Kashmir0594-obverse.png"),
        "MS201910-Ghana9243": ("MS201910-Ghana9243.jpg", "MS201910-Ghana9243-obverse.png"),
        "MS201912-Nagaland1300": ("MS201912-Nagaland1300.jpg", "MS201912-Nagaland1300-obverse.png"),
        "MS202309-HongKong0469-Enhanced-NR": ("MS202309-HongKong0469-Enhanced-NR.jpg", "MS202309-HongKong0469-Enhanced-NR-obverse.png"),
        "MS202401-Ayodhya0041": ("MS202401-Ayodhya0041.jpg", "MS202401-Ayodhya0041-obverse.png"),
        "MS202308-Bangalore0739-Enhanced-NR": ("MS202308-Bangalore0739-Enhanced-NR.jpg", "MS202308-Bangalore0739-Enhanced-NR-obverse.png"),
    }
    records = {
        specimen: signature(arguments.assets_root / source, arguments.renders_root / output)
        for specimen, (source, output) in mapping.items()
    }
    arguments.out.write_text(json.dumps(records, indent=2) + "\n", encoding="utf-8")
    print(f"Wrote {len(records)} authentic-source signature records to {arguments.out}")


if __name__ == "__main__":
    main()
