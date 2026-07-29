import type { Point } from "../config/types";

function interpolateQuad(
  quad: [Point, Point, Point, Point],
  u: number,
  v: number,
): Point {
  const [tl, tr, br, bl] = quad;
  return {
    x: (1 - u) * (1 - v) * tl.x + u * (1 - v) * tr.x + u * v * br.x + (1 - u) * v * bl.x,
    y: (1 - u) * (1 - v) * tl.y + u * (1 - v) * tr.y + u * v * br.y + (1 - u) * v * bl.y,
  };
}

function drawTriangle(
  context: CanvasRenderingContext2D,
  source: CanvasImageSource,
  sourcePoints: [Point, Point, Point],
  destinationPoints: [Point, Point, Point],
): void {
  const [s0, s1, s2] = sourcePoints;
  const [d0, d1, d2] = destinationPoints;
  const denominator = s0.x * (s1.y - s2.y) + s1.x * (s2.y - s0.y) + s2.x * (s0.y - s1.y);
  if (Math.abs(denominator) < 1e-8) return;
  const solve = (v0: number, v1: number, v2: number): [number, number, number] => {
    const a = (v0 * (s1.y - s2.y) + v1 * (s2.y - s0.y) + v2 * (s0.y - s1.y)) / denominator;
    const c = (v0 * (s2.x - s1.x) + v1 * (s0.x - s2.x) + v2 * (s1.x - s0.x)) / denominator;
    const e = (
      v0 * (s1.x * s2.y - s2.x * s1.y) +
      v1 * (s2.x * s0.y - s0.x * s2.y) +
      v2 * (s0.x * s1.y - s1.x * s0.y)
    ) / denominator;
    return [a, c, e];
  };
  const [a, c, e] = solve(d0.x, d1.x, d2.x);
  const [b, d, f] = solve(d0.y, d1.y, d2.y);
  context.save();
  context.beginPath();
  context.moveTo(d0.x, d0.y);
  context.lineTo(d1.x, d1.y);
  context.lineTo(d2.x, d2.y);
  context.closePath();
  context.clip();
  context.setTransform(a, b, c, d, e, f);
  context.drawImage(source, 0, 0);
  context.restore();
}

export function drawImageInQuad(
  context: CanvasRenderingContext2D,
  source: CanvasImageSource,
  sourceWidth: number,
  sourceHeight: number,
  quad: [Point, Point, Point, Point],
  columns = 12,
  rows = 8,
): void {
  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      const u0 = column / columns;
      const u1 = (column + 1) / columns;
      const v0 = row / rows;
      const v1 = (row + 1) / rows;
      const s00 = { x: u0 * sourceWidth, y: v0 * sourceHeight };
      const s10 = { x: u1 * sourceWidth, y: v0 * sourceHeight };
      const s11 = { x: u1 * sourceWidth, y: v1 * sourceHeight };
      const s01 = { x: u0 * sourceWidth, y: v1 * sourceHeight };
      const d00 = interpolateQuad(quad, u0, v0);
      const d10 = interpolateQuad(quad, u1, v0);
      const d11 = interpolateQuad(quad, u1, v1);
      const d01 = interpolateQuad(quad, u0, v1);
      drawTriangle(context, source, [s00, s10, s11], [d00, d10, d11]);
      drawTriangle(context, source, [s00, s11, s01], [d00, d11, d01]);
    }
  }
}

