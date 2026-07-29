import type { CameraTemplateDefinition, ColorCandidate, CropAnchor, LayoutMode, ProcessingSettings } from "../config/types";
import { ColorPalette } from "./color-palette";

export type CropTarget = "photo" | "screen";

export interface ControlPanelCallbacks {
  onSettingsChange(patch: Partial<ProcessingSettings>, immediate?: boolean): void;
  onCandidate(candidate: ColorCandidate): void;
  onReextract(): void;
  onCropReset(anchor: CropAnchor): void;
  onCropTarget(target: CropTarget): void;
  onCropEditing(active: boolean): void;
}

interface SliderSpec {
  key: keyof ProcessingSettings;
  label: string;
  min: number;
  max: number;
  suffix?: string;
}

export class ControlPanel {
  readonly element: HTMLDetailsElement;
  readonly palette: ColorPalette;
  private readonly callbacks: ControlPanelCallbacks;
  private readonly values = new Map<keyof ProcessingSettings, HTMLElement>();
  private readonly inputs = new Map<keyof ProcessingSettings, HTMLInputElement | HTMLSelectElement>();
  private readonly colorInput: HTMLInputElement;
  private readonly colorPreview: HTMLElement;
  private readonly photoTarget: HTMLButtonElement;
  private readonly screenTarget: HTMLButtonElement;
  private readonly layoutNote: HTMLElement;
  private readonly outputNote: HTMLElement;

  constructor(settings: ProcessingSettings, callbacks: ControlPanelCallbacks) {
    this.callbacks = callbacks;
    this.element = document.createElement("details");
    this.element.className = "control-drawer";
    this.element.open = window.matchMedia("(min-width: 861px)").matches;
    requestAnimationFrame(() => {
      if (window.innerWidth <= 860) this.element.open = false;
    });
    this.element.innerHTML = `
      <summary>
        <span><strong>调整参数</strong><small>背景、屏幕与构图</small></span>
        <span class="drawer-chevron" aria-hidden="true">⌃</span>
      </summary>
      <div class="drawer-content">
        <section class="control-section" data-section="layout">
          <h2>版式</h2>
          <label class="field-row"><span>相机模板</span>
            <select data-setting="cameraTemplate">
              <option value="ricoh_gr2">Ricoh GR II</option>
            </select>
          </label>
          <label class="field-row"><span>排列方式</span>
            <select data-setting="layoutMode">
              <option value="stacked">上下结构 · 横版照片</option>
              <option value="sideBySide">左右结构 · 竖版照片</option>
            </select>
          </label>
          <p class="output-note" data-role="layout-note"></p>
        </section>
        <section class="control-section" data-section="background">
          <div class="section-heading"><h2>背景</h2><span class="current-color" aria-label="当前背景颜色"></span></div>
          <label class="field-row"><span>背景模式</span>
            <select data-setting="backgroundMode">
              <option value="solid">纯色全替换</option>
              <option value="gradient">柔和渐变</option>
              <option value="legacy">原版轻度融合</option>
            </select>
          </label>
          <label class="toggle-row"><span><strong>自动提取背景色</strong><small>在本机分析照片综合色</small></span>
            <input type="checkbox" data-setting="autoBackground" role="switch" />
          </label>
          <div class="palette-label">候选综合色</div>
          <div data-slot="palette"></div>
          <div class="compact-actions">
            <label class="button button-small color-picker-button">手动选色<input type="color" data-setting="backgroundColor" /></label>
            <button class="button button-small" type="button" data-action="reextract">重新自动取色</button>
          </div>
          <div data-slot="background-sliders"></div>
        </section>
        <section class="control-section">
          <h2>相机与液晶屏</h2>
          <div data-slot="camera-sliders"></div>
        </section>
        <section class="control-section">
          <h2>构图</h2>
          <label class="field-row"><span>裁切方式</span>
            <select data-setting="cropMode"><option value="cover">cover · 铺满</option><option value="contain">contain · 完整</option></select>
          </label>
          <label class="toggle-row"><span><strong>同步液晶屏与大图构图</strong><small>使用同一位置和缩放</small></span>
            <input type="checkbox" data-setting="syncCrops" role="switch" />
          </label>
          <div class="crop-targets" role="group" aria-label="编辑区域">
            <button type="button" class="segmented is-selected" data-crop-target="photo">下方照片</button>
            <button type="button" class="segmented" data-crop-target="screen">液晶屏</button>
          </div>
          <label class="toggle-row"><span><strong>在预览上拖动构图</strong><small>支持双指缩放</small></span>
            <input type="checkbox" data-action="crop-edit" role="switch" />
          </label>
          <div class="compact-actions crop-actions">
            <button class="button button-small" type="button" data-anchor="center">居中</button>
            <button class="button button-small" type="button" data-anchor="top">顶部</button>
            <button class="button button-small" type="button" data-anchor="bottom">底部</button>
          </div>
        </section>
        <section class="control-section">
          <h2>输出</h2>
          <label class="field-row"><span>文件格式</span>
            <select data-setting="outputFormat"><option value="jpeg">JPG</option><option value="png">PNG</option></select>
          </label>
          <div data-slot="output-sliders"></div>
          <p class="output-note" data-role="output-note">保存尺寸固定为 1280 × 1813；PNG 不使用质量参数。</p>
        </section>
      </div>`;
    this.colorPreview = this.element.querySelector<HTMLElement>(".current-color")!;
    this.colorInput = this.element.querySelector<HTMLInputElement>("input[type='color']")!;
    this.photoTarget = this.element.querySelector<HTMLButtonElement>("[data-crop-target='photo']")!;
    this.screenTarget = this.element.querySelector<HTMLButtonElement>("[data-crop-target='screen']")!;
    this.layoutNote = this.element.querySelector<HTMLElement>("[data-role='layout-note']")!;
    this.outputNote = this.element.querySelector<HTMLElement>("[data-role='output-note']")!;
    this.palette = new ColorPalette(callbacks.onCandidate);
    this.element.querySelector("[data-slot='palette']")?.append(this.palette.element);
    this.installSelectsAndToggles();
    this.installSliders();
    this.installActions();
    this.update(settings);
    this.setLayoutPresentation(
      settings.layoutMode,
      settings.layoutMode === "sideBySide" ? 2720 : 1280,
      settings.layoutMode === "sideBySide" ? 1920 : 1813,
    );
  }

