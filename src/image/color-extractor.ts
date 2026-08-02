import type { ColorCandidate, LoadedImage } from "../config/types";

type Lab = [number, number, number];
type Rgb = [number, number, number];

interface Sample {
  rgb: Rgb;
  lab: Lab;
  saturation: number;
  brightness: number;
}

const clamp = (value: number, min = 0, max = 1): number =>
  Math.min(max, Math.max(min, value));

export function rgbToHex([r, g, b]: Rgb): string {
  return `#${[r, g, b]
    .map((channel) => Math.round(clamp(channel, 0, 255)).toString(16).padStart(2, "0"))
    .join("")}`;
}

export function hexToRgb(hex: string): Rgb {
  const clean = hex.replace("#", "").trim();
  const expanded = clean.length === 3 ? clean.split("").map((v) => v + v).join("") : clean;
  if (!/^[0-9a-f]{6}$/i.test(expanded)) return [111, 135, 149];
  return [0, 2, 4].map((offset) => Number.parseInt(expanded.slice(offset, offset + 2), 16)) as Rgb;
}

export function rgbToHsv([r8, g8, b8]: Rgb): [number, number, number] {
  const r = r8 / 255;
  const g = g8 / 255;
  const b = b8 / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;
  let hue = 0;
  if (delta > 1e-6) {
    if (max === r) hue = ((g - b) / delta) % 6;
    else if (max === g) hue = (b - r) / delta + 2;
    else hue = (r - g) / delta + 4;
    hue = (hue * 60 + 360) % 360;
  }
  return [hue, max === 0 ? 0 : delta / max, max];
}

export function hsvToRgb([h, s, v]: [number, number, number]): Rgb {
  const chroma = v * s;
  const segment = ((h % 360) + 360) % 360 / 60;
  const x = chroma * (1 - Math.abs((segment % 2) - 1));
  let [r, g, b] = [0, 0, 0];
  if (segment < 1) [r, g] = [chroma, x];
  else if (segment < 2) [r, g] = [x, chroma];
  else if (segment < 3) [g, b] = [chroma, x];
  else if (segment < 4) [g, b] = [x, chroma];
  else if (segment < 5) [r, b] = [x, chroma];
  else [r, b] = [chroma, x];
  const m = v - chroma;
  return [(r + m) * 255, (g + m) * 255, (b + m) * 255];
}

function rgbToLab([r8, g8, b8]: Rgb): Lab {
  const linear = (value: number): number => {
    const normalized = value / 255;
    return normalized <= 0.04045 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
  };
  const r = linear(r8);
  const g = linear(g8);
  const b = linear(b8);
  const x = (r * 0.4124564 + g * 0.3575761 + b * 0.1804375) / 0.95047;
  const y = r * 0.2126729 + g * 0.7151522 + b * 0.072175;
  const z = (r * 0.0193339 + g * 0.119192 + b * 0.9503041) / 1.08883;
  const f = (value: number): number =>
    value > 0.008856 ? Math.cbrt(value) : 7.787 * value + 16 / 116;
  const fx = f(x);
  const fy = f(y);
  const fz = f(z);
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}

function labDistance(a: Lab, b: Lab): number {
  const dl = (a[0] - b[0]) * 0.65;
  const da = a[1] - b[1];
  const db = a[2] - b[2];
  return dl * dl + da * da + db * db;
}

function collectSamples(data: Uint8ClampedArray, width: number, height: number): Sample[] {
  const pixelCount = width * height;
  const stride = Math.max(1, Math.floor(Math.sqrt(pixelCount / 32000)));
  const samples: Sample[] = [];
  const fallback: Sample[] = [];
  for (let y = 0; y < height; y += stride) {
    for (let x = 0; x < width; x += stride) {
      const index = (y * width + x) * 4;
      if (data[index + 3] < 96) continue;
      const rgb: Rgb = [data[index], data[index + 1], data[index + 2]];
      const [, saturation, brightness] = rgbToHsv(rgb);
      const sample = { rgb, lab: rgbToLab(rgb), saturation, brightness };
      if (brightness > 0.08 && brightness < 0.96) fallback.push(sample);
      if (brightness > 0.13 && brightness < 0.92 && saturation > 0.075) samples.push(sample);
    }
  }
  return samples.length >= 200 ? samples : fallback;
}

function seedCenters(samples: Sample[], count: number): Lab[] {
  const vivid = samples.reduce((best, sample) => {
    const score = sample.saturation * 0.7 + (1 - Math.abs(sample.brightness - 0.58)) * 0.3;
    const bestScore = best.saturation * 0.7 + (1 - Math.abs(best.brightness - 0.58)) * 0.3;
    return score > bestScore ? sample : best;
  }, samples[0]);
  const centers: Lab[] = [[...vivid.lab]];
  while (centers.length < count) {
    let best = samples[centers.length % samples.length];
    let bestDistance = -1;
    for (const sample of samples) {
      const nearest = Math.min(...centers.map((center) => labDistance(sample.lab, center)));
      const weighted = nearest * (0.65 + sample.saturation * 0.7);
      if (weighted > bestDistance) {
        bestDistance = weighted;
        best = sample;
      }
    }
    centers.push([...best.lab]);
  }
  return centers;
}

