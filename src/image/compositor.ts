import type {
  CameraTemplateResources,
  CropTransform,
  LoadedImage,
  ProcessingSettings,
  TemplateResources,
} from "../config/types";
import { applyColorStrength, hexToRgb, rgbToHsv, hsvToRgb, rgbToHex } from "./color-extractor";
import { drawCroppedPhoto } from "./crop-engine";
import { getLayoutGeometry, scaledRect, type LayoutGeometry } from "./layout-geometry";
import { drawImageInQuad } from "./perspective-renderer";

export interface RenderRequest {
  resources: TemplateResources;
  photo: LoadedImage;
  settings: ProcessingSettings;
  photoCrop: CropTransform;
  screenCrop: CropTransform;
  scale?: number;
}

function makeCanvas(width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(width));
  canvas.height = Math.max(1, Math.round(height));
  return canvas;
}

function context2d(canvas: HTMLCanvasElement, readFrequently = false): CanvasRenderingContext2D {
  const context = canvas.getContext("2d", readFrequently ? { willReadFrequently: true } : undefined);
  if (!context) throw new Error("当前浏览器无法创建合成画布。");
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  return context;
}

function lighterDarker(hex: string, delta: number): string {
  const hsv = rgbToHsv(hexToRgb(hex));
  hsv[2] = Math.min(0.9, Math.max(0.28, hsv[2] + delta));
  return rgbToHex(hsvToRgb(hsv));
}

function drawBackground(
  context: CanvasRenderingContext2D,
  config: TemplateResources["config"],
  template: CameraTemplateResources,
  settings: ProcessingSettings,
  width: number,
  height: number,
): void {
  const { canvasWidth, splitY } = config;
  const color = applyColorStrength(settings.backgroundColor, settings.backgroundStrength);
  if (settings.backgroundMode === "legacy") {
    context.drawImage(template.reference.source, 0, 0, canvasWidth, splitY, 0, 0, width, height);
    context.save();
    context.globalCompositeOperation = "color";
    context.globalAlpha = Math.max(0.1, settings.backgroundStrength / 100);
    context.fillStyle = color;
    context.fillRect(0, 0, width, height);
    context.restore();
    return;
  }

  if (settings.backgroundMode === "gradient") {
    const amount = settings.gradientStrength / 100;
    const gradient = context.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, lighterDarker(color, amount * 0.12));
    gradient.addColorStop(0.48, color);
    gradient.addColorStop(1, lighterDarker(color, -amount * 0.12));
    context.fillStyle = gradient;
  } else {
    context.fillStyle = color;
  }
  context.fillRect(0, 0, width, height);

  if (settings.textureStrength > 0) {
    context.save();
    context.globalCompositeOperation = "soft-light";
    context.globalAlpha = Math.min(0.18, settings.textureStrength / 100);
    context.drawImage(template.backgroundTexture.source, 0, 0, canvasWidth, splitY, 0, 0, width, height);
    context.restore();
  }
}

function renderCameraPanel(
  config: TemplateResources["config"],
  template: CameraTemplateResources,
  settings: ProcessingSettings,
  scale: number,
): HTMLCanvasElement {
  const { canvasWidth, splitY } = config;
  const panel = makeCanvas(canvasWidth * scale, splitY * scale);
  const context = context2d(panel);
  drawBackground(context, config, template, settings, panel.width, panel.height);

  if (settings.backgroundMode !== "legacy" && settings.shadowStrength > 0) {
    context.save();
    context.globalAlpha = settings.shadowStrength / 100;
    context.drawImage(template.shadowLayer.source, 0, 0, canvasWidth, splitY, 0, 0, panel.width, panel.height);
    context.restore();
  }
  context.drawImage(template.cameraRgba.source, 0, 0, canvasWidth, splitY, 0, 0, panel.width, panel.height);
  return panel;
}

function drawPanelInLayout(
  context: CanvasRenderingContext2D,
  panel: HTMLCanvasElement,
  geometry: LayoutGeometry,
  output: HTMLCanvasElement,
): void {
  if (geometry.cameraRotation === "none") {
    context.drawImage(panel, 0, 0);
    return;
  }
  context.save();
  context.translate(output.width, 0);
  context.rotate(Math.PI / 2);
  context.drawImage(panel, 0, 0);
  context.restore();
}

function drawScreenShading(
  context: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  shading: LoadedImage,
  rotateClockwise: boolean,
): void {
  if (!rotateClockwise) {
    context.drawImage(shading.source, 0, 0, canvas.width, canvas.height);
    return;
  }
  context.save();
  context.translate(canvas.width, 0);
  context.rotate(Math.PI / 2);
  context.drawImage(shading.source, 0, 0, canvas.height, canvas.width);
  context.restore();
}

