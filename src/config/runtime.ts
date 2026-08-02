export const ASSET_BASE = `${import.meta.env.BASE_URL}assets/`;
export const TEMPLATE_CONFIG_URL = `${ASSET_BASE}template_config.json?v=8`;
export const PREVIEW_LONG_EDGE = 1200;
export const EXPORT_SOURCE_LONG_EDGE = 4096;

export function assetUrl(file: string): string {
  return new URL(file, new URL(ASSET_BASE, window.location.href)).href;
}
