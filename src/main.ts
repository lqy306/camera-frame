import "./styles.css";
import { CameraFrameApp } from "./app";
import { registerServiceWorker } from "./pwa/register-service-worker";

const root = document.querySelector<HTMLElement>("#app");
if (!root) throw new Error("缺少应用挂载节点 #app。");

new CameraFrameApp(root);
void registerServiceWorker();
