# Camera Frame 部署说明

本仓库默认通过 GitHub Actions 部署到 GitHub Pages：

- 私有源码仓库：<https://github.com/syjjsy/camera-frame>
- 公开 PWA 地址：<https://syjjsy.github.io/camera-frame/>

仓库保持私有不会自动让 Pages 网站带密码。GitHub Pages 发布的是浏览器必须下载的静态文件，因此知道公开网址的人都可以访问和安装。

## 首次启用 GitHub Pages

1. 打开仓库的 `Settings → Pages`。
2. 在 `Build and deployment` 的 `Source` 中选择 `GitHub Actions`。
3. 打开仓库的 `Actions` 页面。
4. 选择 `Deploy Camera Frame PWA`，确认最新一次运行成功。
5. 访问 <https://syjjsy.github.io/camera-frame/>。

项目已包含 `.github/workflows/deploy-pages.yml`。每次推送到 `main`，工作流会自动执行：

1. `npm ci`
2. `npm test`
3. 使用仓库子目录作为 Vite base 执行 `npm run build`
4. 上传 `dist/`
5. 发布到 GitHub Pages

## 发布更新

在本地仓库修改并验证后：

```bash
npm ci
npm test
npm run build
git add -A
git commit -m "Describe the update"
git push origin main
```

推送后在 GitHub Actions 中等待部署完成。iPhone 需要联网打开网站一次，以下载更新后的静态文件和 Service Worker 缓存。

修改页面、算法或模板资源时，同时增加 `public/service-worker.js` 中的 `CACHE_VERSION`。这样新 Service Worker 激活后会清除旧缓存，避免手机持续使用旧模板。

## 验证发布

部署完成后依次检查：

1. 在线打开网站，五个相机模板均能加载。
2. 导入横图，生成上下结构 JPG。
3. 导入竖图，生成左右结构 JPG。
4. 背景候选色、手动选色、拖动和缩放正常。
5. 添加到 iPhone 主屏幕后能以独立窗口启动。
6. 完全退出应用，开启飞行模式，再次启动并完成一次离线合成。

## GitHub Pages 常见问题

### 页面显示 404

- 确认 `Settings → Pages → Source` 为 GitHub Actions。
- 确认仓库 Actions 没有被禁用。
- 确认 `Deploy Camera Frame PWA` 已成功完成。
- 私有仓库使用 Pages 可能受 GitHub 账户方案限制；若 GitHub 明确提示当前方案不支持，需要升级方案或把仓库改为公开。不要在未确认前改变仓库可见性。

### 页面打开但模板载入失败

- 不要直接打开构建目录中的 `index.html`。
- 检查 Actions 构建时的 `VITE_BASE` 是否为 `/camera-frame/`。
- 强制刷新页面；iPhone 可删除该站点的 Safari 网站数据后重新打开。

### iPhone 无法离线打开

- 必须从 HTTPS 正式地址安装，局域网 IP 的 HTTP 页面不能可靠安装 Service Worker。
- 首次安装和每次更新后至少联网完整打开一次。
- 等待模板就绪后再关闭页面。
- 低电量模式、系统存储不足或清理 Safari 数据可能移除离线缓存。

## 其他静态 HTTPS 托管

本项目不依赖后端，可部署到任意 HTTPS 静态主机：

```bash
npm ci
npm test
VITE_BASE=/ npm run build
```

将 `dist/` 中的全部内容原样上传，不能只上传 `index.html`。服务器应允许 `manifest.webmanifest`、`service-worker.js`、`assets/` 和 `icons/` 被直接访问；建议对 Service Worker 使用 `Cache-Control: no-cache`，带哈希的 JS/CSS 可长期缓存。

若托管在子目录，构建时使用对应路径，例如：

```bash
VITE_BASE=/camera-frame/ npm run build
```

## 密码访问

此 GitHub Pages 版本刻意不包含旧站点的密码 Worker、密码校验值、签名密钥或 Sites 项目标识。原有密码站点保持独立运行。若未来要求公开网址同时具备可靠密码保护，应使用带服务端或边缘鉴权的托管平台，而不是把密码写进前端 JavaScript。
