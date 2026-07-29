import type { ColorCandidate, LoadedImage } from "../config/types";
import { makeAnalysisCanvas } from "./color-extractor";

export class ColorWorkerClient {
  private readonly worker: Worker;
  private sequence = 0;
  private pending = new Map<number, {
    resolve: (value: ColorCandidate[]) => void;
    reject: (reason: Error) => void;
  }>();

  constructor() {
    this.worker = new Worker(new URL("../workers/image-worker.ts", import.meta.url), { type: "module" });
    this.worker.onmessage = (event: MessageEvent<{ id: number; candidates?: ColorCandidate[]; error?: string }>) => {
      const task = this.pending.get(event.data.id);
      if (!task) return;
      this.pending.delete(event.data.id);
      if (event.data.error) task.reject(new Error(event.data.error));
      else task.resolve(event.data.candidates ?? []);
    };
    this.worker.onerror = (event) => {
      for (const task of this.pending.values()) task.reject(new Error(event.message || "取色工作线程异常。"));
      this.pending.clear();
    };
  }

  analyze(image: LoadedImage): Promise<ColorCandidate[]> {
    const canvas = makeAnalysisCanvas(image, 200);
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) return Promise.reject(new Error("无法读取取色画布。"));
    const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
    const id = ++this.sequence;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.worker.postMessage(
        { id, width: canvas.width, height: canvas.height, buffer: imageData.data.buffer },
        [imageData.data.buffer],
      );
    });
  }

  dispose(): void {
    this.worker.terminate();
    for (const task of this.pending.values()) task.reject(new Error("取色任务已取消。"));
    this.pending.clear();
  }
}

