"""Shared slug/filename registry for the Robby gallery build and signature workflows."""

from __future__ import annotations

import os
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]

DEFAULT_GALLERY_ROOT = Path("/home/ubuntu/webdev-static-assets/robby-gallery-refresh")

SOURCES = (
    ("MS201306-BipashaAashish0192", "MS201306-BipashaAashish0192.jpg"),
    ("MS201412-AddisAbaba0315", "MS201412-AddisAbaba0315.jpg"),
    ("MS201508-Uganda0016", "MS201508-Uganda0016.jpg"),
    ("MS201804-FIDHGuinea0264", "MS201804-FIDHGuinea0264.jpg"),
    ("MS201901-Murgeshpalya0018", "MS201901-Murgeshpalya0018.jpg"),
    ("MS201904-Kashmir0594", "MS201904-Kashmir0594.jpg"),
    ("MS201910-Ghana9243", "MS201910-Ghana9243.jpg"),
    ("MS201912-Nagaland1300", "MS201912-Nagaland1300.jpg"),
    ("MS202309-HongKong0469-Enhanced-NR", "MS202309-HongKong0469-Enhanced-NR.jpg"),
    ("MS202401-Ayodhya0041", "MS202401-Ayodhya0041.jpg"),
    ("MS202308-Bangalore0739-Enhanced-NR", "MS202308-Bangalore0739-Enhanced-NR.jpg"),
)


def resolve_gallery_root(cli_root: str | Path | None = None) -> Path:
    """Resolve the gallery root from CLI argument, env var, or default."""
    if cli_root is not None:
        return Path(cli_root)
    env = os.environ.get("ROBBY_GALLERY_ROOT")
    if env:
        return Path(env)
    return DEFAULT_GALLERY_ROOT


def gallery_paths(root: str | Path | None = None) -> dict[str, Path]:
    """Return the standard asset, work, and derivatives paths under a gallery root."""
    base = resolve_gallery_root(root)
    return {
        "assets": base / "originals",
        "work": base / "work",
        "derivatives": base / "derivatives",
    }
