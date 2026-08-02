import type { ProcessingSettings } from "./types";

/**
 * 本地配置持久化：把用户的参数选择（相机模板、背景、LCD、输出等）
 * 保存到 localStorage，下次打开自动恢复。只保存配置，不保存照片。
 */

const STORAGE_KEY = "camera-frame.settings.v1";

interface PersistedState {
  settings: ProcessingSettings;
  rawColor?: string;
}

export function saveSettings(settings: ProcessingSettings, rawColor?: string): void {
  try {
    const state: PersistedState = { settings, rawColor };
    globalThis.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // 隐私模式或存储不可用时静默忽略。
  }
}

export function loadSettings(): PersistedState | null {
  try {
    const raw = globalThis.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const state = JSON.parse(raw) as PersistedState;
    if (!state || typeof state !== "object" || !state.settings) return null;
    return state;
  } catch {
    return null;
  }
}

export function clearSettings(): void {
  try {
    globalThis.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // 同上。
  }
}