  private installSelectsAndToggles(): void {
    this.element.querySelectorAll<HTMLInputElement | HTMLSelectElement>("[data-setting]").forEach((input) => {
      const key = input.dataset.setting as keyof ProcessingSettings;
      this.inputs.set(key, input);
      const eventName = input instanceof HTMLSelectElement ? "change" : "input";
      input.addEventListener(eventName, () => {
        let value: unknown = input.value;
        if (input instanceof HTMLInputElement && input.type === "checkbox") value = input.checked;
        if (key === "backgroundColor") value = this.colorInput.value;
        this.callbacks.onSettingsChange({ [key]: value } as Partial<ProcessingSettings>, true);
      });
    });
  }

  private createSlider(spec: SliderSpec): HTMLElement {
    const row = document.createElement("label");
    row.className = "slider-row";
    row.innerHTML = `<span class="slider-meta"><span>${spec.label}</span><output></output></span>
      <input type="range" min="${spec.min}" max="${spec.max}" step="1" data-setting="${spec.key}" />`;
    const input = row.querySelector<HTMLInputElement>("input")!;
    const output = row.querySelector<HTMLOutputElement>("output")!;
    this.inputs.set(spec.key, input);
    this.values.set(spec.key, output);
    input.addEventListener("input", () => {
      output.value = `${input.value}${spec.suffix ?? ""}`;
      this.callbacks.onSettingsChange({ [spec.key]: Number(input.value) } as Partial<ProcessingSettings>);
    });
    input.addEventListener("change", () => {
      this.callbacks.onSettingsChange({ [spec.key]: Number(input.value) } as Partial<ProcessingSettings>, true);
    });
    return row;
  }

