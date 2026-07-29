import { promises as fs } from "node:fs";
import path from "node:path";
import { defineConfig, type Plugin } from "vite";

function serviceWorkerManifest(): Plugin {
  return {
    name: "camera-frame-service-worker-manifest",
    apply: "build",
    async closeBundle() {
      const dist = path.resolve("dist");
      const files: string[] = [];
      async function walk(directory: string): Promise<void> {
        for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
          const absolute = path.join(directory, entry.name);
          if (entry.isDirectory()) await walk(absolute);
          else if (entry.name !== "service-worker.js") {
            files.push(`./${path.relative(dist, absolute).split(path.sep).join("/")}`);
          }
        }
      }
      await walk(dist);
      const swPath = path.join(dist, "service-worker.js");
      const source = await fs.readFile(swPath, "utf8");
      await fs.writeFile(
        swPath,
        source.replace("self.__PRECACHE_MANIFEST__ || []", JSON.stringify(files.sort())),
        "utf8",
      );
    },
  };
}

export default defineConfig({
  base: process.env.VITE_BASE || "./",
  plugins: [serviceWorkerManifest()],
  server: { host: "127.0.0.1", port: 4173, strictPort: true },
  preview: { host: "127.0.0.1", port: 4174 },
  worker: { format: "es" },
});
