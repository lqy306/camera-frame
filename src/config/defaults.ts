import type { CropTransform, ProcessingSettings } from "./types";

export const DEFAULT_SETTINGS: ProcessingSettings = {
  cameraTemplate: "ricoh_gr2",
  layoutMode: "stacked",
  backgroundMode: "solid",
  autoBackground: true,
  backgroundColor: "#6f8795",
  backgroundSaturation: 55,
  backgroundBrightness: 65,
  backgroundStrength: 100,
  gradientStrength: 16,
  textureStrength: 5,
  shadowStrength: 70,
  lcdBrightness: 85,
  lcdSaturation: 80,
  lcdContrast: 95,
  cropMode: "cover",
  syncCrops: true,
  outputFormat: "jpeg",
  outputQuality: 95,
};

export const DEFAULT_CROP: CropTransform = {
  zoom: 1,
  offsetX: 0,
  offsetY: 0,
  anchor: "center",
};

export function cloneDefaultCrop(): CropTransform {
  return { ...DEFAULT_CROP };
}

export function cloneDefaultSettings(): ProcessingSettings {
  return { ...DEFAULT_SETTINGS };
}
