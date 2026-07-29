#!/usr/bin/env python3
"""Export the approved desktop template as browser-ready, static PWA assets."""

from __future__ import annotations

import argparse
import json
import shutil
import sys
from pathlib import Path

from PIL import Image, ImageDraw


ASSET_NAMES = (
    "reference.jpg",
    "camera_rgba.png",
    "camera_mask.png",
    "shadow_layer.png",
    "shadow_mask.png",
    "background_mask.png",
    "screen_mask.png",
    "background_texture.png",
    "screen_shading.png",
)


def copy_exact(source: Path, destination: Path) -> None:
    destination.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(source, destination)


def build_config(desktop_config: dict) -> dict:
    canvas = desktop_config["canvas"]
    regions = desktop_config["regions"]
    defaults = desktop_config["defaults"]
    points = [dict(x=int(point[0]), y=int(point[1])) for point in regions["screen_quad"]]
    asset_keys = {
        "reference": "reference.jpg",
        "cameraRgba": "camera_rgba.png",
        "cameraMask": "camera_mask.png",
        "shadowLayer": "shadow_layer.png",
        "shadowMask": "shadow_mask.png",
        "backgroundMask": "background_mask.png",
        "screenMask": "screen_mask.png",
        "backgroundTexture": "background_texture.png",
        "screenShading": "screen_shading.png",
    }
    return {
        "version": 6,
        "canvasWidth": int(canvas["width"]),
        "canvasHeight": int(canvas["height"]),
        "splitY": int(canvas["split_y"]),
        "cameraTemplates": [
            {
                "id": "ricoh_gr2",
                "label": "Ricoh GR II",
                "screenQuad": points,
                "screenRenderSize": {
                    "width": int(regions["screen_render_size"][0]),
                    "height": int(regions["screen_render_size"][1]),
                },
                "assets": asset_keys,
            },
            {
                "id": "sony_a7c2",
                "label": "Sony A7C II",
                "screenQuad": [
                    {"x": 295, "y": 432},
                    {"x": 787, "y": 432},
                    {"x": 787, "y": 764},
                    {"x": 295, "y": 764},
                ],
                "screenRenderSize": {"width": 492, "height": 332},
                "assets": {
                    "reference": "cameras/sony_a7c2/reference.jpg",
                    "cameraRgba": "cameras/sony_a7c2/camera_rgba.png",
                    "cameraMask": "cameras/sony_a7c2/camera_mask.png",
                    "shadowLayer": "cameras/sony_a7c2/shadow_layer.png",
                    "shadowMask": "cameras/sony_a7c2/shadow_mask.png",
                    "backgroundMask": "cameras/sony_a7c2/background_mask.png",
                    "screenMask": "cameras/sony_a7c2/screen_mask.png",
                    "backgroundTexture": "background_texture.png",
                    "screenShading": "cameras/sony_a7c2/screen_shading.png",
                },
            },
            {
                "id": "nikon_zf",
                "label": "Nikon Zf",
                "screenQuad": [
                    {"x": 249, "y": 540},
                    {"x": 727, "y": 540},
                    {"x": 727, "y": 857},
                    {"x": 249, "y": 857},
                ],
                "screenRenderSize": {"width": 478, "height": 317},
                "assets": {
                    "reference": "cameras/nikon_zf/reference.jpg",
                    "cameraRgba": "cameras/nikon_zf/camera_rgba.png",
                    "cameraMask": "cameras/nikon_zf/camera_mask.png",
                    "shadowLayer": "cameras/nikon_zf/shadow_layer.png",
                    "shadowMask": "cameras/nikon_zf/shadow_mask.png",
                    "backgroundMask": "cameras/nikon_zf/background_mask.png",
                    "screenMask": "cameras/nikon_zf/screen_mask.png",
                    "backgroundTexture": "background_texture.png",
                    "screenShading": "cameras/nikon_zf/screen_shading.png",
                },
            },
            {
                "id": "sigma_bf",
                "label": "SIGMA BF",
                "screenQuad": [
                    {"x": 136, "y": 305},
                    {"x": 760, "y": 305},
                    {"x": 760, "y": 775},
                    {"x": 136, "y": 775},
                ],
                "screenRenderSize": {"width": 624, "height": 470},
                "assets": {
                    "reference": "cameras/sigma_bf/reference.jpg",
                    "cameraRgba": "cameras/sigma_bf/camera_rgba.png",
                    "cameraMask": "cameras/sigma_bf/camera_mask.png",
                    "shadowLayer": "cameras/sigma_bf/shadow_layer.png",
                    "shadowMask": "cameras/sigma_bf/shadow_mask.png",
                    "backgroundMask": "cameras/sigma_bf/background_mask.png",
                    "screenMask": "cameras/sigma_bf/screen_mask.png",
                    "backgroundTexture": "background_texture.png",
                    "screenShading": "cameras/sigma_bf/screen_shading.png",
                },
            },
        ],
        "defaults": {
            "cameraTemplate": "ricoh_gr2",
            "layoutMode": "stacked",
            "backgroundMode": "solid",
            "autoBackground": True,
            "backgroundColor": "#6f8795",
            "backgroundSaturation": int(defaults["background_saturation"]),
            "backgroundBrightness": int(defaults["background_brightness"]),
            "backgroundStrength": 100,
            "gradientStrength": 16,
            "textureStrength": int(defaults["background_texture"]),
            "shadowStrength": int(defaults["shadow_strength"]),
            "lcdBrightness": int(defaults["lcd_brightness"]),
            "lcdSaturation": int(defaults["lcd_saturation"]),
            "lcdContrast": int(defaults["lcd_contrast"]),
            "cropMode": defaults["crop_mode"],
            "syncCrops": True,
            "outputFormat": "jpeg",
            "outputQuality": 95,
        },
    }


