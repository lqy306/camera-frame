import { readFileSync, statSync } from "node:fs";
import { describe, expect, it } from "vitest";

const root = new URL("../", import.meta.url);
const config = JSON.parse(readFileSync(new URL("public/assets/template_config.json", root), "utf8"));

function pngSize(buffer: Buffer): [number, number] {
  expect(buffer.toString("ascii", 1, 4)).toBe("PNG");
  return [buffer.readUInt32BE(16), buffer.readUInt32BE(20)];
}

describe("固定模板", () => {
  it("固化正确画布、分界线与液晶屏四角", () => {
    expect([config.canvasWidth, config.canvasHeight, config.splitY]).toEqual([1280, 1813, 960]);
    const ricoh = config.cameraTemplates.find((template: { id: string }) => template.id === "ricoh_gr2");
    const sony = config.cameraTemplates.find((template: { id: string }) => template.id === "sony_a7c2");
    const nikon = config.cameraTemplates.find((template: { id: string }) => template.id === "nikon_zf");
    const sigma = config.cameraTemplates.find((template: { id: string }) => template.id === "sigma_bf");
    expect(ricoh.screenQuad).toEqual([
      { x: 292, y: 384 }, { x: 813, y: 383 }, { x: 815, y: 716 }, { x: 290, y: 716 },
    ]);
    expect(sony.screenQuad).toEqual([
      { x: 295, y: 432 }, { x: 787, y: 432 }, { x: 787, y: 764 }, { x: 295, y: 764 },
    ]);
    expect(nikon.screenQuad).toEqual([
      { x: 249, y: 540 }, { x: 727, y: 540 }, { x: 727, y: 857 }, { x: 249, y: 857 },
    ]);
    expect(sigma.screenQuad).toEqual([
      { x: 136, y: 305 }, { x: 760, y: 305 }, { x: 760, y: 775 }, { x: 136, y: 775 },
    ]);
    expect(config.defaults.backgroundMode).toBe("solid");
    expect(config.defaults.backgroundStrength).toBe(100);
    expect(config.defaults.layoutMode).toBe("stacked");
  });

  it("所需相机、阴影和蒙版资源完整", () => {
    for (const template of config.cameraTemplates as Array<{ assets: Record<string, string> }>) {
      for (const file of Object.values(template.assets)) {
        expect(statSync(new URL(`public/assets/${file}`, root)).size).toBeGreaterThan(100);
      }
    }
    for (const file of ["camera_rgba.png", "camera_mask.png", "shadow_layer.png", "shadow_mask.png", "background_mask.png", "screen_mask.png"]) {
      expect(pngSize(readFileSync(new URL(`public/assets/${file}`, root)))).toEqual([1280, 1813]);
    }
    for (const template of config.cameraTemplates.filter((item: { id: string }) => item.id !== "ricoh_gr2")) {
      for (const file of ["camera_rgba.png", "camera_mask.png", "shadow_layer.png", "shadow_mask.png", "background_mask.png", "screen_mask.png"]) {
        expect(pngSize(readFileSync(new URL(`public/assets/cameras/${template.id}/${file}`, root)))).toEqual([1280, 960]);
      }
      expect(pngSize(readFileSync(new URL(`public/assets/cameras/${template.id}/screen_shading.png`, root))))
        .toEqual([template.screenRenderSize.width, template.screenRenderSize.height]);
    }
  });
});
