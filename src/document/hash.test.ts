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

  test("roundtrips an ellipse with rotationDeg and defaults a legacy one to 0", () => {
    const rotated = parsed("2d", [
      {
        id: "ellipse-1",
        type: "ellipse",
        cx: 1,
        cy: 2,
        rx: 3,
        ry: 1,
        rotationDeg: 30,
        fill: "solid",
      },
    ]);

    const decoded = hashToDocument(documentToHash(rotated));
    expect(decoded.success).toBe(true);
    if (!decoded.success) return;
    expect(decoded.document).toEqual(rotated);

    const legacy = parseDocument({
      version: 1,
      space: "2d",
      underlay: null,
      primitives: [
        {
          id: "ellipse-2",
          type: "ellipse",
          cx: 0,
          cy: 0,
          rx: 2,
          ry: 1,
          fill: "none",
        },
      ],
    });
    expect(legacy.success).toBe(true);
    if (!legacy.success) return;

    const relegacy = hashToDocument(documentToHash(legacy.document));
    expect(relegacy.success).toBe(true);
    if (!relegacy.success) return;
    expect(relegacy.document).toEqual(legacy.document);
    const primitive = relegacy.document.primitives[0];
    expect(primitive.type === "ellipse" && primitive.rotationDeg === 0).toBe(
      true,
    );
  });

  test("roundtrips a rectangle with rotationDeg and fill", () => {
    const document = parsed("2d", [
      {
        id: "rect-1",
        type: "rectangle",
        x: 1,
        y: 2,
        width: 4,
        height: 2,
        rotationDeg: 30,
        fill: "hatch",
      },
    ]);

    const decoded = hashToDocument(documentToHash(document));
    expect(decoded.success).toBe(true);
    if (!decoded.success) return;
    expect(decoded.document).toEqual(document);

    const reparsed = parseDocument(JSON.stringify(decoded.document));
    expect(reparsed.success).toBe(true);
    if (!reparsed.success) return;
    expect(reparsed.document).toEqual(document);
  });

  test("roundtrips the base-height family with rotationDeg and fill", () => {
    const document = parsed("2d", [
      {
        id: "tri-1",
        type: "triangle",
        x: 1,
        y: 2,
        width: 4,
        height: 3,
        apexOffset: 0.5,
        rotationDeg: 30,
        fill: "hatch",
      },
      {
        id: "para-1",
        type: "parallelogram",
        x: -1,
        y: 0,
        width: 2,
        height: 1,
        skew: -0.5,
        rotationDeg: 0,
        fill: "solid",
      },
      {
        id: "trap-1",
        type: "trapezoid",
        x: 3,
        y: -2,
        width: 5,
        topWidth: 2,
        height: 1.5,
        topOffset: -0.5,
        rotationDeg: 15,
        fill: "none",
      },
    ]);

    const decoded = hashToDocument(documentToHash(document));
    expect(decoded.success).toBe(true);
    if (!decoded.success) return;
    expect(decoded.document).toEqual(document);

    const reparsed = parseDocument(JSON.stringify(decoded.document));
    expect(reparsed.success).toBe(true);
    if (!reparsed.success) return;
    expect(reparsed.document).toEqual(document);
  });

  test("roundtrips an angle", () => {
    const document = parsed("2d", [
      {
        id: "angle-1",
        type: "angle",
        x: 1,
        y: 2,
        startDeg: 30,
        endDeg: 120,
        length: 4,
      },
    ]);

    const decoded = hashToDocument(documentToHash(document));
    expect(decoded.success).toBe(true);
    if (!decoded.success) return;
    expect(decoded.document).toEqual(document);

    const reparsed = parseDocument(JSON.stringify(decoded.document));
    expect(reparsed.success).toBe(true);
    if (!reparsed.success) return;
    expect(reparsed.document).toEqual(document);
  });

  test("roundtrips a 3d document mixing box and voxel", () => {
    const document = parsed("3d", [
      {
        id: "box-1",
        type: "box",
        x: 1,
        y: 0,
        z: -2,
        width: 2,
        depth: 3,
        height: 0.5,
        rotationDegY: 30,
        rotationDegX: 0,
        rotationDegZ: -10,
      },
      { id: "voxel-1", type: "voxel", x: 0, y: 2, z: -1 },
    ]);

    const decoded = hashToDocument(documentToHash(document));
    expect(decoded.success).toBe(true);
    if (!decoded.success) return;
    expect(decoded.document).toEqual(document);

    const reparsed = parseDocument(JSON.stringify(decoded.document));
    expect(reparsed.success).toBe(true);
    if (!reparsed.success) return;
    expect(reparsed.document).toEqual(document);
  });

  test("roundtrips a 3d document with cylinder, cone and sphere alongside voxel and box", () => {
    const document = parsed("3d", [
      {
        id: "cylinder-1",
        type: "cylinder",
        x: 1,
        y: 0,
        z: -2,
        r: 0.5,
        height: 2,
        rotationDegY: 30,
        rotationDegX: 0,
        rotationDegZ: 0,
      },
      {
        id: "cone-1",
        type: "cone",
        x: 0,
        y: 0,
        z: 0,
        r: 1,
        height: 3,
        rotationDegY: 0,
        rotationDegX: 90,
        rotationDegZ: 0,
      },
      { id: "sphere-1", type: "sphere", x: 2, y: 1, z: 0, r: 0.5 },
      { id: "box-1", type: "box", x: 0, y: 0, z: 0, width: 1, depth: 1, height: 1, rotationDegY: 0, rotationDegX: 0, rotationDegZ: 0 },
      { id: "voxel-1", type: "voxel", x: 0, y: 2, z: -1 },
    ]);

    const decoded = hashToDocument(documentToHash(document));
    expect(decoded.success).toBe(true);
    if (!decoded.success) return;
    expect(decoded.document).toEqual(document);
  });

  test("roundtrips a 3d document with pyramid and triangularPrism alongside the other solids", () => {
    const document = parsed("3d", [
      {
        id: "pyramid-1",
        type: "pyramid",
        x: 0,
        y: 0,
        z: 0,
        width: 1,
        depth: 1,
        height: 1,
        rotationDegY: 45,
        rotationDegX: 0,
        rotationDegZ: 0,
      },
      {
        id: "prism-1",
        type: "triangularPrism",
        x: 1,
        y: 0,
        z: -1,
        height: 1,
        base: [
          { x: 0, z: Math.sqrt(3) / 3 },
          { x: -0.5, z: -Math.sqrt(3) / 6 },
          { x: 0.5, z: -Math.sqrt(3) / 6 },
        ],
        rotationDegY: 0,
        rotationDegX: 30,
        rotationDegZ: 0,
      },
      { id: "voxel-1", type: "voxel", x: 0, y: 2, z: -1 },
      { id: "box-1", type: "box", x: 0, y: 0, z: 0, width: 1, depth: 1, height: 1, rotationDegY: 0, rotationDegX: 0, rotationDegZ: 0 },
    ]);

    const decoded = hashToDocument(documentToHash(document));
    expect(decoded.success).toBe(true);
    if (!decoded.success) return;
    expect(decoded.document).toEqual(document);
  });

  test("rejects a damaged hash", () => {
    const result = hashToDocument("not-a-valid-lz-payload");

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.length).toBeGreaterThan(0);
  });
});
