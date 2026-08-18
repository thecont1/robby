"""Print a read-only inventory of JPEG originals for Robby gallery reconciliation."""

from __future__ import annotations

import hashlib
import json
from pathlib import Path

from PIL import Image


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for block in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def main() -> None:
    source_root = Path("/home/ubuntu/projects/robby-b95711a5")
    records: list[dict[str, object]] = []
    for source in sorted(source_root.glob("*.jpg")):
        with Image.open(source) as image:
            width, height = image.size
        records.append(
            {
                "filename": source.name,
                "dimensions": f"{width} × {height}",
                "ratio": "four-three" if abs(width / height - 4 / 3) < 0.03 else "three-two",
                "bytes": source.stat().st_size,
                "sha256": sha256_file(source),
            }
        )
    print(json.dumps(records, indent=2))


if __name__ == "__main__":
    main()
