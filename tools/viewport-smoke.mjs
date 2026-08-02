#!/usr/bin/env node
import assert from "node:assert/strict";
import { access } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";
import { createServer } from "vite";

const root = path.resolve(fileURLToPath(new URL("../", import.meta.url)));
const chrome = process.env.CHROME_PATH ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
await access(chrome);

const server = await createServer({
  root,
  logLevel: "error",
  server: { host: "127.0.0.1", port: 4199, strictPort: true },
});
await server.listen();

const browser = await chromium.launch({
  executablePath: chrome,
  headless: true,
  args: ["--no-first-run", "--disable-background-networking"],
});

const viewports = [
  { width: 375, height: 667, name: "iPhone SE" },
  { width: 390, height: 844, name: "iPhone 14" },
  { width: 393, height: 852, name: "iPhone 15 Pro" },
  { width: 430, height: 932, name: "iPhone 15 Pro Max" },
  { width: 768, height: 1024, name: "iPad" },
  { width: 1440, height: 900, name: "Desktop" },
  { width: 844, height: 390, name: "iPhone landscape" },
];

const report = [];
try {
  for (const viewport of viewports) {
    const context = await browser.newContext({
      viewport: { width: viewport.width, height: viewport.height },
      deviceScaleFactor: viewport.width < 800 ? 2 : 1,
      hasTouch: viewport.width < 800,
      isMobile: viewport.width < 800,
      colorScheme: viewport.name === "iPhone 15 Pro" ? "light" : "dark",
      acceptDownloads: true,
    });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto("http://127.0.0.1:4199/", { waitUntil: "networkidle" });
    await page.getByText("模板已就绪，请选择照片。").waitFor();
    const metrics = await page.evaluate(() => ({
      innerWidth,
      innerHeight,
      scrollWidth: document.documentElement.scrollWidth,
      drawerOpen: document.querySelector(".control-drawer")?.hasAttribute("open"),
      buttonHeights: [...document.querySelectorAll("button, .button")]
        .filter((element) => getComputedStyle(element).display !== "none")
        .map((element) => element.getBoundingClientRect().height)
        .filter((height) => height > 0),
      summaryHeight: document.querySelector(".control-drawer summary")?.getBoundingClientRect().height ?? 0,
      overflowElements: [...document.querySelectorAll("body *")]
        .filter((element) => {
          const rect = element.getBoundingClientRect();
          return rect.width > 0 && (rect.right > innerWidth + 1 || rect.left < -1);
        })
        .slice(0, 8)
        .map((element) => ({ tag: element.tagName, className: element.className, rect: element.getBoundingClientRect().toJSON() })),
    }));
    assert.equal(metrics.innerWidth, viewport.width, `${viewport.name}: 视口宽度`);
    assert.equal(metrics.innerHeight, viewport.height, `${viewport.name}: 视口高度`);
    assert.ok(metrics.scrollWidth <= viewport.width + 1, `${viewport.name}: 横向宽度 ${metrics.scrollWidth}，越界元素 ${JSON.stringify(metrics.overflowElements)}`);
    assert.ok(Math.min(...metrics.buttonHeights) >= 44, `${viewport.name}: 存在小于 44px 的按钮`);
    assert.ok(metrics.summaryHeight >= 58, `${viewport.name}: 底部/侧边面板标题过小`);
    assert.equal(metrics.drawerOpen, viewport.width > 860, `${viewport.name}: 面板默认状态错误`);
    assert.deepEqual(errors, [], `${viewport.name}: 页面运行错误`);
    report.push({ name: viewport.name, size: `${viewport.width}x${viewport.height}`, overflow: 0, minButton: Math.min(...metrics.buttonHeights) });

    if (viewport.width === 390) {
      await page.locator('input[type="file"]').setInputFiles(path.join(root, "samples/blue_city.jpg"));
      await page.getByText("全程本地处理", { exact: false }).waitFor({ timeout: 30000 });
      assert.equal(await page.locator(".color-chip").count(), 5, "候选色应为 5 个");
      const canvas = page.locator("canvas.result-canvas");
      assert.equal(await canvas.count(), 1, "应生成预览画布");
      const canvasState = await canvas.evaluate((element) => {
        const value = element;
        const context2d = value.getContext("2d");
        const top = context2d.getImageData(8, 8, 1, 1).data;
        return { width: value.width, height: value.height, top: [...top] };
      });
      assert.deepEqual([canvasState.width, canvasState.height], [847, 1200]);
      assert.ok(Math.max(...canvasState.top.slice(0, 3)) - Math.min(...canvasState.top.slice(0, 3)) > 25, "上方背景不应为灰白色");

      const drawer = page.locator("details.control-drawer");
      await drawer.locator("summary").click();
      assert.equal(await drawer.getAttribute("open"), "", "底部面板应可展开");
      const cameraSelect = page.locator('select[data-setting="cameraTemplate"]');
      assert.equal(await cameraSelect.locator("option").count(), 5, "应提供五套相机模板");
      assert.equal(await cameraSelect.inputValue(), "ricoh_gr2", "理光应保持默认模板");
      await cameraSelect.selectOption("sony_a7c2");
      assert.equal(await cameraSelect.inputValue(), "sony_a7c2", "A7C II 模板应可选择");
      await cameraSelect.selectOption("nikon_zf");
      assert.equal(await cameraSelect.inputValue(), "nikon_zf", "Nikon Zf 模板应可选择");
      await cameraSelect.selectOption("sigma_bf");
      assert.equal(await cameraSelect.inputValue(), "sigma_bf", "SIGMA BF 模板应可选择");
      const layoutSelect = page.locator('select[data-setting="layoutMode"]');
      assert.equal(await layoutSelect.inputValue(), "stacked", "默认应保持上下结构");
      await layoutSelect.selectOption("sideBySide");
      await page.waitForFunction(() => {
        const value = document.querySelector("canvas.result-canvas");
        return value?.width === 1200 && value?.height === 847;
      });
      assert.equal(await page.locator('button[data-crop-target="photo"]').textContent(), "左侧照片");
      assert.match(await page.locator('[data-role="layout-note"]').textContent(), /标准 2:3 竖幅/);
      assert.match(await page.locator('[data-role="output-note"]').textContent(), /2720 × 1920/);
      await page.locator('select[data-setting="backgroundMode"]').selectOption("gradient");
      await page.locator('input[data-setting="syncCrops"]').uncheck();
      assert.equal(await page.locator('button[data-crop-target="screen"]').isEnabled(), true);
      await page.locator('input[data-action="crop-edit"]').check();
      const box = await page.locator(".preview-stage").boundingBox();
      assert.ok(box);
      await page.mouse.move(box.x + box.width * 0.55, box.y + box.height * 0.55);
      await page.mouse.down();
      await page.mouse.move(box.x + box.width * 0.47, box.y + box.height * 0.5, { steps: 4 });
      await page.mouse.up();
      await page.locator('select[data-setting="outputFormat"]').selectOption("png");
      assert.equal(await page.locator('input[data-setting="outputQuality"]').locator("xpath=ancestor::label").isHidden(), true);

      await drawer.locator("summary").click();
      assert.equal(await drawer.getAttribute("open"), null, "保存前面板应可收起");
      await page.getByRole("button", { name: "保存图片" }).click();
      const fallback = page.getByRole("link", { name: "打开已生成图片，可长按保存" });
      await fallback.waitFor({ timeout: 30000 });
      assert.match(await fallback.getAttribute("download"), /^CameraFrame_\d{8}_\d{6}\.png$/);
      assert.match(await fallback.getAttribute("href"), /^blob:/);
      const exportedSize = await fallback.evaluate(async (element) => {
        const response = await fetch(element.href);
        const bitmap = await createImageBitmap(await response.blob());
        const size = [bitmap.width, bitmap.height];
        bitmap.close();
        return size;
      });
      assert.deepEqual(exportedSize, [2720, 1920], "左右版式应保存为 2720×1920");
    }
    await context.close();
  }
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n浏览器视口与交互冒烟测试通过。\n`);
} finally {
  await browser.close();
  await server.close();
}
