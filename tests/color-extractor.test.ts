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

  it("把背景色限制到适合大面积使用的饱和度和亮度", () => {
    const fitted = fitBackgroundColor("#e9eef1", 55, 65);
    const [, saturation, brightness] = rgbToHsv(hexToRgb(fitted));
    expect(saturation).toBeGreaterThanOrEqual(0.29);
    expect(saturation).toBeLessThanOrEqual(0.71);
    expect(brightness).toBeGreaterThanOrEqual(0.63);
    expect(brightness).toBeLessThanOrEqual(0.67);
  });
});

