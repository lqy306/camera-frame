export type BackgroundMode = "solid" | "gradient" | "legacy";
export type CropMode = "cover" | "contain";
export type CropAnchor = "center" | "top" | "bottom";
export type OutputFormat = "jpeg" | "png";
export type LayoutMode = "stacked" | "sideBySide";

export interface Point {
  x: number;
  y: number;
}

export interface CropTransform {
  zoom: number;
  offsetX: number;
  offsetY: number;
  anchor: CropAnchor;
}

export interface ProcessingSettings {
  cameraTemplate: string;
  layoutMode: LayoutMode;
  backgroundMode: BackgroundMode;
  autoBackground: boolean;
  backgroundColor: string;
  backgroundSaturation: number;
  backgroundBrightness: number;
  backgroundStrength: number;
  gradientStrength: number;
  textureStrength: number;
  shadowStrength: number;
  lcdBrightness: number;
  lcdSaturation: number;
  lcdContrast: number;
  cropMode: CropMode;
  syncCrops: boolean;
  outputFormat: OutputFormat;
  outputQuality: number;
}

export interface ColorCandidate {
  hex: string;
  rgb: [number, number, number];
  weight: number;
  saturation: number;
  brightness: number;
}

export interface TemplateAssetPaths {
  reference: string;
  cameraRgba: string;
  cameraMask: string;
  shadowLayer: string;
  shadowMask: string;
  backgroundMask: string;
  screenMask: string;
  backgroundTexture: string;
  screenShading: string;
}

export interface CameraTemplateDefinition {
  id: string;
  label: string;
  screenQuad: [Point, Point, Point, Point];
  screenRenderSize: { width: number; height: number };
  assets: TemplateAssetPaths;
}

export interface TemplateConfig {
  version: number;
  canvasWidth: number;
  canvasHeight: number;
  splitY: number;
  cameraTemplates: CameraTemplateDefinition[];
  defaults: ProcessingSettings;
}

export interface LoadedImage {
  source: CanvasImageSource;
  width: number;
  height: number;
}

export interface PhotoResource {
  name: string;
  preview: LoadedImage;
  export: LoadedImage;
  dispose(): void;
}

export interface CameraTemplateResources {
  definition: CameraTemplateDefinition;
  reference: LoadedImage;
  cameraRgba: LoadedImage;
  cameraMask: LoadedImage;
  shadowLayer: LoadedImage;
  shadowMask: LoadedImage;
  backgroundMask: LoadedImage;
  screenMask: LoadedImage;
  backgroundTexture: LoadedImage;
  screenShading: LoadedImage;
}

export interface TemplateResources {
  config: TemplateConfig;
  templates: Record<string, CameraTemplateResources>;
  dispose(): void;
}
