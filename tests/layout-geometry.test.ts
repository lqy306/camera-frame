import { describe, expect, it } from "vitest";
import type { CameraTemplateDefinition, TemplateConfig } from "../src/config/types";
import { getLayoutGeometry } from "../src/image/layout-geometry";

const template = {
  id: "ricoh_gr2",
  label: "Ricoh GR II",
  screenQuad: [
    { x: 292, y: 384 },
    { x: 813, y: 383 },
    { x: 815, y: 716 },
    { x: 290, y: 716 },
  ],
  screenRenderSize: { width: 525, height: 333 },
} as CameraTemplateDefinition;

const config = {
  canvasWidth: 1280,
  canvasHeight: 1813,
  splitY: 960,
  cameraTemplates: [template],
} as TemplateConfig;

describe("双版式几何", () => {
  it("上下结构保持原始模板尺寸和坐标", () => {
    const geometry = getLayoutGeometry(config, "stacked", template);
    expect([geometry.canvasWidth, geometry.canvasHeight]).toEqual([1280, 1813]);
    expect(geometry.photoRect).toEqual({ x: 0, y: 960, width: 1280, height: 853 });
    expect(geometry.cameraPanelRect).toEqual({ x: 0, y: 0, width: 1280, height: 960 });
    expect(geometry.screenQuad).toEqual(template.screenQuad);
    expect(geometry.cameraRotation).toBe("none");
    expect(geometry.cameraTemplateScale).toBe(1);
  });

  it("左右结构把照片放左侧并顺时针旋转相机区域", () => {
    const geometry = getLayoutGeometry(config, "sideBySide", template);
    expect([geometry.canvasWidth, geometry.canvasHeight]).toEqual([2720, 1920]);
    expect(geometry.photoRect).toEqual({ x: 0, y: 0, width: 1280, height: 1920 });
    expect(geometry.cameraPanelRect).toEqual({ x: 1280, y: 0, width: 1440, height: 1920 });
    expect(geometry.screenQuad).toEqual([
      { x: 1646, y: 435 },
      { x: 2144, y: 438 },
      { x: 2145.5, y: 1219.5 },
      { x: 1646, y: 1222.5 },
    ]);
    expect(geometry.screenRenderSize).toEqual({ width: 500, height: 788 });
    expect(geometry.cameraRotation).toBe("clockwise");
    expect(geometry.cameraTemplateScale).toBe(1.5);
  });
});
