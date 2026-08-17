"""Derive auditable credential and colour signatures for the Robby gallery.

The credential result is intentionally conservative. A C2PA/JUMBF marker scan can
establish that no embedded credential container is present in these local source
assets; it never upgrades an arbitrary marker to "verified". Pixel signatures
are calculated from the compiled obverse bytes using the existing executor's
deterministic palette routine.
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

from executor.run import kmeans_palette  # noqa: E402


SPECIMENS = [
    {
        "id": "night-duality",
        "source": Path("/home/ubuntu/webdev-static-assets/robby-demo/assets/night-street.jpg"),
        "obverse": Path("/home/ubuntu/webdev-static-assets/robby-demo/output/night-obverse.png"),
    },
    {
        "id": "ayodhya-mural",
        "source": Path("/home/ubuntu/webdev-static-assets/robby-gallery/assets/MS202401-Ayodhya0041.webp"),
        "obverse": Path("/home/ubuntu/webdev-static-assets/robby-gallery/output/ayodhya-mural-obverse.png"),
    },
    {
        "id": "urban-fantasy",
        "source": Path("/home/ubuntu/webdev-static-assets/robby-gallery/assets/_DSF0739-Enhanced-NR.webp"),
        "obverse": Path("/home/ubuntu/webdev-static-assets/robby-gallery/output/urban-fantasy-obverse.png"),
    },
    {
        "id": "murgeshpalya-passage",
        "source": Path("/home/ubuntu/webdev-static-assets/robby-gallery/assets/MS201901-Murgeshpalya0018.webp"),
        "obverse": Path("/home/ubuntu/webdev-static-assets/robby-gallery/output/murgeshpalya-passage-obverse.png"),
    },
    {
        "id": "uganda-diptych",
        "source": Path("/home/ubuntu/webdev-static-assets/robby-gallery/assets/MS201508-Uganda0016.webp"),
        "obverse": Path("/home/ubuntu/webdev-static-assets/robby-gallery/output/uganda-diptych-obverse.png"),
    },
]


def sha256_bytes(value: bytes) -> str:
    return hashlib.sha256(value).hexdigest()


def credential_signature(source: Path) -> dict[str, object]:
    raw = source.read_bytes()
    lower = raw.lower()
    has_marker = b"c2pa" in lower or b"jumb" in lower
    return {
        "status": "unverified-marker" if has_marker else "absent",
        "source_sha256": sha256_bytes(raw),
        "marker_scan": "C2PA/JUMBF byte marker scan",
        "issuer": None,
        "edit_history": None,
        "capture_info": None,
        "note": (
            "Embedded credential marker detected; cryptographic validation is not implemented in this local build."
            if has_marker
            else "No embedded C2PA or JUMBF marker detected in the local source bytes."
        ),
    }


def colour_signature(obverse: Path) -> dict[str, object]:
    rgb = Image.open(obverse).convert("RGB")
    pixel_bytes = rgb.tobytes()
    palette = ["#{:02X}{:02X}{:02X}".format(*colour) for colour in kmeans_palette(rgb, 8)]
    palette_bytes = "|".join(palette).encode("ascii")
    return {
        "algorithm": "robby-executor-v1 deterministic k-means palette",
        "pixel_sha256": sha256_bytes(pixel_bytes),
        "palette_sha256": sha256_bytes(palette_bytes),
        "palette": palette,
        "width": rgb.width,
        "height": rgb.height,
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="Derive Robby Build 03 signatures.")
    parser.add_argument("--out", type=Path, required=True, help="Destination JSON file.")
    arguments = parser.parse_args()

    records: dict[str, object] = {}
    for specimen in SPECIMENS:
        source = specimen["source"]
        obverse = specimen["obverse"]
        if not source.is_file() or not obverse.is_file():
            raise SystemExit(f"Missing source or obverse for {specimen['id']}.")
        records[specimen["id"]] = {
            "credential_signature": credential_signature(source),
            "colour_signature": colour_signature(obverse),
        }

    arguments.out.parent.mkdir(parents=True, exist_ok=True)
    arguments.out.write_text(json.dumps(records, indent=2) + "\n", encoding="utf-8")
    print(f"Wrote {len(records)} signature records to {arguments.out}")


if __name__ == "__main__":
    main()
