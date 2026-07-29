import { cloneDefaultCrop, cloneDefaultSettings } from "./config/defaults";
import type { ColorCandidate, CropAnchor, CropTransform, LayoutMode, PhotoResource, ProcessingSettings, TemplateResources } from "./config/types";
import { ControlPanel, type CropTarget } from "./components/control-panel";
import { CropGestureController } from "./components/crop-editor";
import { createHelpModal } from "./components/help-modal";
import { PreviewCanvasView } from "./components/preview-canvas";
import { createToolbar } from "./components/toolbar";
import { fitBackgroundColor } from "./image/color-extractor";
import { ColorWorkerClient } from "./image/color-worker-client";
import { canvasToBlob, renderComposite } from "./image/compositor";
import { getLayoutGeometry } from "./image/layout-geometry";
import { decodePhoto, loadTemplateResources } from "./image/resource-manager";

const PREVIEW_MAX_EDGE = 1200;
const FAST_PREVIEW_MAX_EDGE = 870;

interface LayoutCropState {
  photo: CropTransform;
  screen: CropTransform;
}

function createLayoutCropStates(): Record<LayoutMode, LayoutCropState> {
  return {
    stacked: { photo: cloneDefaultCrop(), screen: cloneDefaultCrop() },
    sideBySide: { photo: cloneDefaultCrop(), screen: cloneDefaultCrop() },
  };
}

function timestamp(): string {
  const date = new Date();
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}_${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
}

export class CameraFrameApp {
  private resources: TemplateResources | null = null;
  private photo: PhotoResource | null = null;
  private settings: ProcessingSettings = cloneDefaultSettings();
  private cropStates = createLayoutCropStates();
  private cropTarget: CropTarget = "photo";
  private candidates: ColorCandidate[] = [];
  private rawColor = this.settings.backgroundColor;
  private renderTimer = 0;
  private renderGeneration = 0;
  private dirty = false;
  private lastExportUrl: string | null = null;
  private readonly colorWorker = new ColorWorkerClient();
  private readonly preview: PreviewCanvasView;
  private readonly controls: ControlPanel;
  private readonly gestures: CropGestureController;

  constructor(private readonly root: HTMLElement) {
    const help = createHelpModal();
    const toolbar = createToolbar({ onHelp: () => help.open(), onReset: () => this.resetAll() });
    this.preview = new PreviewCanvasView({
      onChoose: (file) => void this.choosePhoto(file),
      onGenerate: () => void this.renderPreview(false),
      onSave: () => void this.exportImage(false),
      onShare: () => void this.exportImage(true),
    });
    this.controls = new ControlPanel(this.settings, {
      onSettingsChange: (patch, immediate) => this.applySettings(patch, immediate),
      onCandidate: (candidate) => this.chooseCandidate(candidate),
      onReextract: () => void this.extractColors(true),
      onCropReset: (anchor) => this.resetCrop(anchor),
      onCropTarget: (target) => this.setCropTarget(target),
      onCropEditing: (active) => {
        this.gestures.setEnabled(active);
        this.preview.setGestureActive(active);
      },
    });
    this.gestures = new CropGestureController(this.preview.stage, this.activeCrops().photo, (transform, final) => {
      const crops = this.activeCrops();
      if (this.cropTarget === "screen" && !this.settings.syncCrops) crops.screen = transform;
      else crops.photo = transform;
      this.dirty = true;
      this.scheduleRender(final ? 0 : 70, !final);
    });
    this.root.replaceChildren(toolbar, this.preview.element, this.controls.element, help.element);
    if (window.innerWidth <= 860) this.controls.element.open = false;
    window.addEventListener("beforeunload", (event) => {
      if (!this.dirty) return;
      event.preventDefault();
      event.returnValue = "";
    });
    void this.initialize();
  }

  private async initialize(): Promise<void> {
    try {
      this.preview.setStatus("正在载入固定模板…", "working");
      this.resources = await loadTemplateResources();
      this.settings = {
        ...this.resources.config.defaults,
        layoutMode: this.resources.config.defaults.layoutMode ?? "stacked",
        backgroundMode: "solid",
        backgroundStrength: 100,
      };
      this.rawColor = this.settings.backgroundColor;
      this.controls.setCameraTemplates(this.resources.config.cameraTemplates, this.settings.cameraTemplate);
      this.controls.update(this.settings);
      this.syncLayoutPresentation();
      this.preview.setStatus("模板已就绪，请选择照片。", "success");
    } catch (error) {
      this.preview.setStatus(error instanceof Error ? error.message : String(error), "error");
      this.showError("模板载入失败", error);
    }
  }

