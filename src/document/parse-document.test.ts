import { describe, expect, test } from "vitest";
import { documentSchema, parseDocument } from "./index.ts";

function spec(
  space: "2d" | "3d",
  primitives: unknown[] = [],
  underlay: unknown = null,
) {
  return { version: 1, space, underlay, primitives };
}

const closed2dPrimitives = [
  {
    id: "line-1",
    type: "line",
    points: [
      { x: 0, y: 0 },
      { x: 3, y: 0 },
      { x: 3, y: 4 },
    ],
  },
  {
    id: "poly-1",
    type: "polygon",
    points: [
      { x: 0, y: 0 },
      { x: 2, y: 0 },
      { x: 1, y: 1 },
    ],
    fill: "hatch",
  },
  {
    id: "circle-1",
    type: "circle",
    cx: 0,
    cy: 0,
    r: 2,
    fill: "solid",
  },
  {
    id: "sector-1",
    type: "sector",
    cx: 0,
    cy: 0,
    r: 2,
    startDeg: 0,
    endDeg: 90,
    fill: "none",
  },
  {
    id: "bow-1",
    type: "bow",
    cx: 1,
    cy: 1,
    r: 3,
    startDeg: 45,
    endDeg: 135,
    fill: "hatch",
  },
  {
    id: "arc-1",
    type: "arc",
    cx: 0,
    cy: 0,
    r: 2,
    startDeg: 0,
    endDeg: 180,
  },
  {
    id: "ring-1",
    type: "ring",
    cx: 0,
    cy: 0,
    rInner: 1,
    rOuter: 3,
    fill: "solid",
  },
  {
    id: "ellipse-1",
    type: "ellipse",
    cx: 0,
    cy: 0,
    rx: 2,
    ry: 1,
    fill: "none",
  },
  {
    id: "label-1",
    type: "label",
    x: 0,
    y: 4,
    text: "A",
  },
];

const validBox = {
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
};

