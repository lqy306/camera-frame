import type { CropMode, CropTransform, LoadedImage } from "../config/types";

export interface DrawRect {
  sx: number;
  sy: number;
  sw: number;
  sh: number;
  dx: number;
  dy: number;
  dw: number;
  dh: number;
}

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

export function calculateCoverCrop(
  sourceWidth: number,
  sourceHeight: number,
  targetWidth: number,
  targetHeight: number,
  transform: CropTransform,
): DrawRect {
  const sourceAspect = sourceWidth / sourceHeight;
  const targetAspect = targetWidth / targetHeight;
  let visibleWidth = sourceWidth;
  let visibleHeight = sourceHeight;
  if (sourceAspect > targetAspect) visibleWidth = sourceHeight * targetAspect;
  else visibleHeight = sourceWidth / targetAspect;
  const zoom = clamp(transform.zoom, 1, 5);
  visibleWidth /= zoom;
  visibleHeight /= zoom;

  const defaultCenterY = transform.anchor === "top"
    ? visibleHeight / 2
    : transform.anchor === "bottom"
      ? sourceHeight - visibleHeight / 2
      : sourceHeight / 2;
  const travelX = Math.max(0, (sourceWidth - visibleWidth) / 2);
  const travelY = Math.max(0, (sourceHeight - visibleHeight) / 2);
  const centerX = clamp(sourceWidth / 2 + transform.offsetX * travelX, visibleWidth / 2, sourceWidth - visibleWidth / 2);
  const centerY = clamp(defaultCenterY + transform.offsetY * travelY, visibleHeight / 2, sourceHeight - visibleHeight / 2);

  return {
    sx: centerX - visibleWidth / 2,
    sy: centerY - visibleHeight / 2,
    sw: visibleWidth,
    sh: visibleHeight,
    dx: 0,
    dy: 0,
    dw: targetWidth,
    dh: targetHeight,
  };
}

export function calculateContainRect(
  sourceWidth: number,
  sourceHeight: number,
  targetWidth: number,
  targetHeight: number,
  transform: CropTransform,
): DrawRect {
  const scale = Math.min(targetWidth / sourceWidth, targetHeight / sourceHeight) * clamp(transform.zoom, 1, 5);
  const width = sourceWidth * scale;
  const height = sourceHeight * scale;
  const freeX = targetWidth - width;
  const freeY = targetHeight - height;
  const anchorY = transform.anchor === "top" ? 0 : transform.anchor === "bottom" ? freeY : freeY / 2;
  const dx = freeX / 2 + transform.offsetX * Math.abs(freeX) / 2;
  const dy = anchorY + transform.offsetY * Math.abs(freeY) / 2;
  return { sx: 0, sy: 0, sw: sourceWidth, sh: sourceHeight, dx, dy, dw: width, dh: height };
}

function drawRect(
  context: CanvasRenderingContext2D,
  source: CanvasImageSource,
  rect: DrawRect,
  targetX: number,
  targetY: number,
): void {
  context.drawImage(
    source,
    rect.sx,
    rect.sy,
    rect.sw,
    rect.sh,
    targetX + rect.dx,
    targetY + rect.dy,
    rect.dw,
    rect.dh,
  );
}

export function drawCroppedPhoto(
  context: CanvasRenderingContext2D,
  image: LoadedImage,
  targetX: number,
  targetY: number,
  targetWidth: number,
  targetHeight: number,
  mode: CropMode,
  transform: CropTransform,
): void {
  context.save();
  context.beginPath();
  context.rect(targetX, targetY, targetWidth, targetHeight);
  context.clip();
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";

  if (mode === "contain") {
    const backdrop = calculateCoverCrop(image.width, image.height, targetWidth, targetHeight, {
      zoom: 1.03,
      offsetX: transform.offsetX,
      offsetY: transform.offsetY,
      anchor: transform.anchor,
    });
    context.save();
    context.filter = `blur(${Math.max(14, targetWidth * 0.025)}px) brightness(0.78)`;
    context.globalAlpha = 0.82;
    context.translate(targetX + targetWidth / 2, targetY + targetHeight / 2);
    context.scale(1.08, 1.08);
    context.translate(-(targetX + targetWidth / 2), -(targetY + targetHeight / 2));
    drawRect(context, image.source, backdrop, targetX, targetY);
    context.restore();
    const foreground = calculateContainRect(image.width, image.height, targetWidth, targetHeight, transform);
    drawRect(context, image.source, foreground, targetX, targetY);
  } else {
    drawRect(
      context,
      image.source,
      calculateCoverCrop(image.width, image.height, targetWidth, targetHeight, transform),
      targetX,
      targetY,
    );
  }
  context.restore();
}