  private async choosePhoto(file: File): Promise<void> {
    this.preview.setStatus(`正在读取 ${file.name}…`, "working");
    this.preview.setReady(false);
    try {
      const nextPhoto = await decodePhoto(file);
      this.photo?.dispose();
      this.photo = nextPhoto;
      this.cropStates = createLayoutCropStates();
      this.cropTarget = "photo";
      this.controls.selectCropTarget("photo");
      this.gestures.setTransform(this.activeCrops().photo);
      await this.extractColors(false);
      await this.renderPreview(false);
      this.preview.setReady(true);
      this.preview.setStatus(`已载入 ${file.name} · 全程本地处理`, "success");
      this.dirty = true;
    } catch (error) {
      this.preview.setStatus(error instanceof Error ? error.message : String(error), "error");
      this.showError("无法读取照片", error);
      this.preview.setReady(Boolean(this.photo));
    }
  }

  private async extractColors(announce: boolean): Promise<void> {
    if (!this.photo) {
      if (announce) this.preview.setStatus("请先选择照片。", "error");
      return;
    }
    if (announce) this.preview.setStatus("正在重新分析综合色…", "working");
    try {
      this.candidates = await this.colorWorker.analyze(this.photo.preview);
      if (this.candidates[0] && (this.settings.autoBackground || !this.rawColor)) {
        this.rawColor = this.candidates[0].hex;
        this.settings.backgroundColor = this.fittedColor(this.rawColor);
      }
      this.controls.setCandidates(this.candidates, this.rawColor);
      this.controls.update(this.settings);
      if (announce) {
        await this.renderPreview(false);
        this.preview.setStatus(`已提取 ${this.candidates.length} 个候选综合色。`, "success");
      }
    } catch (error) {
      this.preview.setStatus("自动取色失败，仍可手动选择背景色。", "error");
      console.error(error);
    }
  }

  private fittedColor(raw: string): string {
    return fitBackgroundColor(raw, this.settings.backgroundSaturation, this.settings.backgroundBrightness);
  }

  private chooseCandidate(candidate: ColorCandidate): void {
    this.rawColor = candidate.hex;
    this.settings.autoBackground = false;
    this.settings.backgroundColor = this.fittedColor(candidate.hex);
    this.controls.update(this.settings);
    this.controls.palette.select(candidate.hex);
    this.dirty = true;
    this.scheduleRender(0);
  }

  private applySettings(patch: Partial<ProcessingSettings>, immediate = false): void {
    const previousLayout = this.settings.layoutMode;
    if (patch.backgroundColor) {
      this.rawColor = patch.backgroundColor;
      patch.autoBackground = false;
    }
    this.settings = { ...this.settings, ...patch };
    if (patch.autoBackground && this.candidates[0]) this.rawColor = this.candidates[0].hex;
    if (patch.backgroundColor || patch.backgroundSaturation !== undefined || patch.backgroundBrightness !== undefined || patch.autoBackground) {
      this.settings.backgroundColor = this.fittedColor(this.rawColor);
    }
    const crops = this.activeCrops();
    if (patch.layoutMode && patch.layoutMode !== previousLayout) {
      this.cropTarget = "photo";
      this.controls.selectCropTarget("photo");
      this.gestures.setTransform(crops.photo);
      this.syncLayoutPresentation();
    }
    if (patch.syncCrops === true) {
      this.cropTarget = "photo";
      crops.screen = { ...crops.photo };
      this.controls.selectCropTarget("photo");
      this.gestures.setTransform(crops.photo);
    }
    this.controls.update(this.settings);
    this.controls.setCandidates(this.candidates, this.rawColor);
    this.dirty = true;
    this.scheduleRender(immediate ? 0 : 150);
  }

  private setCropTarget(target: CropTarget): void {
    this.cropTarget = target;
    const crops = this.activeCrops();
    this.gestures.setTransform(target === "screen" ? crops.screen : crops.photo);
  }

  private resetCrop(anchor: CropAnchor): void {
    const reset: CropTransform = { zoom: 1, offsetX: 0, offsetY: 0, anchor };
    const crops = this.activeCrops();
    if (this.cropTarget === "screen" && !this.settings.syncCrops) crops.screen = reset;
    else crops.photo = reset;
    this.gestures.setTransform(reset);
    this.dirty = true;
    this.scheduleRender(0);
  }

  private resetAll(): void {
    const defaults = this.resources?.config.defaults ?? cloneDefaultSettings();
    this.settings = { ...defaults, backgroundMode: "solid", backgroundStrength: 100 };
    if (this.candidates[0]) this.rawColor = this.candidates[0].hex;
    this.settings.backgroundColor = this.fittedColor(this.rawColor);
    this.cropStates = createLayoutCropStates();
    this.cropTarget = "photo";
    this.controls.selectCropTarget("photo");
    this.gestures.setTransform(this.activeCrops().photo);
    this.controls.update(this.settings);
    this.controls.setCandidates(this.candidates, this.rawColor);
    this.syncLayoutPresentation();
    this.dirty = Boolean(this.photo);
    this.scheduleRender(0);
    this.preview.setStatus("已恢复默认参数。", "success");
  }

  private scheduleRender(delay: number, fast = false): void {
    window.clearTimeout(this.renderTimer);
    this.renderTimer = window.setTimeout(() => void this.renderPreview(fast), delay);
  }

