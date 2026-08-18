"""Compile and execute the refreshed base-only Robby gallery outside the repository."""

from __future__ import annotations

import json
import subprocess
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
ASSETS = Path("/home/ubuntu/webdev-static-assets/robby-gallery-refresh/originals")
WORK = Path("/home/ubuntu/webdev-static-assets/robby-gallery-refresh/work")
DERIVATIVES = Path("/home/ubuntu/webdev-static-assets/robby-gallery-refresh/derivatives")
COMPILER = ROOT / "target" / "release" / "robby"

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


def source_script(slug: str, filename: str) -> str:
    return f'''# Immutable source study. The original JPEG is read-only; outputs are derived artifacts.
base("{filename}")
palette(k: 8)
reverse(mode: "palette-grid", k: 8)
output(obverse: "{slug}-obverse.png", reverse: "{slug}-inverse.png", manifest: "{slug}-manifest.json")
'''


def main() -> None:
    WORK.mkdir(parents=True, exist_ok=True)
    DERIVATIVES.mkdir(parents=True, exist_ok=True)
    records: list[dict[str, str]] = []
    for slug, filename in SOURCES:
        script_path = WORK / f"{slug}.robby"
        ir_path = WORK / f"{slug}.ir.json"
        output_dir = DERIVATIVES / slug
        script_path.write_text(source_script(slug, filename), encoding="utf-8")
        subprocess.run([str(COMPILER), "compile", str(script_path), "--out", str(ir_path)], check=True)
        subprocess.run(
            ["python3", str(ROOT / "executor" / "run.py"), "--ir", str(ir_path), "--assets-root", str(ASSETS), "--out-dir", str(output_dir)],
            check=True,
        )
        manifest = json.loads((output_dir / f"{slug}-manifest.json").read_text(encoding="utf-8"))
        records.append(
            {
                "id": slug,
                "source": filename,
                "script": str(script_path),
                "ir": str(ir_path),
                "obverse": str(output_dir / f"{slug}-obverse.png"),
                "reverse": str(output_dir / f"{slug}-inverse.png"),
                "manifest": str(output_dir / f"{slug}-manifest.json"),
                "script_sha256": manifest["script_sha256"],
                "output_sha256": manifest["outputs"]["obverse"]["sha256"],
            }
        )
    (WORK / "gallery-refresh-records.json").write_text(json.dumps(records, indent=2) + "\n", encoding="utf-8")
    print(f"Rendered {len(records)} refreshed gallery specimens into {DERIVATIVES}")


if __name__ == "__main__":
    main()
