import { describe, expect, it } from "vitest";
import { extractColorCandidates, fitBackgroundColor, hexToRgb, rgbToHsv } from "../src/image/color-extractor";

describe("综合色提取", () => {
  it("优先选择面积较大的有效综合色并排除纯白", () => {
    const width = 100;
    const height = 80;
    const pixels = new Uint8ClampedArray(width * height * 4);
    for (let index = 0; index < width * height; index += 1) {
      const offset = index * 4;
      const isWhite = index < 500;
      const isBlue = index >= 500 && index < 2500;
      const color = isWhite ? [252, 252, 252] : isBlue ? [50, 105, 155] : [180, 92, 45];
      pixels.set([...color, 255], offset);
    }
    const candidates = extractColorCandidates(pixels, width, height, 5);
    expect(candidates.length).toBeGreaterThanOrEqual(2);
    expect(candidates[0].rgb[0]).toBeGreaterThan(candidates[0].rgb[2]);
    expect(candidates.every((candidate) => candidate.brightness < 0.96)).toBe(true);
  });

  it("保留候选色明暗差异并把背景限制到柔和范围", () => {
    const dark = fitBackgroundColor("#350804", 55, 65);
    const light = fitBackgroundColor("#e9eef1", 55, 65);
    const [, darkSaturation, darkBrightness] = rgbToHsv(hexToRgb(dark));
    const [, lightSaturation, lightBrightness] = rgbToHsv(hexToRgb(light));
    expect(lightBrightness - darkBrightness).toBeGreaterThan(0.15);
    expect(darkBrightness).toBeGreaterThanOrEqual(0.35);
    expect(lightBrightness).toBeLessThanOrEqual(0.79);
    expect(darkSaturation).toBeGreaterThanOrEqual(0.25);
    expect(lightSaturation).toBeLessThanOrEqual(0.71);
  });

  it("背景亮度滑块仍能整体调节亮度", () => {
    const dim = fitBackgroundColor("#72210b", 55, 40);
    const bright = fitBackgroundColor("#72210b", 55, 100);
    const [, , dimBrightness] = rgbToHsv(hexToRgb(dim));
    const [, , brightBrightness] = rgbToHsv(hexToRgb(bright));
    expect(brightBrightness - dimBrightness).toBeGreaterThan(0.1);
  });

  it("黑白灰等中性色保持中性，不被染成粉色", () => {
    const gray = fitBackgroundColor("#8a8a8a", 55, 65);
    const fitted = hexToRgb(gray);
    const [, saturation] = rgbToHsv(fitted);
    expect(saturation).toBeLessThanOrEqual(0.02);
    expect(Math.max(...fitted) - Math.min(...fitted)).toBeLessThanOrEqual(6);
  });
});

