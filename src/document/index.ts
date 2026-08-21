export {
  documentSchema,
  parseDocument,
} from "./parse-document.ts";
export type { GeometryDocument, Primitive } from "./parse-document.ts";
export {
  addPrimitive,
  removePrimitive,
  setUnderlay,
  updatePrimitive,
} from "./update-document.ts";
export type { DocumentUpdateResult } from "./update-document.ts";
export {
  commitSnapshot,
  createHistory,
  redo,
  undo,
} from "./history.ts";
export type { DocumentHistory } from "./history.ts";
export { documentToPrompt } from "./prompt.ts";
export { documentToHash, hashToDocument } from "./hash.ts";
export { snap2d, snapVoxel } from "./snap.ts";
export type { GridSnap, Point2, Point3 } from "./snap.ts";
export { hitTest } from "./hit.ts";
export type { HitPoint } from "./hit.ts";
export { FILLS, withFill } from "./fill.ts";
export type { Fill } from "./fill.ts";
export { planSpaceChange } from "./space-change.ts";
export type { Space, SpaceChangePlan } from "./space-change.ts";