function adjustScreenPixels(
  canvas: HTMLCanvasElement,
  shading: LoadedImage,
  settings: ProcessingSettings,
  rotateShadingClockwise: boolean,
): void {
  const context = context2d(canvas, true);
  const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
  const shadeCanvas = makeCanvas(canvas.width, canvas.height);
  const shadeContext = context2d(shadeCanvas, true);
  drawScreenShading(shadeContext, shadeCanvas, shading, rotateShadingClockwise);
  const shades = shadeContext.getImageData(0, 0, canvas.width, canvas.height).data;
  const brightness = settings.lcdBrightness / 100;
  const saturation = settings.lcdSaturation / 100;
  const contrast = settings.lcdContrast / 100;
  const contrastOffset = 128 * (1 - contrast);
  for (let index = 0; index < pixels.data.length; index += 4) {
    const r = pixels.data[index];
    const g = pixels.data[index + 1];
    const b = pixels.data[index + 2];
    const luminance = r * 0.2126 + g * 0.7152 + b * 0.0722;
    const shade = shades[index] / 255;
    pixels.data[index] = Math.max(0, Math.min(255, ((luminance + (r - luminance) * saturation) * brightness * shade) * contrast + contrastOffset));
    pixels.data[index + 1] = Math.max(0, Math.min(255, ((luminance + (g - luminance) * saturation) * brightness * shade) * contrast + contrastOffset));
    pixels.data[index + 2] = Math.max(0, Math.min(255, ((luminance + (b - luminance) * saturation) * brightness * shade) * contrast + contrastOffset));
  }
  context.putImageData(pixels, 0, 0);
}

function createScreenMask(
  output: HTMLCanvasElement,
  config: TemplateResources["config"],
  template: CameraTemplateResources,
  geometry: LayoutGeometry,
  scale: number,
): HTMLCanvasElement {
  const { canvasWidth, splitY } = config;
  const panelScale = scale * geometry.cameraTemplateScale;
  const panelMask = makeCanvas(canvasWidth * panelScale, splitY * panelScale);
  context2d(panelMask).drawImage(
    template.screenMask.source,
    0,
    0,
    canvasWidth,
    splitY,
    0,
    0,
    panelMask.width,
    panelMask.height,
  );
  const mask = makeCanvas(output.width, output.height);
  drawPanelInLayout(context2d(mask), panelMask, geometry, mask);
  return mask;
}

function drawLcd(
  output: HTMLCanvasElement,
  config: TemplateResources["config"],
  template: CameraTemplateResources,
  photo: LoadedImage,
  settings: ProcessingSettings,
  crop: CropTransform,
  geometry: LayoutGeometry,
  scale: number,
): void {
  const { width, height } = geometry.screenRenderSize;
  const flat = makeCanvas(width, height);
  drawCroppedPhoto(context2d(flat), photo, 0, 0, width, height, settings.cropMode, crop);
  adjustScreenPixels(flat, template.screenShading, settings, geometry.cameraRotation === "clockwise");

  const overlay = makeCanvas(output.width, output.height);
  const overlayContext = context2d(overlay);
  const scaledQuad = geometry.screenQuad.map((point) => ({ x: point.x * scale, y: point.y * scale })) as [
    { x: number; y: number }, { x: number; y: number }, { x: number; y: number }, { x: number; y: number },
  ];
  drawImageInQuad(overlayContext, flat, width, height, scaledQuad);
  overlayContext.globalCompositeOperation = "destination-in";
  overlayContext.drawImage(createScreenMask(output, config, template, geometry, scale), 0, 0);
  context2d(output).drawImage(overlay, 0, 0);
}

export function renderComposite(request: RenderRequest): HTMLCanvasElement {
  const { resources, photo, settings, photoCrop, screenCrop } = request;
  const scale = request.scale ?? 1;
  const template = resources.templates[settings.cameraTemplate]
    ?? resources.templates[resources.config.defaults.cameraTemplate];
  if (!template) throw new Error("所选相机模板不可用。");
  const geometry = getLayoutGeometry(resources.config, settings.layoutMode, template.definition);
  const output = makeCanvas(geometry.canvasWidth * scale, geometry.canvasHeight * scale);
  const context = context2d(output);

  drawPanelInLayout(
    context,
    renderCameraPanel(resources.config, template, settings, scale * geometry.cameraTemplateScale),
    geometry,
    output,
  );
  const photoRect = scaledRect(geometry.photoRect, scale);
  drawCroppedPhoto(
    context,
    photo,
    photoRect.x,
    photoRect.y,
    photoRect.width,
    photoRect.height,
    settings.cropMode,
    photoCrop,
  );
  drawLcd(
    output,
    resources.config,
    template,
    photo,
    settings,
    settings.syncCrops ? photoCrop : screenCrop,
    geometry,
    scale,
  );
  return output;
}

export function canvasToBlob(
  canvas: HTMLCanvasElement,
  format: "jpeg" | "png",
  quality = 0.95,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => blob ? resolve(blob) : reject(new Error("浏览器未能生成图片文件。")),
      format === "png" ? "image/png" : "image/jpeg",
      format === "png" ? undefined : quality,
    );
  });
}
