"""Derive display metadata from already-rendered Robby gallery artifacts."""

from __future__ import annotations

import hashlib
import json
from pathlib import Path

from PIL import Image


WORK = Path("/home/ubuntu/webdev-static-assets/robby-gallery-refresh/work")


def pixel_sha256(path: Path) -> str:
    with Image.open(path) as image:
        return hashlib.sha256(image.convert("RGB").tobytes()).hexdigest()


def marker_present(source: Path) -> bool:
    payload = source.read_bytes().lower()
    return any(marker in payload for marker in (b"c2pa", b"jumbf"))


def main() -> None:
    records = json.loads((WORK / "gallery-refresh-records.json").read_text(encoding="utf-8"))
    for record in records:
        manifest = json.loads(Path(record["manifest"]).read_text(encoding="utf-8"))
        source = Path("/home/ubuntu/webdev-static-assets/robby-gallery-refresh/originals") / record["source"]
        record.update(
            {
                "dimensions": f"{manifest['assets'][0]['width']} × {manifest['assets'][0]['height']}",
                "source_sha256": manifest["assets"][0]["sha256"],
                "pixel_sha256": pixel_sha256(Path(record["obverse"])),
                "palette_sha256": hashlib.sha256("|".join(manifest["palette"][0]["colors"]).encode("ascii")).hexdigest(),
                "palette": manifest["palette"][0]["colors"],
                "c2pa_marker_present": marker_present(source),
            }
        )
    (WORK / "gallery-refresh-catalog.json").write_text(json.dumps(records, indent=2) + "\n", encoding="utf-8")
    print(f"Wrote {len(records)} measured refreshed-gallery catalogue records")


if __name__ == "__main__":
    main()
