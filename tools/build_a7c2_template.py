#!/usr/bin/env python3
"""Build browser-ready Sony A7C II template layers from an alpha cutout."""

from __future__ import annotations

import argparse
import json
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw, ImageFilter, ImageOps


CANVAS_SIZE = (1280, 960)
TARGET_BODY_WIDTH = 1040
BODY_TOP = 240
SOURCE_SCREEN_QUAD = ((300, 435), (919, 435), (919, 853), (300, 853))


def save_png(image: Image.Image, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    image.save(path, "PNG", optimize=True)


def build(source_path: Path, destination: Path) -> dict:
    source = Image.open(source_path).convert("RGBA")
    source_alpha = source.getchannel("A")
    bbox = source_alpha.getbbox()
    if not bbox:
        raise ValueError("A7C II cutout has no opaque pixels")

    cropped = source.crop(bbox)
    scale = TARGET_BODY_WIDTH / cropped.width
    target_size = (TARGET_BODY_WIDTH, round(cropped.height * scale))
    body = cropped.resize(target_size, Image.Resampling.LANCZOS)
    body_left = (CANVAS_SIZE[0] - target_size[0]) // 2

    camera_rgba = Image.new("RGBA", CANVAS_SIZE, (0, 0, 0, 0))
    camera_rgba.alpha_composite(body, (body_left, BODY_TOP))
    camera_mask = camera_rgba.getchannel("A")

    def map_point(point: tuple[int, int]) -> tuple[int, int]:
        return (
            round(body_left + (point[0] - bbox[0]) * scale),
            round(BODY_TOP + (point[1] - bbox[1]) * scale),
        )

    screen_quad = tuple(map_point(point) for point in SOURCE_SCREEN_QUAD)
    screen_mask = Image.new("L", CANVAS_SIZE, 0)
    ImageDraw.Draw(screen_mask).polygon(screen_quad, fill=255)
    screen_mask = screen_mask.filter(ImageFilter.GaussianBlur(0.55))

    shadow_mask = Image.new("L", CANVAS_SIZE, 0)
    shadow_mask.paste(camera_mask.crop((0, 0, CANVAS_SIZE[0], CANVAS_SIZE[1] - 22)), (0, 22))
    shadow_mask = shadow_mask.filter(ImageFilter.GaussianBlur(20))
    shadow_alpha = shadow_mask.point(lambda value: round(value * 0.52))
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

    save_png(camera_rgba, destination / "camera_rgba.png")
    save_png(camera_mask, destination / "camera_mask.png")
    save_png(shadow_layer, destination / "shadow_layer.png")
    save_png(shadow_mask, destination / "shadow_mask.png")
    save_png(background_mask, destination / "background_mask.png")
    save_png(screen_mask, destination / "screen_mask.png")
    save_png(screen_shading, destination / "screen_shading.png")
    reference.convert("RGB").save(destination / "reference.jpg", "JPEG", quality=96, subsampling=0)

    metadata = {
        "screenQuad": [list(point) for point in screen_quad],
        "screenRenderSize": {"width": screen_width, "height": screen_height},
        "bodyBounds": [body_left, BODY_TOP, body_left + target_size[0], BODY_TOP + target_size[1]],
    }
    (destination / "template.json").write_text(
        json.dumps(metadata, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    return metadata


def main() -> int:
    parser = argparse.ArgumentParser(description="构建 Sony A7C II 网页模板资源")
    parser.add_argument("source", type=Path, help="透明背景 A7C II 正背面 PNG")
    parser.add_argument(
        "--destination",
        type=Path,
        default=Path(__file__).resolve().parents[1] / "public" / "assets" / "cameras" / "sony_a7c2",
    )
    args = parser.parse_args()
    print(json.dumps(build(args.source, args.destination), ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