export function extractColorCandidates(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  requested = 5,
): ColorCandidate[] {
  const samples = collectSamples(data, width, height);
  if (!samples.length) {
    return [{ hex: "#6f8795", rgb: [111, 135, 149], weight: 1, saturation: 0.26, brightness: 0.58 }];
  }
  const k = Math.max(1, Math.min(requested, samples.length));
  let centers = seedCenters(samples, k);
  let labels = new Uint8Array(samples.length);
  for (let iteration = 0; iteration < 14; iteration += 1) {
    const sums = Array.from({ length: k }, () => [0, 0, 0, 0]);
    samples.forEach((sample, index) => {
      let nearest = 0;
      let nearestDistance = Number.POSITIVE_INFINITY;
      centers.forEach((center, cluster) => {
        const distance = labDistance(sample.lab, center);
        if (distance < nearestDistance) {
          nearest = cluster;
          nearestDistance = distance;
        }
      });
      labels[index] = nearest;
      sums[nearest][0] += sample.lab[0];
      sums[nearest][1] += sample.lab[1];
      sums[nearest][2] += sample.lab[2];
      sums[nearest][3] += 1;
    });
    centers = centers.map((center, index) => {
      const sum = sums[index];
      return sum[3] ? [sum[0] / sum[3], sum[1] / sum[3], sum[2] / sum[3]] : center;
    });
  }

  const clusterStats = Array.from({ length: k }, () => ({ count: 0, rgb: [0, 0, 0] as Rgb }));
  samples.forEach((sample, index) => {
    const stat = clusterStats[labels[index]];
    stat.count += 1;
    stat.rgb[0] += sample.rgb[0];
    stat.rgb[1] += sample.rgb[1];
    stat.rgb[2] += sample.rgb[2];
  });
  const result = clusterStats
    .filter((stat) => stat.count > 0)
    .map((stat) => {
      const rgb = stat.rgb.map((value) => Math.round(value / stat.count)) as Rgb;
      const [, saturation, brightness] = rgbToHsv(rgb);
      return {
        hex: rgbToHex(rgb),
        rgb,
        weight: stat.count / samples.length,
        saturation,
        brightness,
        score: stat.count / samples.length * (0.78 + Math.min(0.55, saturation) * 0.72) *
          (0.72 + (1 - Math.abs(brightness - 0.58)) * 0.28),
      };
    })
    .sort((a, b) => b.score - a.score)
    .filter((candidate, index, array) => {
      return array.slice(0, index).every((other) => {
        const dr = candidate.rgb[0] - other.rgb[0];
        const dg = candidate.rgb[1] - other.rgb[1];
        const db = candidate.rgb[2] - other.rgb[2];
        return Math.sqrt(dr * dr + dg * dg + db * db) > 24;
      });
    })
    .slice(0, requested)
    .map(({ score: _score, ...candidate }) => candidate);

  return result.length ? result : [{ hex: "#6f8795", rgb: [111, 135, 149], weight: 1, saturation: 0.26, brightness: 0.58 }];
}

export function fitBackgroundColor(hex: string, saturationPercent: number, brightnessPercent: number): string {
  const [h, sourceSaturation, sourceBrightness] = rgbToHsv(hexToRgb(hex));
  // 接近中性的颜色（黑白灰）保持中性：其色相无意义（如灰色被解析为红色相），
  // 一旦注入饱和度就会把背景染成粉色/偏红。
  const targetSaturation = sourceSaturation < 0.06
    ? 0
    : clamp(sourceSaturation * 0.55 + (saturationPercent / 100) * 0.45, 0.25, 0.7);
  // 保留候选色自身的明暗与饱和差异（55% 权重），再用滑块目标微调（45% 权重），
  // 避免所有候选色被拉平到相同亮度后，点击不同色块背景看起来毫无变化。
  const targetBrightness = clamp(sourceBrightness * 0.55 + (brightnessPercent / 100) * 0.45, 0.35, 0.78);
  return rgbToHex(hsvToRgb([h, targetSaturation, targetBrightness]));
}

export function applyColorStrength(hex: string, strengthPercent: number): string {
  const rgb = hexToRgb(hex);
  const [h, , brightness] = rgbToHsv(rgb);
  const strength = clamp(strengthPercent / 100);
  const neutral = hsvToRgb([h, 0.06, clamp(brightness + 0.12, 0, 0.84)]);
  return rgbToHex(rgb.map((channel, index) => neutral[index] * (1 - strength) + channel * strength) as Rgb);
}

export function makeAnalysisCanvas(image: LoadedImage, maxEdge = 200): HTMLCanvasElement {
  const scale = Math.min(1, maxEdge / Math.max(image.width, image.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(image.width * scale));
  canvas.height = Math.max(1, Math.round(image.height * scale));
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) throw new Error("当前浏览器无法创建取色画布。");
  context.drawImage(image.source, 0, 0, canvas.width, canvas.height);
  return canvas;
}