  private installSliders(): void {
    const background: SliderSpec[] = [
      { key: "backgroundSaturation", label: "背景饱和度", min: 0, max: 100, suffix: "%" },
      { key: "backgroundBrightness", label: "背景亮度", min: 0, max: 100, suffix: "%" },
      { key: "backgroundStrength", label: "颜色强度", min: 0, max: 100, suffix: "%" },
      { key: "gradientStrength", label: "渐变幅度", min: 0, max: 100, suffix: "%" },
      { key: "textureStrength", label: "背景纹理", min: 0, max: 30, suffix: "%" },
    ];
    const camera: SliderSpec[] = [
      { key: "shadowStrength", label: "相机阴影", min: 0, max: 100, suffix: "%" },
      { key: "lcdBrightness", label: "液晶屏亮度", min: 40, max: 130, suffix: "%" },
      { key: "lcdSaturation", label: "液晶屏饱和度", min: 0, max: 150, suffix: "%" },
      { key: "lcdContrast", label: "液晶屏对比度", min: 50, max: 150, suffix: "%" },
    ];
    const output: SliderSpec[] = [
      { key: "outputQuality", label: "JPG 质量", min: 70, max: 100, suffix: "%" },
    ];
    for (const spec of background) this.element.querySelector("[data-slot='background-sliders']")?.append(this.createSlider(spec));
    for (const spec of camera) this.element.querySelector("[data-slot='camera-sliders']")?.append(this.createSlider(spec));
    for (const spec of output) this.element.querySelector("[data-slot='output-sliders']")?.append(this.createSlider(spec));
  }

  private installActions(): void {
    this.element.querySelector<HTMLButtonElement>("[data-action='reextract']")?.addEventListener("click", this.callbacks.onReextract);
    this.element.querySelector<HTMLInputElement>("[data-action='crop-edit']")?.addEventListener("change", (event) => {
      this.callbacks.onCropEditing((event.currentTarget as HTMLInputElement).checked);
    });
    this.element.querySelectorAll<HTMLButtonElement>("[data-anchor]").forEach((button) => {
      button.addEventListener("click", () => this.callbacks.onCropReset(button.dataset.anchor as CropAnchor));
    });
    this.element.querySelectorAll<HTMLButtonElement>("[data-crop-target]").forEach((button) => {
      button.addEventListener("click", () => {
        if (button.disabled) return;
        const target = button.dataset.cropTarget as CropTarget;
        this.selectCropTarget(target);
        this.callbacks.onCropTarget(target);
      });
    });
  }

  update(settings: ProcessingSettings): void {
    this.inputs.forEach((input, key) => {
      const value = settings[key];
      if (input instanceof HTMLInputElement && input.type === "checkbox") input.checked = Boolean(value);
      else input.value = String(value);
      const output = this.values.get(key);
      if (output) output.textContent = `${value}%`;
    });
    this.colorInput.value = settings.backgroundColor;
    this.colorPreview.style.background = settings.backgroundColor;
    this.colorPreview.title = settings.backgroundColor;
    this.screenTarget.disabled = settings.syncCrops;
    const gradientRow = this.inputs.get("gradientStrength")?.closest("label");
    if (gradientRow) gradientRow.toggleAttribute("hidden", settings.backgroundMode !== "gradient");
    const qualityRow = this.inputs.get("outputQuality")?.closest("label");
    if (qualityRow) qualityRow.toggleAttribute("hidden", settings.outputFormat !== "jpeg");
  }

  setCandidates(candidates: ColorCandidate[], selectedHex: string): void {
    this.palette.setCandidates(candidates, selectedHex);
  }

  setCameraTemplates(templates: CameraTemplateDefinition[], selectedId: string): void {
    const select = this.inputs.get("cameraTemplate");
    if (!(select instanceof HTMLSelectElement)) return;
    select.replaceChildren(...templates.map((template) => {
      const option = document.createElement("option");
      option.value = template.id;
      option.textContent = template.label;
      return option;
    }));
    select.value = selectedId;
  }

  setCurrentColor(hex: string): void {
    this.colorPreview.style.background = hex;
    this.colorInput.value = hex;
  }

  setLayoutPresentation(mode: LayoutMode, width: number, height: number): void {
    const sideBySide = mode === "sideBySide";
    this.photoTarget.textContent = sideBySide ? "左侧照片" : "下方照片";
    this.layoutNote.textContent = sideBySide
      ? "左侧为标准 2:3 竖幅（1280×1920）；相机顺时针旋转90°，照片与液晶屏保持正向。"
      : "保留原版上下排列，适合横版照片。";
    this.outputNote.textContent = `保存尺寸固定为 ${width} × ${height}；PNG 不使用质量参数。`;
  }

  selectCropTarget(target: CropTarget): void {
    this.element.querySelectorAll<HTMLElement>("[data-crop-target]").forEach((item) => {
      item.classList.toggle("is-selected", item.dataset.cropTarget === target);
    });
  }
}
