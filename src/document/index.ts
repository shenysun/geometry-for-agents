export {
  documentSchema,
  parseDocument,
} from "./parse-document.ts";
export type { GeometryDocument, Primitive } from "./parse-document.ts";
export {
  addPrimitive,
  removePrimitive,
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
