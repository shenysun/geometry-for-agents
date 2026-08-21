import type { GeometryDocument } from "./parse-document.ts";

export type DocumentHistory = {
  past: GeometryDocument[];
  present: GeometryDocument;
  future: GeometryDocument[];
};

function snapshot(document: GeometryDocument): GeometryDocument {
  return structuredClone(document);
}

export function createHistory(document: GeometryDocument): DocumentHistory {
  return {
    past: [],
    present: snapshot(document),
    future: [],
  };
}

export function commitSnapshot(
  history: DocumentHistory,
  document: GeometryDocument,
): DocumentHistory {
  return {
    past: [...history.past, snapshot(history.present)],
    present: snapshot(document),
    future: [],
  };
}

export function undo(history: DocumentHistory): DocumentHistory {
  const previous = history.past.at(-1);
  if (previous === undefined) {
    return history;
  }
  return {
    past: history.past.slice(0, -1),
    present: snapshot(previous),
    future: [snapshot(history.present), ...history.future],
  };
}

export function redo(history: DocumentHistory): DocumentHistory {
  const [next, ...rest] = history.future;
  if (next === undefined) {
    return history;
  }
  return {
    past: [...history.past, snapshot(history.present)],
    present: snapshot(next),
    future: rest,
  };
}
