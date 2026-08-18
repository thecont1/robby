"""Exercise the real Python executor with palette and reverse-mode changes."""

from __future__ import annotations

import hashlib
import sys
import tempfile
from pathlib import Path

from PIL import Image, ImageDraw

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from executor.run import execute


def image_hash(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def ir_for(k: int, mode: str) -> dict:
    return {
        "version": "robby-ir-v1",
        "canvas": {"base": "fixture.jpg", "width": 120, "height": 80},
        "cutouts": [],
        "layers": [],
        "palette": {"k": k},
        "reverse": [{"mode": mode, **({"k": k} if mode == "palette-grid" else {})}],
        "output": {"obverse": "obverse.png", "reverse": "inverse.png", "manifest": "manifest.json"},
        "meta": {"script_sha256": f"fixture-{mode}-{k}"},
    }


def render(root: Path, k: int, mode: str) -> str:
    output = root / f"{mode}-{k}"
    manifest = execute(ir_for(k, mode), root / "assets", output)
    reverse = manifest["reverse"][0]
    return image_hash(output / reverse["path"])


def main() -> None:
    with tempfile.TemporaryDirectory(prefix="robby-executor-test-") as directory:
        root = Path(directory)
        assets = root / "assets"
        assets.mkdir()
        image = Image.new("RGB", (120, 80), "#101016")
        draw = ImageDraw.Draw(image)
        draw.rectangle((0, 0, 39, 79), fill="#e3442f")
        draw.rectangle((40, 0, 79, 79), fill="#245cd3")
        draw.rectangle((80, 0, 119, 79), fill="#8dad2f")
        image.save(assets / "fixture.jpg", quality=95)

        palette_eight = render(root, 2, "palette-grid")
        palette_nine = render(root, 3, "palette-grid")
        provenance = render(root, 2, "provenance-map")

        assert palette_eight != palette_nine, "Changing palette k must emit a new inverse render"
        assert palette_eight != provenance, "Changing reverse mode must emit a new inverse render"
    print("Live executor palette and reverse-mode integration checks passed.")


if __name__ == "__main__":
    main()