describe("parseDocument", () => {
  test("parses a valid empty 2d document", () => {
    const input = spec("2d");
    const result = parseDocument(input);

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.document).toEqual(input);
  });

  test("parses a valid empty 3d document", () => {
    const result = parseDocument(spec("3d"));

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.document.space).toBe("3d");
    expect(result.document.primitives).toEqual([]);
  });

  test("parses a 2d document containing every closed 2d primitive type", () => {
    const result = parseDocument(spec("2d", closed2dPrimitives));

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.document.primitives.map((p) => p.type)).toEqual([
      "line",
      "polygon",
      "circle",
      "sector",
      "bow",
      "arc",
      "ring",
      "ellipse",
      "label",
    ]);
  });

  test("parses a 3d document of integer voxels occupying unit cubes", () => {
    const voxels = [
      { id: "voxel-1", type: "voxel", x: 0, y: 0, z: 0 },
      { id: "voxel-2", type: "voxel", x: 1, y: 2, z: -1 },
    ];
    const result = parseDocument(spec("3d", voxels));

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.document.primitives).toEqual(voxels);
  });

  test("rejects an unknown primitive type", () => {
    const result = parseDocument(
      spec("2d", [
        {
          id: "seg-1",
          type: "segment",
          points: [
            { x: 0, y: 0 },
            { x: 1, y: 0 },
          ],
        },
      ]),
    );

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.toLowerCase()).toMatch(/type|segment/);
  });

  test("rejects fill on line, arc, and label", () => {
    const withFill = (primitive: Record<string, unknown>) =>
      parseDocument(spec("2d", [{ ...primitive, fill: "solid" }]));

    expect(
      withFill({
        id: "line-1",
        type: "line",
        points: [
          { x: 0, y: 0 },
          { x: 1, y: 0 },
        ],
      }).success,
    ).toBe(false);
    expect(
      withFill({
        id: "arc-1",
        type: "arc",
        cx: 0,
        cy: 0,
        r: 2,
        startDeg: 0,
        endDeg: 90,
      }).success,
    ).toBe(false);
    expect(
      withFill({
        id: "label-1",
        type: "label",
        x: 0,
        y: 1,
        text: "A",
      }).success,
    ).toBe(false);
  });

  test("rejects a primitive missing required fields", () => {
    const result = parseDocument(
      spec("2d", [{ id: "circle-1", type: "circle" }]),
    );

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error).toMatch(/cx|cy|r|fill/i);
  });

  test("rejects a 2d primitive in space 3d", () => {
    const result = parseDocument(
      spec("3d", [
        {
          id: "line-1",
          type: "line",
          points: [
            { x: 0, y: 0 },
            { x: 1, y: 0 },
          ],
        },
      ]),
    );

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error).toContain('type "line" is not allowed in space "3d"');
  });

  test("rejects a voxel in space 2d", () => {
    const result = parseDocument(
      spec("2d", [{ id: "voxel-1", type: "voxel", x: 0, y: 0, z: 0 }]),
    );

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error).toContain('type "voxel" is not allowed in space "2d"');
  });

  test("rejects duplicate primitive ids", () => {
    const result = parseDocument(
      spec("3d", [
        { id: "same", type: "voxel", x: 0, y: 0, z: 0 },
        { id: "same", type: "voxel", x: 1, y: 0, z: 0 },
      ]),
    );

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error).toMatch(/duplicate|id/i);
  });

  test("parses a JSON string of a valid document", () => {
    const result = parseDocument(JSON.stringify(spec("2d")));

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.document.space).toBe("2d");
  });

  test("parses underlay with an https url and alignment", () => {
    const underlay = {
      url: "https://example.com/problem.png",
      opacity: 0.4,
      x: 1,
      y: -2,
      scale: 1.5,
    };
    const result = parseDocument(spec("2d", [], underlay));

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.document.underlay).toEqual(underlay);
  });

  test("rejects underlay url that is not http or https", () => {
    const result = parseDocument(
      spec("2d", [], {
        url: "file:///tmp/problem.png",
        opacity: 0.5,
        x: 0,
        y: 0,
        scale: 1,
      }),
    );

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.toLowerCase()).toMatch(/url|http/);
  });

  test("opens a legacy ellipse without rotationDeg as rotation 0", () => {
    const result = parseDocument(
      spec("2d", [
        {
          id: "ellipse-1",
          type: "ellipse",
          cx: 0,
          cy: 0,
          rx: 2,
          ry: 1,
          fill: "none",
        },
      ]),
    );

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.document.primitives[0]).toEqual({
      id: "ellipse-1",
      type: "ellipse",
      cx: 0,
      cy: 0,
      rx: 2,
      ry: 1,
      rotationDeg: 0,
      fill: "none",
    });
  });

  test("keeps an explicit ellipse rotationDeg", () => {
    const result = parseDocument(
      spec("2d", [
        {
          id: "ellipse-1",
          type: "ellipse",
          cx: 0,
          cy: 0,
          rx: 2,
          ry: 1,
          rotationDeg: 45,
          fill: "solid",
        },
      ]),
    );

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.document.primitives[0].type === "ellipse").toBe(true);
    if (result.document.primitives[0].type !== "ellipse") return;
    expect(result.document.primitives[0].rotationDeg).toBe(45);
  });

  test("rejects a non-numeric ellipse rotationDeg", () => {
    const result = parseDocument(
      spec("2d", [
        {
          id: "ellipse-1",
          type: "ellipse",
          cx: 0,
          cy: 0,
          rx: 2,
          ry: 1,
          rotationDeg: "45",
          fill: "none",
        },
      ]),
    );

    expect(result.success).toBe(false);
  });

  test("records Y-up and voxel occupancy on the schema", () => {
    const description = documentSchema.description ?? "";

    expect(description).toMatch(/2[Dd].*Y/s);
    expect(description).toMatch(/3[Dd].*Y/s);
    expect(description).toContain("[x,x+1]");
    expect(description).toContain("[y,y+1]");
    expect(description).toContain("[z,z+1]");
  });

  test("parses a 3d document where box and voxel coexist", () => {
    const result = parseDocument(
      spec("3d", [
        validBox,
        { id: "voxel-1", type: "voxel", x: 0, y: 0, z: 0 },
      ]),
    );

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.document.primitives.map((p) => p.type)).toEqual([
      "box",
      "voxel",
    ]);
  });

  test("rejects a box in space 2d", () => {
    const result = parseDocument(spec("2d", [validBox]));

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error).toContain('type "box" is not allowed in space "2d"');
  });

  test("rejects a box with non-positive width, depth, or height", () => {
    for (const field of ["width", "depth", "height"] as const) {
      const result = parseDocument(spec("3d", [{ ...validBox, [field]: 0 }]));
      expect(result.success, `field ${field}`).toBe(false);
    }
    expect(
      parseDocument(spec("3d", [{ ...validBox, height: -1 }])).success,
    ).toBe(false);
  });

  test("rejects a box missing a rotation field", () => {
    const { rotationDegY: _omitted, ...withoutRotation } = validBox;
    const result = parseDocument(spec("3d", [withoutRotation]));

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error).toMatch(/rotationDegY/);
  });

  test("records the box bottom-face-center anchor on the schema", () => {
    const description = documentSchema.description ?? "";

    expect(description).toContain("box");
    expect(description).toMatch(/bottom[^\n]{0,60}center/i);
    expect(description).toContain("Y→X→Z");
  });
});
