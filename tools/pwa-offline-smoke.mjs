#!/usr/bin/env node
import assert from "node:assert/strict";
import { access } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";
import { preview } from "vite";

const root = path.resolve(fileURLToPath(new URL("../", import.meta.url)));
const chrome = process.env.CHROME_PATH ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
await access(path.join(root, "dist/index.html"));

const server = await preview({ root, logLevel: "error", preview: { host: "127.0.0.1", port: 4198, strictPort: true } });
const browser = await chromium.launch({ executablePath: chrome, headless: true, args: ["--no-first-run", "--disable-background-networking"] });
const context = await browser.newContext({ serviceWorkers: "allow" });
const page = await context.newPage();
const externalRequests = [];
page.on("request", (request) => {
  const url = new URL(request.url());
  if (url.hostname !== "127.0.0.1") externalRequests.push(request.url());
});

try {
  await page.goto("http://127.0.0.1:4198/", { waitUntil: "networkidle" });
  await page.getByText("模板已就绪，请选择照片。").waitFor();
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
    return true;
  });
  const registrationState = await page.evaluate(async () => {
    const registration = await navigator.serviceWorker.getRegistration();
    return { active: Boolean(registration?.active), cacheKeys: await caches.keys() };
  });
  assert.equal(registrationState.active, true, "Service Worker 未激活");
  assert.ok(registrationState.cacheKeys.includes("camera-frame-v1.8.0"), "离线缓存版本不存在");
  assert.deepEqual(externalRequests, [], "页面不应发出外部网络请求");

  await context.setOffline(true);
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.getByText("模板已就绪，请选择照片。").waitFor({ timeout: 15000 });
  assert.equal(await page.locator('select[data-setting="backgroundMode"]').inputValue(), "solid");
  process.stdout.write(`PWA 离线测试通过：${registrationState.cacheKeys.join(", ")}\n`);
} finally {
  await context.setOffline(false).catch(() => undefined);
  await browser.close();
  await new Promise((resolve) => server.httpServer.close(resolve));
}
