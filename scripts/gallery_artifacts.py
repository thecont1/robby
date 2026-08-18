"""Portable paths for the local source and rendered artifacts behind the Robby gallery."""

from __future__ import annotations

from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_ASSET_ROOT = ROOT / "artifacts"

GALLERY_ARTIFACTS = (
    {
        "id": "MS201306-BipashaAashish0192",
        "gallery_key": "MS201306-BipashaAashish0192",
        "script": "examples/MS201306-BipashaAashish0192.robby",
        "source": "robby-authentic-originals/MS201306-BipashaAashish0192.jpg",
        "obverse": "robby-authentic-derived/MS201306-BipashaAashish0192-obverse.png",
        "manifest": "robby-authentic-derived/MS201306-BipashaAashish0192-manifest.json",
    },
    {
        "id": "MS201412-AddisAbaba0315",
        "gallery_key": "MS201412-AddisAbaba0315",
        "script": "examples/MS201412-AddisAbaba0315.robby",
        "source": "robby-authentic-originals/MS201412-AddisAbaba0315.jpg",
        "obverse": "robby-authentic-derived/MS201412-AddisAbaba0315-obverse.png",
        "manifest": "robby-authentic-derived/MS201412-AddisAbaba0315-manifest.json",
    },
    {
        "id": "MS201508-Uganda0016",
        "gallery_key": "MS201508-Uganda0016",
        "script": "examples/MS201508-Uganda0016.robby",
        "source": "robby-authentic-originals/MS201508-Uganda0016.jpg",
        "obverse": "robby-authentic-derived/MS201508-Uganda0016-obverse.png",
        "manifest": "robby-authentic-derived/MS201508-Uganda0016-manifest.json",
    },
    {
        "id": "MS201804-FIDHGuinea0264",
        "gallery_key": "MS201804-FIDHGuinea0264",
        "script": "examples/MS201804-FIDHGuinea0264.robby",
        "source": "robby-authentic-originals/MS201804-FIDHGuinea0264.jpg",
        "obverse": "robby-authentic-derived/MS201804-FIDHGuinea0264-obverse.png",
        "manifest": "robby-authentic-derived/MS201804-FIDHGuinea0264-manifest.json",
    },
    {
        "id": "MS201901-Murgeshpalya0018",
        "gallery_key": "MS201901-Murgeshpalya0018",
        "script": "examples/MS201901-Murgeshpalya0018.robby",
        "source": "robby-authentic-originals/MS201901-Murgeshpalya0018.jpg",
        "obverse": "robby-authentic-derived/MS201901-Murgeshpalya0018-obverse.png",
        "manifest": "robby-authentic-derived/MS201901-Murgeshpalya0018-manifest.json",
    },
    {
        "id": "MS201904-Kashmir0594",
        "gallery_key": "MS201904-Kashmir0594",
        "script": "examples/MS201904-Kashmir0594.robby",
        "source": "robby-authentic-originals/MS201904-Kashmir0594.jpg",
        "obverse": "robby-authentic-derived/MS201904-Kashmir0594-obverse.png",
        "manifest": "robby-authentic-derived/MS201904-Kashmir0594-manifest.json",
    },
    {
        "id": "MS201910-Ghana9243",
        "gallery_key": "MS201910-Ghana9243",
        "script": "examples/MS201910-Ghana9243.robby",
        "source": "robby-authentic-originals/MS201910-Ghana9243.jpg",
        "obverse": "robby-authentic-derived/MS201910-Ghana9243-obverse.png",
        "manifest": "robby-authentic-derived/MS201910-Ghana9243-manifest.json",
    },
    {
        "id": "MS201912-Nagaland1300",
        "gallery_key": "MS201912-Nagaland1300",
        "script": "examples/MS201912-Nagaland1300.robby",
        "source": "robby-authentic-originals/MS201912-Nagaland1300.jpg",
        "obverse": "robby-authentic-derived/MS201912-Nagaland1300-obverse.png",
        "manifest": "robby-authentic-derived/MS201912-Nagaland1300-manifest.json",
    },
    {
        "id": "MS202308-Bangalore0739-Enhanced-NR",
        "gallery_key": "MS202308-Bangalore0739-Enhanced-NR",
        "script": "examples/MS202308-Bangalore0739-Enhanced-NR.robby",
        "source": "robby-authentic-originals/MS202308-Bangalore0739-Enhanced-NR.jpg",
        "obverse": "robby-authentic-derived/MS202308-Bangalore0739-Enhanced-NR-obverse.png",
        "manifest": "robby-authentic-derived/MS202308-Bangalore0739-Enhanced-NR-manifest.json",
    },
    {
        "id": "MS202309-HongKong0469-Enhanced-NR",
        "gallery_key": "MS202309-HongKong0469-Enhanced-NR",
        "script": "examples/MS202309-HongKong0469-Enhanced-NR.robby",
        "source": "robby-authentic-originals/MS202309-HongKong0469-Enhanced-NR.jpg",
        "obverse": "robby-authentic-derived/MS202309-HongKong0469-Enhanced-NR-obverse.png",
        "manifest": "robby-authentic-derived/MS202309-HongKong0469-Enhanced-NR-manifest.json",
    },
    {
        "id": "MS202401-Ayodhya0041",
        "gallery_key": "MS202401-Ayodhya0041",
        "script": "examples/MS202401-Ayodhya0041.robby",
        "source": "robby-authentic-originals/MS202401-Ayodhya0041.jpg",
        "obverse": "robby-authentic-derived/MS202401-Ayodhya0041-obverse.png",
        "manifest": "robby-authentic-derived/MS202401-Ayodhya0041-manifest.json",
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
