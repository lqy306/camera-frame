import { EXPORT_SOURCE_LONG_EDGE, PREVIEW_LONG_EDGE, TEMPLATE_CONFIG_URL, assetUrl } from "../config/runtime";
import type {
  CameraTemplateResources,
  LoadedImage,
  PhotoResource,
  TemplateAssetPaths,
  TemplateConfig,
  TemplateResources,
} from "../config/types";

type ClosableSource = CanvasImageSource & { close?: () => void };

async function loadImage(url: string): Promise<LoadedImage> {
  const response = await fetch(url, { cache: "force-cache" });
  if (!response.ok) throw new Error(`模板资源加载失败：${url} (${response.status})`);
  const blob = await response.blob();
  if (typeof createImageBitmap === "function") {
    const bitmap = await createImageBitmap(blob);
    return { source: bitmap, width: bitmap.width, height: bitmap.height };
  }
  const objectUrl = URL.createObjectURL(blob);
  try {
    const image = new Image();
    image.decoding = "async";
    image.src = objectUrl;
    await image.decode();
    return { source: image, width: image.naturalWidth, height: image.naturalHeight };
  } finally {
    // HTMLImageElement retains the decoded pixels after decode in supported Safari versions.
    globalThis.setTimeout(() => URL.revokeObjectURL(objectUrl), 0);
  }
}

function closeLoaded(image: LoadedImage): void {
  (image.source as ClosableSource).close?.();
}

function validateConfig(value: unknown): asserts value is TemplateConfig {
  if (!value || typeof value !== "object") throw new Error("template_config.json 格式无效。");
  const config = value as Partial<TemplateConfig>;
  if (config.canvasWidth !== 1280 || config.canvasHeight !== 1813 || config.splitY !== 960) {
    throw new Error("模板尺寸与固定版式不匹配。");
  }
  if (!Array.isArray(config.cameraTemplates) || config.cameraTemplates.length < 1) {
    throw new Error("模板缺少相机型号列表。");
  }
  const ids = new Set<string>();
  for (const template of config.cameraTemplates) {
    if (!template.id || !template.label || ids.has(template.id)) throw new Error("相机模板标识无效或重复。");
    if (!Array.isArray(template.screenQuad) || template.screenQuad.length !== 4 || !template.assets) {
      throw new Error(`相机模板 ${template.id} 缺少液晶屏坐标或资源表。`);
    }
    ids.add(template.id);
  }
  if (config.defaults?.layoutMode !== "stacked" || !ids.has(config.defaults.cameraTemplate)) {
    throw new Error("模板缺少有效的默认相机或上下版式配置。");
  }
}

export async function loadTemplateResources(): Promise<TemplateResources> {
  const response = await fetch(TEMPLATE_CONFIG_URL, { cache: "no-cache" });
  if (!response.ok) throw new Error(`无法读取模板配置 (${response.status})。`);
  const config: unknown = await response.json();
  validateConfig(config);
  const imageCache = new Map<string, Promise<LoadedImage>>();
  const loadAsset = (filename: string): Promise<LoadedImage> => {
    const url = assetUrl(filename);
    const cached = imageCache.get(url);
    if (cached) return cached;
    const loading = loadImage(url);
    imageCache.set(url, loading);
    return loading;
  };
  const templateEntries = await Promise.all(config.cameraTemplates.map(async (definition) => {
    const entries = await Promise.all(
      Object.entries(definition.assets).map(async ([key, filename]) => [key, await loadAsset(filename)] as const),
    );
    const loaded = Object.fromEntries(entries) as Record<keyof TemplateAssetPaths, LoadedImage>;
    const template: CameraTemplateResources = { definition, ...loaded };
    return [definition.id, template] as const;
  }));
  const templates = Object.fromEntries(templateEntries);
  const resources: TemplateResources = {
    config,
    templates,
    dispose() {
      const unique = new Set<LoadedImage>();
      Object.values(templates).forEach((template) => {
        Object.entries(template).forEach(([key, image]) => {
          if (key !== "definition") unique.add(image as LoadedImage);
        });
      });
      unique.forEach(closeLoaded);
    },
  };
  return resources;
}

async function resizeSource(source: CanvasImageSource, width: number, height: number): Promise<LoadedImage> {
  if (typeof createImageBitmap === "function") {
    try {
      const bitmap = await createImageBitmap(source, {
        resizeWidth: width,
        resizeHeight: height,
        resizeQuality: "high",
      });
      return { source: bitmap, width: bitmap.width, height: bitmap.height };
    } catch {
      // Older Safari falls through to the canvas path.
    }
  }
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("当前浏览器无法缩放照片。");
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.drawImage(source, 0, 0, width, height);
  return { source: canvas, width, height };
}

function targetSize(width: number, height: number, longestEdge: number): [number, number] {
  const scale = Math.min(1, longestEdge / Math.max(width, height));
  return [Math.max(1, Math.round(width * scale)), Math.max(1, Math.round(height * scale))];
}

export async function decodePhoto(file: File): Promise<PhotoResource> {
  if (!file.type.startsWith("image/") && !/\.(jpe?g|png|webp)$/i.test(file.name)) {
    throw new Error("请选择 JPG、JPEG、PNG 或 WEBP 图片。");
  }
  const objectUrl = URL.createObjectURL(file);
  const image = new Image();
  image.decoding = "async";
  image.src = objectUrl;
  try {
    await image.decode();
  } catch {
    URL.revokeObjectURL(objectUrl);
    throw new Error("图片无法读取，文件可能已损坏或格式不受支持。");
  }
  const sourceWidth = image.naturalWidth;
  const sourceHeight = image.naturalHeight;
  if (!sourceWidth || !sourceHeight) {
    URL.revokeObjectURL(objectUrl);
    throw new Error("图片尺寸无效。");
  }

  try {
    const [exportWidth, exportHeight] = targetSize(sourceWidth, sourceHeight, EXPORT_SOURCE_LONG_EDGE);
    const exportImage = await resizeSource(image, exportWidth, exportHeight);
    const [previewWidth, previewHeight] = targetSize(exportWidth, exportHeight, PREVIEW_LONG_EDGE);
    const previewImage = previewWidth === exportWidth && previewHeight === exportHeight
      ? exportImage
      : await resizeSource(exportImage.source, previewWidth, previewHeight);
    URL.revokeObjectURL(objectUrl);
    return {
      name: file.name,
      preview: previewImage,
      export: exportImage,
      dispose() {
        if (previewImage.source !== exportImage.source) closeLoaded(previewImage);
        closeLoaded(exportImage);
      },
    };
  } catch (error) {
    URL.revokeObjectURL(objectUrl);
    throw error;
  }
}
