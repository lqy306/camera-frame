/// <reference lib="webworker" />
import { extractColorCandidates } from "../image/color-extractor";

interface AnalyzeMessage {
  id: number;
  width: number;
  height: number;
  buffer: ArrayBuffer;
}

self.onmessage = (event: MessageEvent<AnalyzeMessage>) => {
  const { id, width, height, buffer } = event.data;
  try {
    const candidates = extractColorCandidates(new Uint8ClampedArray(buffer), width, height, 5);
    self.postMessage({ id, candidates });
  } catch (error) {
    self.postMessage({ id, error: error instanceof Error ? error.message : String(error) });
  }
};

export {};

