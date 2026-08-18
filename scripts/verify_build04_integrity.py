"""Verify that Build 04 gallery evidence comes from real source, script, and output bytes."""

from __future__ import annotations

import argparse
import hashlib
import json
import os
from pathlib import Path
import re
import tempfile

from gallery_artifacts import DEFAULT_ASSET_ROOT, resolve_gallery_artifacts


ROOT = Path(__file__).resolve().parents[1]
DEMO_DATA = (ROOT / "client/src/lib/demoData.ts").read_text(encoding="utf-8")

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


def gallery_hashes(specimen_id: str) -> tuple[str, str]:
    """Return the script and output checksums recorded for one gallery object."""
    item_pattern = re.compile(rf'id: "{re.escape(specimen_id)}",(?P<item>.*?)(?=^  \{{|^\] as const;)', re.DOTALL | re.MULTILINE)
    item = item_pattern.search(DEMO_DATA)
    if item is None:
        raise SystemExit(f"Missing gallery record for {specimen_id!r}")
    script_match = re.search(r'scriptHash: "([0-9a-f]{64})"', item.group("item"))
    output_match = re.search(r'outputHash: "([0-9a-f]{64})"', item.group("item"))
    if script_match is None or output_match is None:
        raise SystemExit(f"Missing gallery checksum fields for {specimen_id!r}")
    return script_match.group(1), output_match.group(1)


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
    parser.add_argument("--asset-root", type=Path, default=DEFAULT_ASSET_ROOT, help="Root containing robby-demo/ and robby-gallery/ artifacts.")
    arguments = parser.parse_args()

    results: list[dict[str, object]] = []
    failures: list[str] = []
    for specimen in resolve_gallery_artifacts(arguments.asset_root):
        script_hash = digest(specimen["script"])
        output_hash = digest(specimen["obverse"])
        native_script_bytes = specimen["script"].read_bytes()
        browser_script = gallery_script(specimen["gallery_key"])
        browser_script_bytes = browser_script.encode("utf-8")
        manifest = json.loads(specimen["manifest"].read_text(encoding="utf-8"))
        gallery_script_hash, gallery_output_hash = gallery_hashes(specimen["id"])
        checks = {
            "manifest_script_hash_matches": manifest["script_sha256"] == script_hash,
            "manifest_obverse_hash_matches": manifest["outputs"]["obverse"]["sha256"] == output_hash,
            "gallery_script_hash_matches": gallery_script_hash == script_hash,
            "gallery_output_hash_matches": gallery_output_hash == output_hash,
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
