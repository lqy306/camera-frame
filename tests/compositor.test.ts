import { describe, expect, it } from "vitest";
import { applyColorStrength } from "../src/image/color-extractor";

describe("背景完全替换参数", () => {
  it("100% 强度保留目标综合色，0% 才回到中性背景", () => {
    expect(applyColorStrength("#438cab", 100)).toBe("#438cab");
    expect(applyColorStrength("#438cab", 0)).not.toBe("#438cab");
  });
});

