"""Verify that Build 04 gallery evidence comes from real source, script, and output bytes."""

from __future__ import annotations

import argparse
import hashlib
import json
import os
from pathlib import Path
import re
import tempfile


ROOT = Path(__file__).resolve().parents[1]
DEMO_DATA = (ROOT / "client/src/lib/demoData.ts").read_text(encoding="utf-8")

SPECIMENS = [
    {
        "id": "night-duality",
        "gallery_key": "night",
        "script": ROOT / "examples/night-duality.robby",
        "source": Path("/home/ubuntu/webdev-static-assets/robby-demo/assets/night-street.jpg"),
        "obverse": Path("/home/ubuntu/webdev-static-assets/robby-demo/output/night-obverse.png"),
        "manifest": Path("/home/ubuntu/webdev-static-assets/robby-demo/output/night-manifest.json"),
    },
    {
        "id": "ayodhya-mural",
        "gallery_key": "ayodhya",
        "script": ROOT / "examples/ayodhya-mural.robby",
        "source": Path("/home/ubuntu/webdev-static-assets/robby-gallery/assets/MS202401-Ayodhya0041.webp"),
        "obverse": Path("/home/ubuntu/webdev-static-assets/robby-gallery/output/ayodhya-mural-obverse.png"),
        "manifest": Path("/home/ubuntu/webdev-static-assets/robby-gallery/output/ayodhya-mural-manifest.json"),
    },
    {
        "id": "urban-fantasy",
        "gallery_key": "urban",
        "script": ROOT / "examples/urban-fantasy.robby",
        "source": Path("/home/ubuntu/webdev-static-assets/robby-gallery/assets/_DSF0739-Enhanced-NR.webp"),
        "obverse": Path("/home/ubuntu/webdev-static-assets/robby-gallery/output/urban-fantasy-obverse.png"),
        "manifest": Path("/home/ubuntu/webdev-static-assets/robby-gallery/output/urban-fantasy-manifest.json"),
    },
    {
        "id": "murgeshpalya-passage",
        "gallery_key": "murgeshpalya",
        "script": ROOT / "examples/murgeshpalya-passage.robby",
        "source": Path("/home/ubuntu/webdev-static-assets/robby-gallery/assets/MS201901-Murgeshpalya0018.webp"),
        "obverse": Path("/home/ubuntu/webdev-static-assets/robby-gallery/output/murgeshpalya-passage-obverse.png"),
        "manifest": Path("/home/ubuntu/webdev-static-assets/robby-gallery/output/murgeshpalya-passage-manifest.json"),
    },
    {
        "id": "uganda-diptych",
        "gallery_key": "uganda",
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


def gallery_script(key: str) -> str:
    """Return the exact String.raw gallery literal for a named specimen."""
    pattern = re.compile(rf"{re.escape(key)}: String\.raw`(.*?)`,", re.DOTALL)
    match = pattern.search(DEMO_DATA)
    if match is None:
        raise SystemExit(f"Missing gallery script literal for {key!r}")
    return match.group(1)


def write_report_atomically(path: Path, payload: dict[str, object]) -> None:
    """Publish one complete report without exposing concurrent partial writes."""
    temporary_path: Path | None = None
    try:
        with tempfile.NamedTemporaryFile(
            mode="w",
            encoding="utf-8",
            dir=path.parent,
            prefix=f".{path.name}.",
            suffix=".tmp",
            delete=False,
        ) as output:
            output.write(json.dumps(payload, indent=2) + "\n")
            output.flush()
            os.fsync(output.fileno())
            temporary_path = Path(output.name)
        os.replace(temporary_path, path)
        temporary_path = None
    finally:
        if temporary_path is not None:
            temporary_path.unlink(missing_ok=True)


def main() -> None:
    parser = argparse.ArgumentParser(description="Verify Robby Build 04 integrity evidence.")
    parser.add_argument("--out", type=Path, required=True)
    arguments = parser.parse_args()

    results: list[dict[str, object]] = []
    failures: list[str] = []
    for specimen in SPECIMENS:
        script_hash = digest(specimen["script"])
        output_hash = digest(specimen["obverse"])
        native_script_bytes = specimen["script"].read_bytes()
        browser_script = gallery_script(specimen["gallery_key"])
        browser_script_bytes = browser_script.encode("utf-8")
        manifest = json.loads(specimen["manifest"].read_text(encoding="utf-8"))
        checks = {
            "manifest_script_hash_matches": manifest["script_sha256"] == script_hash,
            "manifest_obverse_hash_matches": manifest["outputs"]["obverse"]["sha256"] == output_hash,
            "gallery_script_hash_matches": script_hash in DEMO_DATA,
            "gallery_output_hash_matches": output_hash in DEMO_DATA,
            "browser_source_bytes_match": browser_script_bytes == native_script_bytes,
            "browser_source_hash_matches": hashlib.sha256(browser_script_bytes).hexdigest() == script_hash,
        }
        if not all(checks.values()):
            failures.append(f"{specimen['id']}: {checks}")
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
    write_report_atomically(arguments.out, payload)
    if failures:
        raise SystemExit("Integrity failures:\n" + "\n".join(failures))
    print(f"Verified {len(results)} specimens: all manifest and gallery hashes match actual bytes.")


if __name__ == "__main__":
    main()
