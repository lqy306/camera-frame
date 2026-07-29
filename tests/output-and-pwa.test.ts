import { readFileSync, statSync } from "node:fs";
import { describe, expect, it } from "vitest";

const root = new URL("../", import.meta.url);

function jpegSize(buffer: Buffer): [number, number] {
  let offset = 2;
  while (offset < buffer.length) {
    if (buffer[offset] !== 0xff) { offset += 1; continue; }
    const marker = buffer[offset + 1];
    if (marker >= 0xc0 && marker <= 0xc3) return [buffer.readUInt16BE(offset + 7), buffer.readUInt16BE(offset + 5)];
    if (marker === 0xd8 || marker === 0xd9) { offset += 2; continue; }
    offset += 2 + buffer.readUInt16BE(offset + 2);
  }
  throw new Error("未找到 JPEG 尺寸段");
}

describe("样例输出与 PWA", () => {
  it("三张样例均为 1280×1813", () => {
    for (const file of ["sample_blue.jpg", "sample_warm.jpg", "sample_green.jpg"]) {
      const buffer = readFileSync(new URL(`output/${file}`, root));
      expect(jpegSize(buffer)).toEqual([1280, 1813]);
      expect(buffer.byteLength).toBeGreaterThan(10000);
    }
  });

  it("manifest、图标与 service worker 均存在", () => {
    const manifest = JSON.parse(readFileSync(new URL("public/manifest.webmanifest", root), "utf8"));
    expect(manifest.display).toBe("standalone");
    expect(manifest.start_url).toBe("./");
    expect(manifest.icons).toHaveLength(3);
    const serviceWorker = readFileSync(new URL("public/service-worker.js", root), "utf8");
    expect(serviceWorker).toContain("PRECACHE");
    expect(serviceWorker).toContain("/assets/template_config.json");
    expect(serviceWorker.indexOf("/assets/template_config.json")).toBeLessThan(serviceWorker.indexOf('event.request.mode === "navigate"'));
    expect(statSync(new URL("public/icons/apple-touch-icon.png", root)).size).toBeGreaterThan(500);
  });
});
