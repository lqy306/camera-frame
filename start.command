#!/bin/zsh
set -eu

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$PROJECT_DIR"

if ! command -v node >/dev/null 2>&1; then
  echo "错误：未找到 Node.js。请先从 https://nodejs.org 安装 Node.js 18 或更高版本。"
  echo "安装后重新双击 start.command。"
  read -r "?按回车键退出…"
  exit 1
fi

NODE_MAJOR="$(node -p 'Number(process.versions.node.split(".")[0])')"
if [ "$NODE_MAJOR" -lt 18 ]; then
  echo "错误：当前 Node.js 版本过低（$(node -v)），需要 18 或更高版本。"
  read -r "?按回车键退出…"
  exit 1
fi

if [ ! -d node_modules ]; then
  echo "首次启动：正在安装项目依赖…"
  npm_config_cache="$PROJECT_DIR/.npm-cache" npm install
fi

LAN_IP="$(/usr/sbin/ipconfig getifaddr en0 2>/dev/null || /usr/sbin/ipconfig getifaddr en1 2>/dev/null || true)"
echo ""
echo "Camera Frame PWA 开发服务器"
echo "Mac 访问：http://127.0.0.1:4173/"
if [ -n "$LAN_IP" ]; then
  echo "iPhone（同一 Wi-Fi）：http://$LAN_IP:4173/"
else
  echo "未自动识别局域网地址；可在‘系统设置 → Wi-Fi → 详细信息’查看本机 IP。"
fi
echo "按 Control-C 停止服务器。"

(sleep 1; open "http://127.0.0.1:4173/") &
exec npm run dev -- --host 0.0.0.0

