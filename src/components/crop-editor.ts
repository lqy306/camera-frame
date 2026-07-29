import type { CropAnchor, CropTransform } from "../config/types";

const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value));

export class CropGestureController {
  private readonly pointers = new Map<number, PointerEvent>();
  private enabled = false;
  private startDistance = 0;
  private startZoom = 1;
  private transform: CropTransform;

  constructor(
    private readonly target: HTMLElement,
    initial: CropTransform,
    private readonly onChange: (transform: CropTransform, final: boolean) => void,
  ) {
    this.transform = { ...initial };
    target.addEventListener("pointerdown", this.onPointerDown);
    target.addEventListener("pointermove", this.onPointerMove);
    target.addEventListener("pointerup", this.onPointerUp);
    target.addEventListener("pointercancel", this.onPointerUp);
    target.addEventListener("wheel", this.onWheel, { passive: false });
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    this.pointers.clear();
  }

  setTransform(transform: CropTransform): void {
    this.transform = { ...transform };
  }

  reset(anchor: CropAnchor = "center"): void {
    this.transform = { zoom: 1, offsetX: 0, offsetY: 0, anchor };
    this.onChange({ ...this.transform }, true);
  }

  private distance(): number {
    const [a, b] = Array.from(this.pointers.values());
    return a && b ? Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY) : 0;
  }

  private onPointerDown = (event: PointerEvent): void => {
    if (!this.enabled) return;
    this.target.setPointerCapture(event.pointerId);
    this.pointers.set(event.pointerId, event);
    if (this.pointers.size === 2) {
      this.startDistance = this.distance();
      this.startZoom = this.transform.zoom;
    }
  };

  private onPointerMove = (event: PointerEvent): void => {
    if (!this.enabled || !this.pointers.has(event.pointerId)) return;
    const previous = this.pointers.get(event.pointerId)!;
    this.pointers.set(event.pointerId, event);
    if (this.pointers.size >= 2 && this.startDistance > 0) {
      this.transform.zoom = clamp(this.startZoom * (this.distance() / this.startDistance), 1, 5);
    } else {
      const rect = this.target.getBoundingClientRect();
      this.transform.offsetX = clamp(this.transform.offsetX - (event.clientX - previous.clientX) / Math.max(80, rect.width) * 3, -1, 1);
      this.transform.offsetY = clamp(this.transform.offsetY - (event.clientY - previous.clientY) / Math.max(80, rect.height) * 3, -1, 1);
    }
    this.onChange({ ...this.transform }, false);
  };

  private onPointerUp = (event: PointerEvent): void => {
    if (!this.enabled) return;
    this.pointers.delete(event.pointerId);
    if (this.pointers.size < 2) this.startDistance = 0;
    this.onChange({ ...this.transform }, true);
  };

  private onWheel = (event: WheelEvent): void => {
    if (!this.enabled) return;
    event.preventDefault();
    this.transform.zoom = clamp(this.transform.zoom * Math.exp(-event.deltaY * 0.002), 1, 5);
    this.onChange({ ...this.transform }, true);
  };

  dispose(): void {
    this.target.removeEventListener("pointerdown", this.onPointerDown);
    this.target.removeEventListener("pointermove", this.onPointerMove);
    this.target.removeEventListener("pointerup", this.onPointerUp);
    this.target.removeEventListener("pointercancel", this.onPointerUp);
    this.target.removeEventListener("wheel", this.onWheel);
  }
}

