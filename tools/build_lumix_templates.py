#!/usr/bin/env python3
"""Build LUMIX camera template layers from alpha cutouts with hollowed LCDs.

Each source cutout is a transparent-background camera image whose LCD screen
area has been removed (alpha = 0). The screen rectangle is detected
automatically via flood fill, so no manual corner coordinates are needed.
S1RM2 / S5M2X / S9 share the same 3:2 rear LCD across the series, but each
body has its own geometry, so coordinates are derived per source image.
"""

from __future__ import annotations

import argparse
import json
from dataclasses import dataclass
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw, ImageFilter, ImageOps

try:
    from scipy import ndimage
except ImportError:  # pragma: no cover
    ndimage = None


CANVAS_SIZE = (1280, 960)
TARGET_BODY_WIDTH = 1080


@dataclass(frozen=True)
class CameraSpec:
    camera_id: str
    label: str
    source_name: str


CAMERAS = {
    "s1rm2": CameraSpec("s1rm2", "LUMIX S1(R)M2(E)", "s1rm2_cutout.png"),
    "s5m2x": CameraSpec("s5m2x", "LUMIX S5M2(X)", "s5m2x_cutout.png"),
    "s9": CameraSpec("s9", "LUMIX S9", "s9_cutout.png"),
}


def save_png(image: Image.Image, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    image.save(path, "PNG", optimize=True)


def detect_screen_quad(source: Image.Image) -> tuple[tuple[int, int], tuple[int, int], tuple[int, int], tuple[int, int]]:
    """Return the largest rectangular hole (TL, TR, BR, BL) inside the opaque body."""
    import numpy as np

    alpha = np.asarray(source.getchannel("A")) > 128
    if ndimage is None:
        raise RuntimeError("检测屏幕孔洞需要 scipy，请先安装：pip install scipy")
    background = ~alpha
    labels, count = ndimage.label(background)
    border = set(labels[0, :]) | set(labels[-1, :]) | set(labels[:, 0]) | set(labels[:, -1])
    exterior = np.isin(labels, list(border))
    hole = background & ~exterior
    if int(hole.sum()) < 10_000:
        raise ValueError("未在机身内部检测到足够的屏幕镂空区域。")

    ys, xs = np.where(hole)
    y0, y1, x0, x1 = int(ys.min()), int(ys.max()), int(xs.min()), int(xs.max())
    fill = hole[y0 : y1 + 1, x0 : x1 + 1].mean()
    if fill < 0.97:
        raise ValueError(f"屏幕镂空区域不是矩形（填充率 {fill:.2f}），无法用作模板。")
    return ((x0, y0), (x1, y0), (x1, y1), (x0, y1))


def build(spec: CameraSpec, source_root: Path, destination_root: Path) -> dict:
    source = Image.open(source_root / spec.source_name).convert("RGBA")
    bbox = source.getchannel("A").getbbox()
    if not bbox:
        raise ValueError(f"{spec.label} cutout has no opaque pixels")

    cropped = source.crop(bbox)
    scale = TARGET_BODY_WIDTH / cropped.width
    target_size = (TARGET_BODY_WIDTH, round(cropped.height * scale))
    body = cropped.resize(target_size, Image.Resampling.LANCZOS)
    body_left = (CANVAS_SIZE[0] - target_size[0]) // 2
    body_top = max(0, (CANVAS_SIZE[1] - target_size[1]) // 2)

    camera_rgba = Image.new("RGBA", CANVAS_SIZE, (0, 0, 0, 0))
    camera_rgba.alpha_composite(body, (body_left, body_top))
    camera_mask = camera_rgba.getchannel("A")

    def map_point(point: tuple[int, int]) -> tuple[int, int]:
        return (
            round(body_left + (point[0] - bbox[0]) * scale),
            round(body_top + (point[1] - bbox[1]) * scale),
        )

    source_quad = detect_screen_quad(source)
    screen_quad = tuple(map_point(point) for point in source_quad)
    screen_mask = Image.new("L", CANVAS_SIZE, 0)
    ImageDraw.Draw(screen_mask).polygon(screen_quad, fill=255)
    screen_mask = screen_mask.filter(ImageFilter.GaussianBlur(0.55))

    shadow_mask = Image.new("L", CANVAS_SIZE, 0)
    shadow_mask.paste(camera_mask.crop((0, 0, CANVAS_SIZE[0], CANVAS_SIZE[1] - 18)), (0, 18))
    shadow_mask = shadow_mask.filter(ImageFilter.GaussianBlur(19))
    shadow_alpha = shadow_mask.point(lambda value: round(value * 0.50))
    shadow_layer = Image.new("RGBA", CANVAS_SIZE, (0, 0, 0, 0))
    shadow_layer.putalpha(shadow_alpha)

    background_mask = ImageChops.invert(camera_mask)

    screen_width = max(1, screen_quad[1][0] - screen_quad[0][0])
    screen_height = max(1, screen_quad[3][1] - screen_quad[0][1])
    vertical = Image.linear_gradient("L").resize((screen_width, screen_height))
    screen_shading = ImageOps.colorize(vertical, black="#d8d8d8", white="#f4f4f4").convert("RGB")

    base_gradient = Image.linear_gradient("L").resize(CANVAS_SIZE)
    reference = ImageOps.colorize(base_gradient, black="#eeeeee", white="#d9d9d9").convert("RGBA")
    reference.alpha_composite(shadow_layer)

    destination = destination_root / spec.camera_id
    save_png(camera_rgba, destination / "camera_rgba.png")
    save_png(camera_mask, destination / "camera_mask.png")
    save_png(shadow_layer, destination / "shadow_layer.png")
    save_png(shadow_mask, destination / "shadow_mask.png")
    save_png(background_mask, destination / "background_mask.png")
    save_png(screen_mask, destination / "screen_mask.png")
    save_png(screen_shading, destination / "screen_shading.png")
    reference.convert("RGB").save(destination / "reference.jpg", "JPEG", quality=96, subsampling=0)

    metadata = {
        "id": spec.camera_id,
        "label": spec.label,
        "screenQuad": [list(point) for point in screen_quad],
        "screenRenderSize": {"width": screen_width, "height": screen_height},
        "bodyBounds": [body_left, body_top, body_left + target_size[0], body_top + target_size[1]],
    }
    (destination / "template.json").write_text(
        json.dumps(metadata, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    return metadata


def main() -> int:
    project_root = Path(__file__).resolve().parents[1]
    parser = argparse.ArgumentParser(description="构建 LUMIX 网页模板资源")
    parser.add_argument("--camera", choices=["all", *CAMERAS], default="all")
    parser.add_argument("--source-root", type=Path, default=project_root / "tools" / "template_sources")
    parser.add_argument("--destination-root", type=Path, default=project_root / "public" / "assets" / "cameras")
    args = parser.parse_args()

    selected = CAMERAS.values() if args.camera == "all" else (CAMERAS[args.camera],)
    results = [build(spec, args.source_root, args.destination_root) for spec in selected]
    print(json.dumps(results, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