def build_icon(size: int, destination: Path, maskable: bool = False) -> None:
    image = Image.new("RGB", (size, size), "#17191d")
    draw = ImageDraw.Draw(image)
    margin = int(size * (0.19 if maskable else 0.13))
    radius = int(size * 0.18)
    draw.rounded_rectangle((margin, margin, size - margin, size - margin), radius=radius, fill="#f4f5f7")
    body = (int(size * 0.27), int(size * 0.36), int(size * 0.73), int(size * 0.66))
    draw.rounded_rectangle(body, radius=int(size * 0.045), fill="#17191d")
    draw.ellipse(
        (int(size * 0.41), int(size * 0.41), int(size * 0.59), int(size * 0.59)),
        fill="#6b9cff",
        outline="#c7d7ff",
        width=max(2, int(size * 0.016)),
    )
    draw.rounded_rectangle(
        (int(size * 0.33), int(size * 0.31), int(size * 0.47), int(size * 0.39)),
        radius=max(2, int(size * 0.018)),
        fill="#17191d",
    )
    destination.parent.mkdir(parents=True, exist_ok=True)
    image.save(destination, "PNG", optimize=True)


def export_samples(old_root: Path, pwa_root: Path) -> None:
    samples = pwa_root / "samples"
    samples.mkdir(parents=True, exist_ok=True)
    blue = old_root / "output" / "DSC00229.JPG"
    green = old_root / "input" / "demo_input.jpg"
    copy_exact(blue, samples / "blue_city.jpg")
    copy_exact(green, samples / "green.jpg")
    with Image.open(old_root / "演示" / "1.png") as image:
        rgb = image.convert("RGB")
        warm = rgb.crop((0, int(round(rgb.height * 0.50)), rgb.width, rgb.height))
        warm.save(samples / "warm.jpg", "JPEG", quality=96, subsampling=0)


def generate_reference_outputs(v2_root: Path, pwa_root: Path) -> None:
    sys.path.insert(0, str(v2_root))
    from image_processor import ImageProcessor, ProcessingSettings  # type: ignore

    processor = ImageProcessor(v2_root / "config.json")
    output = pwa_root / "output"
    output.mkdir(parents=True, exist_ok=True)
    jobs = (
        (pwa_root / "samples" / "blue_city.jpg", output / "sample_blue.jpg"),
        (pwa_root / "samples" / "warm.jpg", output / "sample_warm.jpg"),
        (pwa_root / "samples" / "green.jpg", output / "sample_green.jpg"),
    )
    settings = ProcessingSettings(background_mode="solid", background_intensity=100)
    for source, destination in jobs:
        with Image.open(source) as image:
            result = processor.generate(image.convert("RGB"), settings)
        processor.save(result.image, destination, "JPG")


def main() -> int:
    parser = argparse.ArgumentParser(description="导出 Camera Frame PWA 静态模板资源")
    parser.add_argument("--v2-root", type=Path, default=Path("/Volumes/WZ/z/相机软件_v2"))
    parser.add_argument("--old-root", type=Path, default=Path("/Volumes/WZ/z/相机软件"))
    parser.add_argument("--pwa-root", type=Path, default=Path(__file__).resolve().parents[1])
    parser.add_argument("--generate-samples", action="store_true")
    args = parser.parse_args()

    config_path = args.v2_root / "config.json"
    desktop_config = json.loads(config_path.read_text(encoding="utf-8"))
    assets_dir = args.pwa_root / "public" / "assets"
    for name in ASSET_NAMES:
        source = args.v2_root / "assets" / name
        if not source.is_file():
            raise FileNotFoundError(f"缺少桌面模板资源：{source}")
        copy_exact(source, assets_dir / name)
    web_config = build_config(desktop_config)
    (assets_dir / "template_config.json").write_text(
        json.dumps(web_config, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )

    icons = args.pwa_root / "public" / "icons"
    build_icon(180, icons / "apple-touch-icon.png")
    build_icon(192, icons / "icon-192.png")
    build_icon(512, icons / "icon-512.png")
    build_icon(512, icons / "icon-maskable-512.png", maskable=True)
    export_samples(args.old_root, args.pwa_root)
    if args.generate_samples:
        generate_reference_outputs(args.v2_root, args.pwa_root)
    print(f"已导出 PWA 资源：{args.pwa_root}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
