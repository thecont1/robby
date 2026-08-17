"""Verify that Build 04 gallery evidence comes from real source, script, and output bytes."""

from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
DEMO_DATA = (ROOT / "client/src/lib/demoData.ts").read_text(encoding="utf-8")

SPECIMENS = [
    {
        "id": "night-duality",
        "script": ROOT / "examples/night-duality.robby",
        "source": Path("/home/ubuntu/webdev-static-assets/robby-demo/assets/night-street.jpg"),
        "obverse": Path("/home/ubuntu/webdev-static-assets/robby-demo/output/night-obverse.png"),
        "manifest": Path("/home/ubuntu/webdev-static-assets/robby-demo/output/night-manifest.json"),
    },
    {
        "id": "ayodhya-mural",
        "script": ROOT / "examples/ayodhya-mural.robby",
        "source": Path("/home/ubuntu/webdev-static-assets/robby-gallery/assets/MS202401-Ayodhya0041.webp"),
        "obverse": Path("/home/ubuntu/webdev-static-assets/robby-gallery/output/ayodhya-mural-obverse.png"),
        "manifest": Path("/home/ubuntu/webdev-static-assets/robby-gallery/output/ayodhya-mural-manifest.json"),
    },
    {
        "id": "urban-fantasy",
        "script": ROOT / "examples/urban-fantasy.robby",
        "source": Path("/home/ubuntu/webdev-static-assets/robby-gallery/assets/_DSF0739-Enhanced-NR.webp"),
        "obverse": Path("/home/ubuntu/webdev-static-assets/robby-gallery/output/urban-fantasy-obverse.png"),
        "manifest": Path("/home/ubuntu/webdev-static-assets/robby-gallery/output/urban-fantasy-manifest.json"),
    },
    {
        "id": "murgeshpalya-passage",
        "script": ROOT / "examples/murgeshpalya-passage.robby",
        "source": Path("/home/ubuntu/webdev-static-assets/robby-gallery/assets/MS201901-Murgeshpalya0018.webp"),
        "obverse": Path("/home/ubuntu/webdev-static-assets/robby-gallery/output/murgeshpalya-passage-obverse.png"),
        "manifest": Path("/home/ubuntu/webdev-static-assets/robby-gallery/output/murgeshpalya-passage-manifest.json"),
    },
    {
        "id": "uganda-diptych",
        "script": ROOT / "examples/uganda-diptych.robby",
        "source": Path("/home/ubuntu/webdev-static-assets/robby-gallery/assets/MS201508-Uganda0016.webp"),
        "obverse": Path("/home/ubuntu/webdev-static-assets/robby-gallery/output/uganda-diptych-obverse.png"),
        "manifest": Path("/home/ubuntu/webdev-static-assets/robby-gallery/output/uganda-diptych-manifest.json"),
    },
]


def digest(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def c2pa_marker_state(path: Path) -> str:
    value = path.read_bytes().lower()
    return "unverified-marker" if b"c2pa" in value or b"jumb" in value else "absent"


def main() -> None:
    parser = argparse.ArgumentParser(description="Verify Robby Build 04 integrity evidence.")
    parser.add_argument("--out", type=Path, required=True)
    arguments = parser.parse_args()

    results: list[dict[str, object]] = []
    for specimen in SPECIMENS:
        script_hash = digest(specimen["script"])
        output_hash = digest(specimen["obverse"])
        manifest = json.loads(specimen["manifest"].read_text(encoding="utf-8"))
        checks = {
            "manifest_script_hash_matches": manifest["script_sha256"] == script_hash,
            "manifest_obverse_hash_matches": manifest["outputs"]["obverse"]["sha256"] == output_hash,
            "gallery_script_hash_matches": script_hash in DEMO_DATA,
            "gallery_output_hash_matches": output_hash in DEMO_DATA,
        }
        if not all(checks.values()):
            raise SystemExit(f"Integrity failure for {specimen['id']}: {checks}")
        results.append(
            {
                "id": specimen["id"],
                "credential_marker_state": c2pa_marker_state(specimen["source"]),
                "script_sha256": script_hash,
                "obverse_sha256": output_hash,
                "checks": checks,
            }
        )

    payload = {"version": "robby-build-04-integrity-v1", "specimens": results}
    arguments.out.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
    print(f"Verified {len(results)} specimens: all manifest and gallery hashes match actual bytes.")


if __name__ == "__main__":
    main()
