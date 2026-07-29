import type { CameraTemplateDefinition, LayoutMode, Point, TemplateConfig } from "../config/types";

export interface LayoutRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface LayoutGeometry {
  mode: LayoutMode;
  canvasWidth: number;
  canvasHeight: number;
  photoRect: LayoutRect;
  cameraPanelRect: LayoutRect;
  cameraTemplateScale: number;
  cameraRotation: "none" | "clockwise";
  screenQuad: [Point, Point, Point, Point];
  screenRenderSize: { width: number; height: number };
}

function rotatePointClockwise(point: Point, rotatedWidth: number): Point {
  return { x: rotatedWidth - point.y, y: point.x };
}

export function getLayoutGeometry(
  config: TemplateConfig,
  mode: LayoutMode,
  template: CameraTemplateDefinition,
): LayoutGeometry {
  if (mode === "stacked") {
    return {
      mode,
      canvasWidth: config.canvasWidth,
      canvasHeight: config.canvasHeight,
      photoRect: {
        x: 0,
        y: config.splitY,
        width: config.canvasWidth,
        height: config.canvasHeight - config.splitY,
      },
      cameraPanelRect: { x: 0, y: 0, width: config.canvasWidth, height: config.splitY },
      cameraTemplateScale: 1,
      cameraRotation: "none",
      screenQuad: template.screenQuad.map((point) => ({ ...point })) as [Point, Point, Point, Point],
      screenRenderSize: { ...template.screenRenderSize },
    };
  }

  // Standard portrait photos are 2:3. Use their familiar 1280×1920 working size
  // and scale the rotated fixed camera panel to the same height without distortion.
  const portraitWidth = config.canvasWidth;
  const portraitHeight = Math.round(portraitWidth * 1.5);
  const cameraTemplateScale = portraitHeight / config.canvasWidth;
  const cameraPanelWidth = Math.round(config.splitY * cameraTemplateScale);
  const rotated = template.screenQuad.map((point) => {
    const local = rotatePointClockwise(point, config.splitY);
    return {
      x: portraitWidth + local.x * cameraTemplateScale,
      y: local.y * cameraTemplateScale,
    };
  });
  return {
    mode,
    canvasWidth: portraitWidth + cameraPanelWidth,
    canvasHeight: portraitHeight,
    photoRect: { x: 0, y: 0, width: portraitWidth, height: portraitHeight },
    cameraPanelRect: { x: portraitWidth, y: 0, width: cameraPanelWidth, height: portraitHeight },
    cameraTemplateScale,
    cameraRotation: "clockwise",
    // Reorder the rotated hardware corners so the photo remains upright in page coordinates.
    screenQuad: [rotated[3], rotated[0], rotated[1], rotated[2]] as [Point, Point, Point, Point],
    screenRenderSize: {
      width: Math.round(template.screenRenderSize.height * cameraTemplateScale),
      height: Math.round(template.screenRenderSize.width * cameraTemplateScale),
    },
  };
}

export function scaledRect(rect: LayoutRect, scale: number): LayoutRect {
  return {
    x: Math.round(rect.x * scale),
    y: Math.round(rect.y * scale),
    width: Math.round(rect.width * scale),
    height: Math.round(rect.height * scale),
  };
}
