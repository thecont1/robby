"""Execute a Robby v1 JSON IR on the CPU.

Masking is deliberately explicit. Transparent source artwork uses its supplied
alpha channel; opaque person sources use OpenCV GrabCut; sky sources use a
top-connected colour heuristic. The chosen strategy is written into the
manifest so a reverse remains an honest account of the image-making process.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import math
from collections import deque
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont


PROVENANCE_COLORS = [
    (227, 68, 47),
    (36, 92, 211),
    (214, 42, 139),
    (141, 173, 47),
    (241, 159, 48),
    (104, 67, 157),
]
EXECUTOR_VERSION = "robby-executor-v1"


class ExecutionError(RuntimeError):
    """An error that should be shown to the artist in a compact form."""


@dataclass
class PreparedLayer:
    layer_id: str
    cutout_id: str
    image: Image.Image
    mask: Image.Image
    position: tuple[int, int]
    source_path: str
    mask_strategy: str
    provenance_color: tuple[int, int, int]
    transform: dict[str, Any]


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for block in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def resolve_asset(root: Path, declared_path: str) -> Path:
    candidate = (root / declared_path).resolve()
    if root.resolve() not in candidate.parents and candidate != root.resolve():
        raise ExecutionError(f"Asset path `{declared_path}` escapes --assets-root.")
    if not candidate.is_file():
        raise ExecutionError(f"Could not find asset `{declared_path}` under `{root}`.")
    return candidate


def read_rgba(path: Path) -> Image.Image:
    try:
        return Image.open(path).convert("RGBA")
    except OSError as error:
        raise ExecutionError(f"Could not read image `{path.name}`: {error}") from error


def alpha_mask(image: Image.Image) -> Image.Image | None:
    alpha = image.getchannel("A")
    minimum, _maximum = alpha.getextrema()
    return alpha if minimum < 255 else None


def person_mask(image: Image.Image) -> tuple[Image.Image, str]:
    supplied_alpha = alpha_mask(image)
    if supplied_alpha is not None:
        return supplied_alpha, "supplied-alpha-channel"

    rgba = np.asarray(image.convert("RGBA"))
    bgr = cv2.cvtColor(rgba[:, :, :3], cv2.COLOR_RGB2BGR)
    height, width = bgr.shape[:2]
    if min(width, height) < 12:
        raise ExecutionError("A `person` source must be at least 12×12 pixels.")
    margin_x = max(1, round(width * 0.03))
    margin_y = max(1, round(height * 0.03))
    rect = (margin_x, margin_y, max(2, width - 2 * margin_x), max(2, height - 2 * margin_y))
    mask = np.zeros((height, width), np.uint8)
    background = np.zeros((1, 65), np.float64)
    foreground = np.zeros((1, 65), np.float64)
    try:
        cv2.grabCut(bgr, mask, rect, background, foreground, 4, cv2.GC_INIT_WITH_RECT)
    except cv2.error as error:
        raise ExecutionError(f"OpenCV could not segment the `person` source: {error}") from error
    foreground_mask = np.where((mask == 1) | (mask == 3), 255, 0).astype(np.uint8)
    foreground_mask = cv2.morphologyEx(foreground_mask, cv2.MORPH_OPEN, np.ones((3, 3), np.uint8))
    return Image.fromarray(foreground_mask, mode="L").filter(ImageFilter.GaussianBlur(0.7)), "opencv-grabcut-auto-foreground"


def sky_mask(image: Image.Image) -> tuple[Image.Image, str]:
    supplied_alpha = alpha_mask(image)
    if supplied_alpha is not None:
        return supplied_alpha, "supplied-alpha-channel"

    rgb = np.asarray(image.convert("RGB"), dtype=np.float32) / 255.0
    height, width, _channels = rgb.shape
    sample_height = max(1, round(height * 0.10))
    reference = np.median(rgb[:sample_height, :, :].reshape(-1, 3), axis=0)
    distance = np.linalg.norm(rgb - reference, axis=2)
    candidate = (distance < 0.34).astype(np.uint8)
    components, labels = cv2.connectedComponents(candidate)
    top_labels = {int(value) for value in labels[0, :] if value != 0}
    selected = np.isin(labels, list(top_labels)).astype(np.uint8) * 255
    if components <= 1 or not top_labels:
        selected[:sample_height, :] = 255
    selected = cv2.morphologyEx(selected, cv2.MORPH_CLOSE, np.ones((5, 5), np.uint8))
    return Image.fromarray(selected, mode="L").filter(ImageFilter.GaussianBlur(0.8)), "top-connected-sky-heuristic"


def make_mask(image: Image.Image, mask_type: str) -> tuple[Image.Image, str]:
    if mask_type == "person":
        return person_mask(image)
    if mask_type == "sky":
        return sky_mask(image)
    raise ExecutionError(f"Unsupported mask type `{mask_type}` in the IR.")


def apply_mask(image: Image.Image, mask: Image.Image) -> Image.Image:
    rgba = image.convert("RGBA")
    original_alpha = np.asarray(rgba.getchannel("A"), dtype=np.uint16)
    mask_array = np.asarray(mask, dtype=np.uint16)
    merged_alpha = ((original_alpha * mask_array) / 255).astype(np.uint8)
    rgba.putalpha(Image.fromarray(merged_alpha, mode="L"))
    return rgba


def transform_cutout(image: Image.Image, mask: Image.Image, layer: dict[str, Any], canvas_size: tuple[int, int]) -> tuple[Image.Image, Image.Image, tuple[int, int]]:
    scale = float(layer["scale"])
    rotation = float(layer["rotation"])
    scaled_size = (max(1, round(image.width * scale)), max(1, round(image.height * scale)))
    transformed_image = image.resize(scaled_size, Image.Resampling.LANCZOS)
    transformed_mask = mask.resize(scaled_size, Image.Resampling.LANCZOS)
    if rotation:
        transformed_image = transformed_image.rotate(-rotation, expand=True, resample=Image.Resampling.BICUBIC)
        transformed_mask = transformed_mask.rotate(-rotation, expand=True, resample=Image.Resampling.BICUBIC)
    canvas_width, canvas_height = canvas_size
    center_x = round(float(layer["x"]) * canvas_width)
    center_y = round(float(layer["y"]) * canvas_height)
    position = (center_x - transformed_image.width // 2, center_y - transformed_image.height // 2)
    return transformed_image, transformed_mask, position


def blend_rgb(background: np.ndarray, source: np.ndarray, mode: str) -> np.ndarray:
    if mode == "normal":
        return source
    if mode == "multiply":
        return background * source
    if mode == "screen":
        return 1.0 - (1.0 - background) * (1.0 - source)
    if mode == "overlay":
        return np.where(background <= 0.5, 2 * background * source, 1 - 2 * (1 - background) * (1 - source))
    raise ExecutionError(f"Unsupported blend mode `{mode}` in the IR.")


def composite_layer(canvas: Image.Image, layer: PreparedLayer) -> None:
    placement = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
    placement.alpha_composite(layer.image, layer.position)
    base = np.asarray(canvas.convert("RGBA"), dtype=np.float32) / 255.0
    source = np.asarray(placement, dtype=np.float32) / 255.0
    alpha = source[:, :, 3:4]
    mixed = blend_rgb(base[:, :, :3], source[:, :, :3], layer.transform["blend"])
    output_rgb = mixed * alpha + base[:, :, :3] * (1.0 - alpha)
    result = np.dstack((output_rgb, np.ones_like(alpha)))
    canvas.paste(Image.fromarray(np.clip(result * 255, 0, 255).astype(np.uint8), mode="RGBA"))


def draw_provenance(canvas_size: tuple[int, int], layers: list[PreparedLayer]) -> Image.Image:
    provenance = Image.new("RGBA", canvas_size, (28, 26, 25, 255))
    for layer in layers:
        color = Image.new("RGBA", layer.image.size, (*layer.provenance_color, 255))
        labelled = Image.new("RGBA", canvas_size, (0, 0, 0, 0))
        labelled.alpha_composite(color, layer.position)
        mask_canvas = Image.new("L", canvas_size, 0)
        mask_canvas.paste(layer.mask, layer.position)
        labelled.putalpha(mask_canvas)
        provenance.alpha_composite(labelled)
    overlay = Image.new("RGBA", canvas_size, (0, 0, 0, 0))
    rule = ImageDraw.Draw(overlay)
    width, height = canvas_size
    for x in range(0, width, max(80, width // 12)):
        rule.line((x, 0, x, height), fill=(247, 241, 225, 26), width=1)
    for y in range(0, height, max(80, height // 9)):
        rule.line((0, y, width, y), fill=(247, 241, 225, 26), width=1)
    provenance.alpha_composite(overlay)
    return provenance


def kmeans_palette(image: Image.Image, k: int) -> list[tuple[int, int, int]]:
    rgb = np.asarray(image.convert("RGB"), dtype=np.float32).reshape(-1, 3)
    stride = max(1, len(rgb) // 50_000)
    samples = rgb[::stride]
    if len(samples) < k:
        raise ExecutionError("The image does not have enough pixels to calculate the requested palette.")
    indices = np.linspace(0, len(samples) - 1, k, dtype=int)
    centers = samples[indices].copy()
    for _ in range(16):
        chunk_size = 5_000
        assignments = np.empty(len(samples), dtype=np.int16)
        for start in range(0, len(samples), chunk_size):
            chunk = samples[start : start + chunk_size]
            distances = np.sum((chunk[:, None, :] - centers[None, :, :]) ** 2, axis=2)
            assignments[start : start + len(chunk)] = np.argmin(distances, axis=1)
        next_centers = centers.copy()
        for index in range(k):
            members = samples[assignments == index]
            if len(members):
                next_centers[index] = members.mean(axis=0)
        if np.allclose(next_centers, centers, atol=1.0):
            centers = next_centers
            break
        centers = next_centers
    counts = np.bincount(assignments, minlength=k)
    ordered = centers[np.argsort(-counts)]
    return [tuple(int(round(channel)) for channel in color) for color in ordered]


def draw_palette_grid(palette: list[tuple[int, int, int]], size: tuple[int, int]) -> Image.Image:
    width, height = size
    art = Image.new("RGBA", size, (246, 239, 221, 255))
    draw = ImageDraw.Draw(art)
    columns = math.ceil(math.sqrt(len(palette)))
    rows = math.ceil(len(palette) / columns)
    gap = max(10, min(width, height) // 80)
    margin = max(28, min(width, height) // 18)
    cell_width = (width - 2 * margin - (columns - 1) * gap) // columns
    cell_height = (height - 2 * margin - (rows - 1) * gap) // rows
    for index, color in enumerate(palette):
        row, column = divmod(index, columns)
        left = margin + column * (cell_width + gap)
        top = margin + row * (cell_height + gap)
        draw.rectangle((left, top, left + cell_width, top + cell_height), fill=(*color, 255))
        draw.line((left, top, left + cell_width, top), fill=(28, 26, 25, 255), width=max(1, gap // 4))
    return art


def output_path(out_dir: Path, declared: str, mode: str, reverse_count: int) -> Path:
    path = Path(declared)
    suffix = path.suffix or ".png"
    if reverse_count == 1:
        return out_dir / path.with_suffix(suffix)
    return out_dir / f"{path.stem}-{mode}{suffix}"


def crop_bounds(mask: Image.Image, position: tuple[int, int], canvas_size: tuple[int, int]) -> list[int] | None:
    box = mask.getbbox()
    if box is None:
        return None
    left = max(0, position[0] + box[0])
    top = max(0, position[1] + box[1])
    right = min(canvas_size[0], position[0] + box[2])
    bottom = min(canvas_size[1], position[1] + box[3])
    return [left, top, right, bottom] if right > left and bottom > top else None


def execute(ir: dict[str, Any], assets_root: Path, out_dir: Path) -> dict[str, Any]:
    if ir.get("version") != "robby-ir-v1":
        raise ExecutionError("Expected a `robby-ir-v1` document.")
    out_dir.mkdir(parents=True, exist_ok=True)
    canvas_config = ir["canvas"]
    base_path = resolve_asset(assets_root, canvas_config["base"])
    base = read_rgba(base_path)
    requested_size = (canvas_config.get("width"), canvas_config.get("height"))
    if all(requested_size):
        base = base.resize((int(requested_size[0]), int(requested_size[1])), Image.Resampling.LANCZOS)
    canvas = base.copy()
    cutouts = {item["id"]: item for item in ir["cutouts"]}
    prepared_layers: list[PreparedLayer] = []
    assets: dict[str, dict[str, Any]] = {}

    def record_asset(path: Path, declared: str) -> None:
        if declared not in assets:
            image = read_rgba(path)
            assets[declared] = {
                "path": declared,
                "sha256": sha256_file(path),
                "bytes": path.stat().st_size,
                "width": image.width,
                "height": image.height,
            }

    record_asset(base_path, canvas_config["base"])
    for index, layer_config in enumerate(ir["layers"], start=1):
        cutout = cutouts[layer_config["cutout"]]
        source_path = resolve_asset(assets_root, cutout["source"])
        record_asset(source_path, cutout["source"])
        source_image = read_rgba(source_path)
        mask, strategy = make_mask(source_image, cutout["mask"])
        masked = apply_mask(source_image, mask)
        opacity = float(layer_config["opacity"])
        if opacity != 1.0:
            adjusted_alpha = np.asarray(masked.getchannel("A"), dtype=np.float32) * opacity
            masked.putalpha(Image.fromarray(adjusted_alpha.astype(np.uint8), mode="L"))
        transformed_image, transformed_mask, position = transform_cutout(masked, mask, layer_config, canvas.size)
        color = PROVENANCE_COLORS[(index - 1) % len(PROVENANCE_COLORS)]
        prepared = PreparedLayer(
            layer_id=f"layer-{index}",
            cutout_id=cutout["id"],
            image=transformed_image,
            mask=transformed_mask,
            position=position,
            source_path=cutout["source"],
            mask_strategy=strategy,
            provenance_color=color,
            transform=layer_config,
        )
        composite_layer(canvas, prepared)
        prepared_layers.append(prepared)

    output_config = ir["output"]
    obverse_path = out_dir / output_config["obverse"]
    obverse_path.parent.mkdir(parents=True, exist_ok=True)
    canvas.convert("RGB").save(obverse_path)
    palette_config = ir.get("palette")
    palette_cache: dict[int, list[tuple[int, int, int]]] = {}
    reverse_records = []
    for reverse in ir["reverse"]:
        mode = reverse["mode"]
        reverse_path = output_path(out_dir, output_config["reverse"], mode, len(ir["reverse"]))
        reverse_path.parent.mkdir(parents=True, exist_ok=True)
        if mode == "provenance-map":
            reverse_image = draw_provenance(canvas.size, prepared_layers)
        elif mode == "palette-grid":
            k = int(reverse["k"] or (palette_config or {"k": 6})["k"])
            palette_cache.setdefault(k, kmeans_palette(canvas, k))
            reverse_image = draw_palette_grid(palette_cache[k], canvas.size)
        else:
            raise ExecutionError(f"Unsupported reverse mode `{mode}` in the IR.")
        reverse_image.convert("RGB").save(reverse_path)
        reverse_records.append({"mode": mode, "path": reverse_path.name, "sha256": sha256_file(reverse_path)})

    manifest_path = out_dir / output_config["manifest"]
    manifest = {
        "version": "robby-manifest-v1",
        "executor": EXECUTOR_VERSION,
        "script_sha256": ir.get("meta", {}).get("script_sha256"),
        "assets": list(assets.values()),
        "cutouts": ir["cutouts"],
        "layers": [
            {
                "id": layer.layer_id,
                "cutout": layer.cutout_id,
                "source": layer.source_path,
                "mask_strategy": layer.mask_strategy,
                "provenance_color": "#{:02X}{:02X}{:02X}".format(*layer.provenance_color),
                "bounding_box": crop_bounds(layer.mask, layer.position, canvas.size),
                "transform": layer.transform,
            }
            for layer in prepared_layers
        ],
        "palette": [{"k": k, "colors": ["#{:02X}{:02X}{:02X}".format(*color) for color in colors]} for k, colors in palette_cache.items()],
        "reverse": reverse_records,
        "outputs": {
            "obverse": {"path": obverse_path.name, "sha256": sha256_file(obverse_path)},
            "manifest": {"path": manifest_path.name},
        },
        "graph": {
            "nodes": [
                {"id": "base", "type": "base", "label": canvas_config["base"]},
                *[
                    {"id": f"cutout:{item['id']}", "type": "cutout", "label": item["id"], "mask": item["mask"]}
                    for item in ir["cutouts"]
                ],
                *[
                    {"id": layer.layer_id, "type": "place", "label": layer.cutout_id, "provenance_color": "#{:02X}{:02X}{:02X}".format(*layer.provenance_color)}
                    for layer in prepared_layers
                ],
                {"id": "obverse", "type": "output", "label": obverse_path.name},
                *[{"id": f"reverse:{item['mode']}", "type": "reverse", "label": item["path"]} for item in reverse_records],
            ],
            "edges": [
                *[{"from": "base", "to": layer.layer_id} for layer in prepared_layers],
                *[{"from": f"cutout:{layer.cutout_id}", "to": layer.layer_id} for layer in prepared_layers],
                *[{"from": layer.layer_id, "to": "obverse"} for layer in prepared_layers],
                *[{"from": "obverse", "to": f"reverse:{item['mode']}"} for item in reverse_records],
            ],
        },
    }
    manifest_path.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    manifest["outputs"]["manifest"]["sha256"] = sha256_file(manifest_path)
    manifest_path.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    return manifest


def main() -> None:
    parser = argparse.ArgumentParser(description="Execute a Robby v1 JSON IR.")
    parser.add_argument("--ir", type=Path, required=True, help="The compiler-generated robby-ir-v1 JSON file.")
    parser.add_argument("--assets-root", type=Path, required=True, help="Directory containing base and cutout assets.")
    parser.add_argument("--out-dir", type=Path, required=True, help="Directory for obverse, reverse, and manifest files.")
    arguments = parser.parse_args()
    try:
        ir = json.loads(arguments.ir.read_text(encoding="utf-8"))
        manifest = execute(ir, arguments.assets_root, arguments.out_dir)
    except (OSError, json.JSONDecodeError, ExecutionError) as error:
        raise SystemExit(f"Robby executor error: {error}") from error
    print(f"Rendered {manifest['outputs']['obverse']['path']} and {len(manifest['reverse'])} reverse image(s).")


if __name__ == "__main__":
    main()

