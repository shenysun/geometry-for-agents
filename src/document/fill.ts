import type { Primitive } from "./parse-document.ts";

export type Fill = "none" | "solid" | "hatch";

export const FILLS = ["none", "solid", "hatch"] as const;

export function withFill(primitive: Primitive, fill: Fill): Primitive | null {
  switch (primitive.type) {
    case "polygon":
    case "rectangle":
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
