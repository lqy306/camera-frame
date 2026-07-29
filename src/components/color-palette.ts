import type { ColorCandidate } from "../config/types";

export class ColorPalette {
  readonly element: HTMLElement;
  private selectedHex = "";
  private candidates: ColorCandidate[] = [];
  private readonly onSelect: (candidate: ColorCandidate) => void;

  constructor(onSelect: (candidate: ColorCandidate) => void) {
    this.onSelect = onSelect;
    this.element = document.createElement("div");
    this.element.className = "color-palette";
    this.element.setAttribute("aria-label", "候选背景颜色");
    this.render();
  }

  setCandidates(candidates: ColorCandidate[], selectedHex?: string): void {
    this.candidates = candidates;
    if (selectedHex) this.selectedHex = selectedHex.toLowerCase();
    this.render();
  }

  select(hex: string): void {
    this.selectedHex = hex.toLowerCase();
    this.render();
  }

  private render(): void {
    this.element.replaceChildren();
    if (!this.candidates.length) {
      const placeholder = document.createElement("span");
      placeholder.className = "palette-placeholder";
      placeholder.textContent = "导入照片后显示候选色";
      this.element.append(placeholder);
      return;
    }
    this.candidates.forEach((candidate, index) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "color-chip";
      button.style.setProperty("--chip-color", candidate.hex);
      button.setAttribute("aria-label", `候选颜色 ${index + 1}：${candidate.hex}`);
      button.setAttribute("aria-pressed", String(candidate.hex.toLowerCase() === this.selectedHex));
      button.title = candidate.hex;
      button.addEventListener("click", () => {
        this.selectedHex = candidate.hex.toLowerCase();
        this.render();
        this.onSelect(candidate);
      });
      this.element.append(button);
    });
  }
}

