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
    id: "rect-1",
    type: "rectangle",
    x: 1,
    y: -2,
    width: 4,
    height: 2,
    rotationDeg: 30,
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
      "rectangle",
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

const validCylinder = {
  id: "cylinder-1",
  type: "cylinder",
  x: 1,
  y: 0,
  z: -2,
  r: 0.5,
  height: 1,
  rotationDegY: 0,
  rotationDegX: 30,
  rotationDegZ: 0,
};

const validCone = {
  id: "cone-1",
  type: "cone",
  x: 0,
  y: 0.5,
  z: 0,
  r: 2,
  height: 3,
  rotationDegY: 90,
  rotationDegX: 0,
  rotationDegZ: -15,
};

const validSphere = {
  id: "sphere-1",
  type: "sphere",
  x: 0,
  y: 1,
  z: 0,
  r: 0.5,
};

describe("parseDocument 参数体：圆柱、圆锥、球", () => {
  test("parses a 3d document where cylinder, cone and sphere coexist with voxel and box", () => {
    const result = parseDocument(
      spec("3d", [
        validCylinder,
        validCone,
        validSphere,
        validBox,
        { id: "voxel-1", type: "voxel", x: 0, y: 0, z: 0 },
      ]),
    );

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.document.primitives.map((p) => p.type)).toEqual([
      "cylinder",
      "cone",
      "sphere",
      "box",
      "voxel",
    ]);
  });

  test("rejects a cylinder or cone with non-positive r or height", () => {
    for (const primitive of [validCylinder, validCone]) {
      for (const field of ["r", "height"] as const) {
        expect(
          parseDocument(spec("3d", [{ ...primitive, [field]: 0 }])).success,
          `${primitive.type} ${field}`,
        ).toBe(false);
      }
    }
    expect(
      parseDocument(spec("3d", [{ ...validCylinder, r: -0.5 }])).success,
    ).toBe(false);
  });

  test("rejects a cylinder missing a rotation field", () => {
    const { rotationDegX: _omitted, ...withoutRotation } = validCylinder;
    const result = parseDocument(spec("3d", [withoutRotation]));

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error).toMatch(/rotationDegX/);
  });

  test("rejects a sphere with any rotation field（球无旋转）", () => {
    for (const field of [
      "rotationDegY",
      "rotationDegX",
      "rotationDegZ",
    ] as const) {
      const result = parseDocument(spec("3d", [{ ...validSphere, [field]: 0 }]));
      expect(result.success, field).toBe(false);
    }
  });

  test("rejects a sphere with non-positive r", () => {
    expect(
      parseDocument(spec("3d", [{ ...validSphere, r: 0 }])).success,
    ).toBe(false);
  });

  test("rejects cylinder, cone and sphere in space 2d", () => {
    for (const primitive of [validCylinder, validCone, validSphere]) {
      const result = parseDocument(spec("2d", [primitive]));
      expect(result.success, primitive.type).toBe(false);
      if (result.success) continue;
      expect(result.error).toContain(
        `type "${primitive.type}" is not allowed in space "2d"`,
      );
    }
  });

  test("records the cylinder bottom-face-center and sphere-center anchors on the schema", () => {
    const description = documentSchema.description ?? "";

    expect(description).toContain("cylinder");
    expect(description).toContain("cone");
    expect(description).toMatch(/sphere[^\n]{0,60}center/i);
  });
});

const validPyramid = {
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
};

const validPrismBase = [
  { x: 0, z: Math.sqrt(3) / 3 },
  { x: -0.5, z: -Math.sqrt(3) / 6 },
  { x: 0.5, z: -Math.sqrt(3) / 6 },
];

const validPrism = {
  id: "prism-1",
  type: "triangularPrism",
  x: 1,
  y: 0.5,
  z: -1,
  height: 1,
  base: validPrismBase,
  rotationDegY: 0,
  rotationDegX: 30,
  rotationDegZ: 0,
};

