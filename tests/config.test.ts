import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("网页模板配置", () => {
  it("运行时使用带版本号的配置 URL，避免旧版 Safari 缓存", () => {
    const runtime = readFileSync(new URL("../src/config/runtime.ts", import.meta.url), "utf8");
    expect(runtime).toContain("template_config.json?v=8");
  });

  it("资源全部使用本地相对文件名", () => {
    const config = JSON.parse(readFileSync(new URL("../public/assets/template_config.json", import.meta.url), "utf8"));
    expect(config.version).toBe(8);
    expect(config.cameraTemplates).toHaveLength(5);
    expect(config.cameraTemplates.flatMap((template: { assets: Record<string, string> }) => Object.values(template.assets))
      .every((value: string) => typeof value === "string" && !value.includes("://"))).toBe(true);
    expect(config.cameraTemplates.map((template: { id: string }) => template.id)).toEqual([
      "ricoh_gr2", "sony_a7c2", "nikon_zf", "sigma_bf", "s1rm2",
    ]);
    expect(config.defaults.cameraTemplate).toBe("ricoh_gr2");
    expect(config.defaults.syncCrops).toBe(true);
    expect(config.defaults.layoutMode).toBe("stacked");
    expect(config.defaults.outputQuality).toBe(95);
  });
});
