#!/usr/bin/env python3
"""Build browser-ready Nikon Zf and SIGMA BF template layers."""

from __future__ import annotations

import argparse
import json
from dataclasses import dataclass
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw, ImageFilter, ImageOps


CANVAS_SIZE = (1280, 960)


@dataclass(frozen=True)
class CameraSpec:
    camera_id: str
    label: str
    source_name: str
    target_width: int
    body_top: int
    source_screen_quad: tuple[tuple[int, int], tuple[int, int], tuple[int, int], tuple[int, int]]


CAMERAS = {
    "nikon_zf": CameraSpec(
        camera_id="nikon_zf",
        label="Nikon Zf",
        source_name="nikon_zf_cutout.png",
        target_width=1080,
        body_top=180,
        source_screen_quad=((415, 469), (881, 469), (881, 777), (415, 777)),
    ),
    "sigma_bf": CameraSpec(
        camera_id="sigma_bf",
        label="SIGMA BF",
        source_name="sigma_bf_cutout.png",
        target_width=1080,
        body_top=270,
        source_screen_quad=((145, 352), (742, 352), (742, 802), (145, 802)),
    ),
}


def save_png(image: Image.Image, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    image.save(path, "PNG", optimize=True)


def build(spec: CameraSpec, source_root: Path, destination_root: Path) -> dict:
    source_path = source_root / spec.source_name
    source = Image.open(source_path).convert("RGBA")
    bbox = source.getchannel("A").getbbox()
    if not bbox:
        raise ValueError(f"{spec.label} cutout has no opaque pixels")

    cropped = source.crop(bbox)
    scale = spec.target_width / cropped.width
    target_size = (spec.target_width, round(cropped.height * scale))
    body = cropped.resize(target_size, Image.Resampling.LANCZOS)
    body_left = (CANVAS_SIZE[0] - target_size[0]) // 2

    camera_rgba = Image.new("RGBA", CANVAS_SIZE, (0, 0, 0, 0))
    camera_rgba.alpha_composite(body, (body_left, spec.body_top))
    camera_mask = camera_rgba.getchannel("A")

    def map_point(point: tuple[int, int]) -> tuple[int, int]:
        return (
            round(body_left + (point[0] - bbox[0]) * scale),
            round(spec.body_top + (point[1] - bbox[1]) * scale),
        )

    screen_quad = tuple(map_point(point) for point in spec.source_screen_quad)
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
        "bodyBounds": [body_left, spec.body_top, body_left + target_size[0], spec.body_top + target_size[1]],
    }
    (destination / "template.json").write_text(
        json.dumps(metadata, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    return metadata


def main() -> int:
    project_root = Path(__file__).resolve().parents[1]
    parser = argparse.ArgumentParser(description="构建 Nikon Zf 与 SIGMA BF 网页模板资源")
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
