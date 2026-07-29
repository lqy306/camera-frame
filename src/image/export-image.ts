export { canvasToBlob } from "./compositor";

export function makeOutputFilename(format: "jpeg" | "png", date = new Date()): string {
  const pad = (value: number): string => String(value).padStart(2, "0");
  const stamp = `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}_${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
  return `CameraFrame_${stamp}.${format === "png" ? "png" : "jpg"}`;
}

