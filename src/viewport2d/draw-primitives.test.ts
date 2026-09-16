import { describe, expect, test } from "vitest";
import { overlapMaskTransform } from "./draw-primitives.ts";
import { worldToScreen } from "./transform.ts";

// 回归（圆∩三角形看不到填充）：遮罩画布的世界→像素仿射漏了视口原点，
// 交集被画在遮罩画布之外，Konva.Image 全透明。契约：任意世界点经矩阵
// 映射后必须落在 (worldToScreen(w) − 画布左上角) · pixelRatio 处。
describe("overlapMaskTransform", () => {
  test("映射含视口原点平移，与 worldToScreen 对齐", () => {
    const view = { originX: 331, originY: 247, scale: 40 };
    const [x, y, pixelRatio] = [251, 107, 2];
    const [a, b, c, d, e, f] = overlapMaskTransform(view, x, y, pixelRatio);
    for (const world of [
      { x: 0, y: 0 },
      { x: 0.5, y: 1 },
      { x: -2, y: 3.25 },
    ]) {
      const screen = worldToScreen(world, view);
      const canvasX = a * world.x + c * world.y + e;
      const canvasY = b * world.x + d * world.y + f;
      expect(canvasX).toBeCloseTo((screen.x - x) * pixelRatio);
      expect(canvasY).toBeCloseTo((screen.y - y) * pixelRatio);
    }
  });
});
