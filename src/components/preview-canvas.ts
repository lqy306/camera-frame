export interface PreviewCallbacks {
  onChoose(file: File): void;
  onGenerate(): void;
  onSave(): void;
  onShare(): void;
}

export class PreviewCanvasView {
  readonly element: HTMLElement;
  readonly stage: HTMLElement;
  readonly fileInput: HTMLInputElement;
  private readonly canvasHost: HTMLElement;
  private readonly emptyState: HTMLElement;
  private readonly statusText: HTMLElement;
  private readonly saveButton: HTMLButtonElement;
  private readonly shareButton: HTMLButtonElement;
  private readonly generateButton: HTMLButtonElement;
  private readonly statusRow: HTMLElement;

  constructor(callbacks: PreviewCallbacks) {
    this.element = document.createElement("main");
    this.element.className = "workspace";
    this.element.innerHTML = `
      <section class="preview-card" aria-label="照片合成预览">
        <div class="preview-heading">
          <div>
            <p class="eyebrow">本地离线合成</p>
            <h1>固定相机拼图</h1>
          </div>
          <span class="privacy-badge"><span aria-hidden="true">●</span> 照片不会上传</span>
        </div>
        <div class="preview-stage" tabindex="0" aria-label="输出预览，可拖动调整构图">
          <div class="empty-state">
            <div class="empty-icon" aria-hidden="true">＋</div>
            <strong>选择一张照片开始</strong>
            <span>支持 JPG、PNG 与 WEBP，可拖到这里</span>
          </div>
          <div class="canvas-host"></div>
          <div class="gesture-tip" hidden>拖动调整位置 · 双指缩放</div>
        </div>
        <div class="status-row" role="status" aria-live="polite">
          <span class="status-dot"></span><span class="status-text">正在载入固定模板…</span>
        </div>
        <div class="primary-actions">
          <label class="button button-primary file-button">
            <input type="file" accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp" />
            <span>选择照片</span>
          </label>
          <button class="button" type="button" data-action="generate" disabled>重新生成</button>
          <button class="button" type="button" data-action="save" disabled>保存图片</button>
          <button class="button button-share" type="button" data-action="share" disabled>分享</button>
        </div>
      </section>`;
    this.stage = this.element.querySelector<HTMLElement>(".preview-stage")!;
    this.canvasHost = this.element.querySelector<HTMLElement>(".canvas-host")!;
    this.emptyState = this.element.querySelector<HTMLElement>(".empty-state")!;
    this.statusText = this.element.querySelector<HTMLElement>(".status-text")!;
    this.statusRow = this.element.querySelector<HTMLElement>(".status-row")!;
    this.fileInput = this.element.querySelector<HTMLInputElement>("input[type='file']")!;
    this.generateButton = this.element.querySelector<HTMLButtonElement>("[data-action='generate']")!;
    this.saveButton = this.element.querySelector<HTMLButtonElement>("[data-action='save']")!;
    this.shareButton = this.element.querySelector<HTMLButtonElement>("[data-action='share']")!;
    this.fileInput.addEventListener("change", () => {
      const file = this.fileInput.files?.[0];
      if (file) callbacks.onChoose(file);
      this.fileInput.value = "";
    });
    this.generateButton.addEventListener("click", callbacks.onGenerate);
    this.saveButton.addEventListener("click", callbacks.onSave);
    this.shareButton.addEventListener("click", callbacks.onShare);
    ["dragenter", "dragover"].forEach((type) => this.stage.addEventListener(type, (event) => {
      event.preventDefault();
      this.stage.classList.add("is-dragging");
    }));
    ["dragleave", "drop"].forEach((type) => this.stage.addEventListener(type, (event) => {
      event.preventDefault();
      this.stage.classList.remove("is-dragging");
    }));
    this.stage.addEventListener("drop", (event) => {
      const file = event.dataTransfer?.files?.[0];
      if (file) callbacks.onChoose(file);
    });
  }

  showCanvas(canvas: HTMLCanvasElement): void {
    this.canvasHost.replaceChildren(canvas);
    this.emptyState.hidden = true;
    this.stage.classList.add("has-image");
  }

  setLayout(width: number, height: number, sideBySide: boolean): void {
    this.stage.style.aspectRatio = `${width} / ${height}`;
    this.stage.setAttribute(
      "aria-label",
      sideBySide ? "左右结构输出预览，可拖动调整左侧照片构图" : "上下结构输出预览，可拖动调整下方照片构图",
    );
  }

  setReady(enabled: boolean): void {
    this.generateButton.disabled = !enabled;
    this.saveButton.disabled = !enabled;
    this.shareButton.disabled = !enabled;
  }

  setStatus(message: string, kind: "normal" | "working" | "success" | "error" = "normal"): void {
    this.statusText.textContent = message;
    this.element.querySelector(".status-row")?.setAttribute("data-kind", kind);
  }

  setGestureActive(active: boolean): void {
    const tip = this.element.querySelector<HTMLElement>(".gesture-tip");
    if (tip) tip.hidden = !active;
    this.stage.classList.toggle("crop-active", active);
  }

  setFallbackLink(url: string, filename: string): void {
    this.statusRow.querySelector(".fallback-link")?.remove();
    const link = document.createElement("a");
    link.className = "fallback-link";
    link.href = url;
    link.target = "_blank";
    link.rel = "noopener";
    link.download = filename;
    link.textContent = "打开图片";
    link.setAttribute("aria-label", "打开已生成图片，可长按保存");
    this.statusRow.append(link);
  }
}