describe("parseDocument 参数体：四棱锥与三棱柱", () => {
  test("parses a 3d document where pyramid and triangularPrism coexist with the other solids", () => {
    const result = parseDocument(
      spec("3d", [
        validPyramid,
        validPrism,
        validCylinder,
        validSphere,
        { id: "voxel-1", type: "voxel", x: 0, y: 0, z: 0 },
      ]),
    );

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.document.primitives.map((p) => p.type)).toEqual([
      "pyramid",
      "triangularPrism",
      "cylinder",
      "sphere",
      "voxel",
    ]);
  });

  test("keeps the triangularPrism base as exactly three local XZ points", () => {
    const result = parseDocument(spec("3d", [validPrism]));

    expect(result.success).toBe(true);
    if (!result.success) return;
    const prism = result.document.primitives[0];
    expect(prism.type).toBe("triangularPrism");
    if (prism.type !== "triangularPrism") return;
    expect(prism.base).toEqual(validPrismBase);
  });

  test("rejects a pyramid with non-positive width, depth, or height", () => {
    for (const field of ["width", "depth", "height"] as const) {
      const result = parseDocument(spec("3d", [{ ...validPyramid, [field]: 0 }]));
      expect(result.success, field).toBe(false);
    }
  });

  test("rejects a pyramid missing a rotation field", () => {
    const { rotationDegZ: _omitted, ...withoutRotation } = validPyramid;
    const result = parseDocument(spec("3d", [withoutRotation]));

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error).toMatch(/rotationDegZ/);
  });

  test("rejects a triangularPrism base that is not exactly three points", () => {
    const twoPoints = parseDocument(
      spec("3d", [{ ...validPrism, base: validPrismBase.slice(0, 2) }]),
    );
    const fourPoints = parseDocument(
      spec("3d", [
        { ...validPrism, base: [...validPrismBase, { x: 9, z: 9 }] },
      ]),
    );

    expect(twoPoints.success).toBe(false);
    expect(fourPoints.success).toBe(false);
  });

  test("rejects a triangularPrism base point with extra or missing fields", () => {
    const withY = parseDocument(
      spec("3d", [
        {
          ...validPrism,
          base: validPrismBase.map((point, at) =>
            at === 0 ? { ...point, y: 0 } : point,
          ),
        },
      ]),
    );
    const missingZ = parseDocument(
      spec("3d", [
        {
          ...validPrism,
          base: validPrismBase.map((point, at) =>
            at === 1 ? { x: point.x } : point,
          ),
        },
      ]),
    );

    expect(withY.success).toBe(false);
    expect(missingZ.success).toBe(false);
  });

  test("rejects a triangularPrism with non-positive height or missing rotation", () => {
    expect(
      parseDocument(spec("3d", [{ ...validPrism, height: 0 }])).success,
    ).toBe(false);

    const { rotationDegX: _omitted, ...withoutRotation } = validPrism;
    const result = parseDocument(spec("3d", [withoutRotation]));
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error).toMatch(/rotationDegX/);
  });

  test("rejects pyramid and triangularPrism in space 2d", () => {
    for (const primitive of [validPyramid, validPrism]) {
      const result = parseDocument(spec("2d", [primitive]));
      expect(result.success, primitive.type).toBe(false);
      if (result.success) continue;
      expect(result.error).toContain(
        `type "${primitive.type}" is not allowed in space "2d"`,
      );
    }
  });

  test("records the pyramid and prism anchors on the schema", () => {
    const description = documentSchema.description ?? "";

    expect(description).toContain("pyramid");
    expect(description).toContain("triangularPrism");
    expect(description).toMatch(/triangularPrism[^\n]{0,80}base/i);
  });
});

const validRectangle = {
  id: "rect-1",
  type: "rectangle",
  x: 1,
  y: -2,
  width: 4,
  height: 2,
  rotationDeg: 30,
  fill: "hatch",
};

describe("parseDocument 矩形", () => {
  test("parses a rectangle anchored at its center with size and rotation", () => {
    const result = parseDocument(spec("2d", [validRectangle]));

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.document.primitives[0]).toEqual(validRectangle);
  });

  test("opens a rectangle without rotationDeg as rotation 0", () => {
    const { rotationDeg: _omitted, ...withoutRotation } = validRectangle;
    const result = parseDocument(spec("2d", [withoutRotation]));

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.document.primitives[0]).toEqual({
      ...withoutRotation,
      rotationDeg: 0,
    });
  });

  test("rejects a rectangle with non-positive width or height", () => {
    for (const field of ["width", "height"] as const) {
      expect(
        parseDocument(spec("2d", [{ ...validRectangle, [field]: 0 }])).success,
        field,
      ).toBe(false);
    }
    expect(
      parseDocument(spec("2d", [{ ...validRectangle, height: -1 }])).success,
    ).toBe(false);
  });

  test("rejects a rectangle in space 3d", () => {
    const result = parseDocument(spec("3d", [validRectangle]));

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error).toContain(
      'type "rectangle" is not allowed in space "3d"',
    );
  });
});
