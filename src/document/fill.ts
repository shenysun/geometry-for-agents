import type { Primitive } from "./parse-document.ts";

export type Fill = "none" | "solid" | "hatch";

export const FILLS = ["none", "solid", "hatch"] as const;

export function withFill(primitive: Primitive, fill: Fill): Primitive | null {
  switch (primitive.type) {
    case "overlapFill":
      // 重叠填充自身也有一份可改的填充样式（属性面板用）。
    case "polygon":
    case "rectangle":
    case "triangle":
    case "parallelogram":
    case "trapezoid":
    case "regularPolygon":
    case "circle":
    case "sector":
    case "bow":
    case "ring":
    case "ellipse":
      return { ...primitive, fill };
    default:
      return null;
  }
}
