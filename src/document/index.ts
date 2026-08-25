export {
  documentSchema,
  fillable2dTypes,
  parseDocument,
} from "./parse-document.ts";
export type {
  GeometryDocument,
  Primitive,
  Primitive2d,
  Primitive3d,
} from "./parse-document.ts";
export {
  addPrimitive,
  addVertex,
  removePrimitive,
  removeVertex,
  setUnderlay,
  updatePrimitive,
} from "./update-document.ts";
export type {
  DocumentUpdateResult,
  SolidPrimitive,
} from "./update-document.ts";
export {
  commitSnapshot,
  createHistory,
  redo,
  undo,
} from "./history.ts";
export type { DocumentHistory } from "./history.ts";
export { documentToPrompt } from "./prompt.ts";
export { documentToHash, hashToDocument } from "./hash.ts";
export { snap2d, snap3d, snapVoxel } from "./snap.ts";
export type { GridSnap, Point2, Point3 } from "./snap.ts";
export { hitTest } from "./hit.ts";
export type { HitPoint } from "./hit.ts";
export { FILLS, withFill } from "./fill.ts";
export type { Fill } from "./fill.ts";
export { planSpaceChange } from "./space-change.ts";
export type { Space, SpaceChangePlan } from "./space-change.ts";
