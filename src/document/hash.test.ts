import { describe, expect, test } from "vitest";
import {
  documentToHash,
  hashToDocument,
  parseDocument,
} from "./index.ts";

function parsed(space: "2d" | "3d", primitives: unknown[], underlay: unknown = null) {
  const result = parseDocument({ version: 1, space, underlay, primitives });
  expect(result.success).toBe(true);
  if (!result.success) throw new Error(result.error);
  return result.document;
}

describe("document hash", () => {
  test("lz-string roundtrip is structurally equal to the original document", () => {
    const document = parsed("2d", [
      {
        id: "circle-1",
        type: "circle",
        cx: 0,
        cy: 1,
        r: 2,
        fill: "solid",
      },
      {
        id: "bow-1",
        type: "bow",
        cx: 1,
        cy: 1,
        r: 3,
        startDeg: 0,
        endDeg: 90,
        fill: "hatch",
      },
    ]);

    const hash = documentToHash(document);
    expect(hash.length).toBeGreaterThan(0);
    expect(hash).not.toContain("{");

    const decoded = hashToDocument(hash);
    expect(decoded.success).toBe(true);
    if (!decoded.success) return;
    expect(decoded.document).toEqual(document);

    const reparsed = parseDocument(JSON.stringify(decoded.document));
    expect(reparsed.success).toBe(true);
    if (!reparsed.success) return;
    expect(reparsed.document).toEqual(document);
  });

  test("roundtrips a 3d voxel document and an https underlay", () => {
    const document = parsed(
      "3d",
      [{ id: "voxel-1", type: "voxel", x: 0, y: 2, z: -1 }],
      {
        url: "https://example.com/problem.png",
        opacity: 0.4,
        x: 1,
        y: -2,
        scale: 1.5,
      },
    );

    const decoded = hashToDocument(`#${documentToHash(document)}`);
    expect(decoded.success).toBe(true);
    if (!decoded.success) return;
    expect(decoded.document).toEqual(document);
    expect(decoded.document.underlay).toEqual(document.underlay);
  });

  test("rejects a damaged hash", () => {
    const result = hashToDocument("not-a-valid-lz-payload");

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.length).toBeGreaterThan(0);
  });
});