  private async renderPreview(fast: boolean): Promise<void> {
    if (!this.photo || !this.resources) return;
    const generation = ++this.renderGeneration;
    this.preview.setStatus(fast ? "正在调整构图…" : "正在生成预览…", "working");
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    try {
      const crops = this.activeCrops();
      const geometry = getLayoutGeometry(
        this.resources.config,
        this.settings.layoutMode,
        this.activeTemplate().definition,
      );
      const maxEdge = fast ? FAST_PREVIEW_MAX_EDGE : PREVIEW_MAX_EDGE;
      const canvas = renderComposite({
        resources: this.resources,
        photo: this.photo.preview,
        settings: this.settings,
        photoCrop: crops.photo,
        screenCrop: crops.screen,
        scale: maxEdge / Math.max(geometry.canvasWidth, geometry.canvasHeight),
      });
      if (generation !== this.renderGeneration) return;
      canvas.className = "result-canvas";
      canvas.setAttribute("aria-label", "相机拼图生成结果");
      this.preview.showCanvas(canvas);
      this.preview.setReady(true);
      this.preview.setStatus(fast ? "松手后生成清晰预览。" : "预览已更新。", "success");
    } catch (error) {
      this.preview.setStatus(error instanceof Error ? error.message : String(error), "error");
      console.error(error);
    }
  }

  private async exportImage(share: boolean): Promise<void> {
    if (!this.photo || !this.resources) {
      this.preview.setStatus("请先选择照片。", "error");
      return;
    }
    window.clearTimeout(this.renderTimer);
    this.renderGeneration += 1;
    this.preview.setReady(false);
    const geometry = getLayoutGeometry(
      this.resources.config,
      this.settings.layoutMode,
      this.activeTemplate().definition,
    );
    this.preview.setStatus(`正在生成 ${geometry.canvasWidth} × ${geometry.canvasHeight} 高清图片…`, "working");
    try {
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      const crops = this.activeCrops();
      const canvas = renderComposite({
        resources: this.resources,
        photo: this.photo.export,
        settings: this.settings,
        photoCrop: crops.photo,
        screenCrop: crops.screen,
        scale: 1,
      });
      const blob = await canvasToBlob(canvas, this.settings.outputFormat, this.settings.outputQuality / 100);
      const extension = this.settings.outputFormat === "png" ? "png" : "jpg";
      const filename = `CameraFrame_${timestamp()}.${extension}`;
      const file = new File([blob], filename, { type: blob.type });
      let shared = false;
      if (share && navigator.share) {
        try {
          if (!navigator.canShare || navigator.canShare({ files: [file] })) {
            await navigator.share({ files: [file], title: "Camera Frame" });
            shared = true;
          }
        } catch (error) {
          if (error instanceof DOMException && error.name === "AbortError") {
            this.preview.setStatus("已取消系统分享。", "normal");
            return;
          }
          console.warn("系统分享不可用，改用下载：", error);
        }
      }
      if (!shared) this.download(blob, filename);
      this.dirty = false;
      this.preview.setStatus(shared ? "已交给系统分享。" : "图片已生成；若未自动保存，请长按新打开的图片。", "success");
    } catch (error) {
      this.preview.setStatus(error instanceof Error ? error.message : String(error), "error");
      this.showError("保存失败", error);
    } finally {
      this.preview.setReady(true);
    }
  }

  private download(blob: Blob, filename: string): void {
    if (this.lastExportUrl) URL.revokeObjectURL(this.lastExportUrl);
    const url = URL.createObjectURL(blob);
    this.lastExportUrl = url;
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    anchor.rel = "noopener";
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    this.preview.setFallbackLink(url, filename);
  }

  private showError(title: string, error: unknown): void {
    const message = error instanceof Error ? error.message : String(error);
    window.alert(`${title}\n\n${message}`);
  }

  private activeCrops(): LayoutCropState {
    return this.cropStates[this.settings.layoutMode];
  }

  private activeTemplate() {
    if (!this.resources) throw new Error("相机模板尚未载入。");
    const template = this.resources.templates[this.settings.cameraTemplate]
      ?? this.resources.templates[this.resources.config.defaults.cameraTemplate];
    if (!template) throw new Error("所选相机模板不可用。");
    return template;
  }

  private syncLayoutPresentation(): void {
    if (this.resources) {
      const geometry = getLayoutGeometry(
        this.resources.config,
        this.settings.layoutMode,
        this.activeTemplate().definition,
      );
      this.preview.setLayout(geometry.canvasWidth, geometry.canvasHeight, geometry.mode === "sideBySide");
      this.controls.setLayoutPresentation(geometry.mode, geometry.canvasWidth, geometry.canvasHeight);
      return;
    }
    const sideBySide = this.settings.layoutMode === "sideBySide";
    const width = sideBySide ? 2720 : 1280;
    const height = sideBySide ? 1920 : 1813;
    this.preview.setLayout(width, height, sideBySide);
    this.controls.setLayoutPresentation(this.settings.layoutMode, width, height);
  }
}
