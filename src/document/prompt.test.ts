import { describe, expect, test } from "vitest";
import { documentToPrompt, parseDocument } from "./index.ts";
import type { GeometryDocument } from "./index.ts";

function parsed(space: "2d" | "3d", primitives: unknown[], underlay: unknown = null) {
  const result = parseDocument({ version: 1, space, underlay, primitives });
  expect(result.success).toBe(true);
  if (!result.success) throw new Error(result.error);
  return result.document;
}

const twoDPrimitives = [
  {
    id: "line-1",
    type: "line",
    points: [
      { x: 0, y: 0 },
      { x: 3, y: 4 },
    ],
  },
  {
    id: "bow-1",
    type: "bow",
    cx: 1,
    cy: 2,
    r: 3,
    startDeg: 45,
    endDeg: 135,
    fill: "hatch",
  },
  {
    id: "label-1",
    type: "label",
    x: 0,
    y: 4,
    text: "A",
  },
];

const voxels = [
  { id: "voxel-1", type: "voxel", x: 0, y: 2, z: -1 },
];

describe("documentToPrompt", () => {
  test("returns the same string when called twice on the same document", () => {
    const document = parsed("2d", twoDPrimitives);
    const first = documentToPrompt(document);
    const second = documentToPrompt(document);

    expect(first).toBe(second);
    expect(first.length).toBeGreaterThan(0);
  });

  test("is stable across object key insertion order and primitive array order", () => {
    const document = parsed("2d", twoDPrimitives);
    const reordered = {
      primitives: [...document.primitives].reverse(),
      underlay: document.underlay,
      space: document.space,
      version: document.version,
    } as GeometryDocument;

    expect(documentToPrompt(reordered)).toBe(documentToPrompt(document));
  });

  test("states Y-up, angles in degrees, and 3D Y as height, and lists version plus primitives", () => {
    const document = parsed("3d", voxels);
    const prompt = documentToPrompt(document);
    const lower = prompt.toLowerCase();

    expect(lower).toMatch(/y[^\n]{0,40}up/);
    expect(lower).toMatch(/degree/);
    expect(lower).toMatch(/3d[^\n]{0,80}(height|y[^\n]{0,20}height|height[^\n]{0,20}y)/);
    expect(prompt).toMatch(/version[^0-9]*1/);
    expect(prompt).toContain("voxel");
    expect(prompt).toContain("voxel-1");
    expect(prompt).toMatch(/S\s*=/);
    expect(prompt).toContain("2");
    expect(prompt).toContain("-1");
  });

  test("lists bow as bow and includes 2d primitive fields", () => {
    const document = parsed("2d", twoDPrimitives);
    const prompt = documentToPrompt(document);

    expect(prompt).toContain("bow");
    expect(prompt).toContain("bow-1");
    expect(prompt).toContain("line-1");
    expect(prompt).toContain("label-1");
    expect(prompt).toContain("45");
    expect(prompt).toContain("135");
  });

  test("lists circle sector arc ring ellipse and label when present", () => {
    const document = parsed("2d", [
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
        fill: "hatch",
      },
      {
        id: "arc-1",
        type: "arc",
        cx: 1,
        cy: 1,
        r: 3,
        startDeg: 10,
        endDeg: 40,
      },
      {
        id: "ring-1",
        type: "ring",
        cx: 0,
        cy: 0,
        rInner: 1,
        rOuter: 3,
        fill: "none",
      },
      {
        id: "ellipse-1",
        type: "ellipse",
        cx: 2,
        cy: 3,
        rx: 4,
        ry: 1,
        fill: "solid",
      },
      {
        id: "label-1",
        type: "label",
        x: 5,
        y: 6,
        text: "A",
      },
    ]);
    const prompt = documentToPrompt(document);
    for (const token of [
      "circle-1",
      "sector-1",
      "arc-1",
      "ring-1",
      "ellipse-1",
      "label-1",
      '"type":"circle"',
      '"type":"sector"',
      '"type":"arc"',
      '"type":"ring"',
      '"type":"ellipse"',
      '"type":"label"',
    ]) {
      expect(prompt).toContain(token);
    }
  });

  test("documents ellipse rotationDeg in the syntax and projects it deterministically", () => {
    const ellipse = {
      id: "ellipse-1",
      type: "ellipse",
      cx: 2,
      cy: 3,
      rx: 4,
      ry: 1,
      rotationDeg: 30,
      fill: "solid",
    };
    const document = parsed("2d", [ellipse]);

    const prompt = documentToPrompt(document);

    expect(prompt).toMatch(/ellipse:.*rotationDeg/);
    expect(prompt).toContain("30");
    expect(documentToPrompt(document)).toBe(prompt);
  });

  test("omits underlay urls, local file paths, and image pixels", () => {
    const document = parsed("2d", twoDPrimitives, {
      url: "https://example.com/problem.png",
      opacity: 0.4,
      x: 1,
      y: -2,
      scale: 1.5,
    });
    const prompt = documentToPrompt(document);

    expect(prompt).not.toContain("https://example.com/problem.png");
    expect(prompt).not.toContain("example.com");
    expect(prompt.toLowerCase()).not.toContain("underlay");
    expect(prompt).not.toMatch(/file:\/\//i);
    expect(prompt).not.toMatch(/\/tmp\/|c:\\/i);
    expect(prompt).not.toMatch(/data:image/i);
    expect(prompt).not.toMatch(/base64/i);
    expect(prompt).not.toContain("problem.png");
  });
});
