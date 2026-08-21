import type { GeometryDocument } from "./parse-document.ts";

export type Space = GeometryDocument["space"];
export type SpaceChangePlan = "noop" | "apply" | "confirm-clear";

export function planSpaceChange(
  document: GeometryDocument,
  next: Space,
): SpaceChangePlan {
  if (document.space === next) {
    return "noop";
  }
  if (document.primitives.length === 0) {
    return "apply";
  }
  return "confirm-clear";
}
