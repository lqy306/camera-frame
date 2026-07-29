#!/usr/bin/env node
import assert from "node:assert/strict";
import { access } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";
import { createServer } from "vite";

const root = path.resolve(fileURLToPath(new URL("../", import.meta.url)));
const chrome = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
await access(chrome);
const server = await createServer({ root, logLevel: "error", server: { host: "127.0.0.1", port: 4197, strictPort: true } });
await server.listen();
const browser = await chromium.launch({ executablePath: chrome, headless: true, args: ["--no-first-run", "--disable-background-networking"] });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true });
const page = await context.newPage();

const jobs = [
  ["blue_city.jpg", "sample_blue.jpg"],
  ["warm.jpg", "sample_warm.jpg"],
  ["green.jpg", "sample_green.jpg"],
];

try {
  await page.goto("http://127.0.0.1:4197/", { waitUntil: "networkidle" });
  await page.getByText("模板已就绪，请选择照片。").waitFor();
  for (const [source, destination] of jobs) {
    await page.locator('input[type="file"]').setInputFiles(path.join(root, "samples", source));
    await page.getByText(`已载入 ${source}`, { exact: false }).waitFor({ timeout: 30000 });
    const oldHref = await page.locator(".fallback-link").getAttribute("href").catch(() => null);
    await page.getByRole("button", { name: "保存图片" }).click();
    const fallback = page.getByRole("link", { name: "打开已生成图片，可长按保存" });
    await fallback.waitFor({ timeout: 30000 });
    if (oldHref) {
      await page.waitForFunction((previous) => document.querySelector(".fallback-link")?.getAttribute("href") !== previous, oldHref);
    }
    const downloadPromise = page.waitForEvent("download", { timeout: 30000 });
    await fallback.click();
    const download = await downloadPromise;
    assert.match(download.suggestedFilename(), /\.jpg$/);
    await download.saveAs(path.join(root, "output", destination));
    process.stdout.write(`已生成 ${destination}\n`);
  }
} finally {
  await browser.close();
  await server.close();
}

