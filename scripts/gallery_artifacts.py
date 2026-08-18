"""Portable paths for the local source and rendered artifacts behind the Robby gallery."""

from __future__ import annotations

from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_ASSET_ROOT = ROOT / "artifacts"

GALLERY_ARTIFACTS = (
    {
        "id": "night-duality",
        "gallery_key": "night",
        "script": "examples/night-duality.robby",
        "source": "robby-authentic-originals/IMG_20210916_185510.jpg",
        "obverse": "robby-authentic-derived/night-obverse.png",
        "manifest": "robby-authentic-derived/night-manifest.json",
    },
    {
        "id": "ayodhya-mural",
        "gallery_key": "ayodhya",
        "script": "examples/ayodhya-mural.robby",
        "source": "robby-authentic-originals/MS202401-Ayodhya0041.jpg",
        "obverse": "robby-authentic-derived/ayodhya-mural-obverse.png",
        "manifest": "robby-authentic-derived/ayodhya-mural-manifest.json",
    },
    {
        "id": "urban-fantasy",
        "gallery_key": "urban",
        "script": "examples/urban-fantasy.robby",
        "source": "robby-authentic-originals/_DSF0739-Enhanced-NR.jpg",
        "obverse": "robby-authentic-derived/urban-fantasy-obverse.png",
        "manifest": "robby-authentic-derived/urban-fantasy-manifest.json",
    },
    {
        "id": "murgeshpalya-passage",
        "gallery_key": "murgeshpalya",
        "script": "examples/murgeshpalya-passage.robby",
        "source": "robby-authentic-originals/MS201901-Murgeshpalya0018.jpg",
        "obverse": "robby-authentic-derived/murgeshpalya-passage-obverse.png",
        "manifest": "robby-authentic-derived/murgeshpalya-passage-manifest.json",
    },
    {
        "id": "uganda-diptych",
        "gallery_key": "uganda",
        "script": "examples/uganda-diptych.robby",
        "source": "robby-authentic-originals/MS201508-Uganda0016.jpg",
        "obverse": "robby-authentic-derived/uganda-diptych-obverse.png",
        "manifest": "robby-authentic-derived/uganda-diptych-manifest.json",
    },
)


def resolve_gallery_artifacts(asset_root: Path) -> list[dict[str, str | Path]]:
    """Resolve source, output, and manifest paths from a caller-provided asset root."""
    return [
        {
            **artifact,
            "script": ROOT / artifact["script"],
            "source": asset_root / artifact["source"],
            "obverse": asset_root / artifact["obverse"],
            "manifest": asset_root / artifact["manifest"],
        }
        for artifact in GALLERY_ARTIFACTS
    ]
