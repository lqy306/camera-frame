import { describe, expect, it } from "vitest";
import { calculateContainRect, calculateCoverCrop } from "../src/image/crop-engine";

const center = { zoom: 1, offsetX: 0, offsetY: 0, anchor: "center" as const };

describe("裁切计算", () => {
  it("cover 铺满 1280×853 且不拉伸", () => {
    const rect = calculateCoverCrop(7008, 4672, 1280, 853, center);
    expect(rect.dw).toBe(1280);
    expect(rect.dh).toBe(853);
    expect(rect.sw / rect.sh).toBeCloseTo(1280 / 853, 8);
  });

  it("竖图 cover 保持源图比例", () => {
    const rect = calculateCoverCrop(3024, 4032, 525, 333, center);
    expect(rect.sw / rect.sh).toBeCloseTo(525 / 333, 8);
    expect(rect.sx).toBeGreaterThanOrEqual(0);
    expect(rect.sy).toBeGreaterThanOrEqual(0);
  });

  it("contain 完整放入目标区域", () => {
    const rect = calculateContainRect(3024, 4032, 1280, 853, center);
    expect(rect.dw).toBeLessThanOrEqual(1280);
    expect(rect.dh).toBeLessThanOrEqual(853);
    expect(rect.dw / rect.dh).toBeCloseTo(3024 / 4032, 8);
  });

  it("2:3 竖图完整铺满左右版式的 1280×1920 区域且不拉伸", () => {
    const rect = calculateCoverCrop(2560, 3840, 1280, 1920, center);
    expect(rect.dw).toBe(1280);
    expect(rect.dh).toBe(1920);
    expect(rect.sw).toBe(2560);
    expect(rect.sh).toBe(3840);
  });
});
