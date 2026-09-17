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

  test("documents the rectangle syntax with center anchor and rotationDeg and projects it deterministically", () => {
    const rectangle = {
      id: "rect-1",
      type: "rectangle",
      x: 2,
      y: 3,
      width: 4,
      height: 1,
      rotationDeg: 30,
      fill: "solid",
    };
    const document = parsed("2d", [rectangle]);

    const prompt = documentToPrompt(document);

    // 语法行写明锚点（中心）与全部字段（沿椭圆写法）
    expect(prompt).toMatch(/rectangle:.*center/);
    expect(prompt).toMatch(/rectangle:.*width \(X\), height \(Y\)/);
    expect(prompt).toMatch(/rectangle:.*rotationDeg/);
    // 投影含该矩形且两次生成相等
    expect(prompt).toContain("rect-1");
    expect(prompt).toContain("30");
    expect(documentToPrompt(document)).toBe(prompt);
  });

  test("documents the base-height family syntax with base-midpoint anchors and rotationDeg", () => {
    const family = [
      {
        id: "tri-1",
        type: "triangle",
        x: 2,
        y: 3,
        width: 4,
        height: 1,
        apexOffset: 0.5,
        rotationDeg: 30,
        fill: "solid",
      },
      {
        id: "para-1",
        type: "parallelogram",
        x: 2,
        y: 3,
        width: 4,
        height: 1,
        skew: 1,
        rotationDeg: 0,
        fill: "none",
      },
      {
        id: "trap-1",
        type: "trapezoid",
        x: 2,
        y: 3,
        width: 4,
        topWidth: 2,
        height: 1,
        topOffset: -0.5,
        rotationDeg: 0,
        fill: "hatch",
      },
    ];
    const document = parsed("2d", family);

    const prompt = documentToPrompt(document);

    // 语法行写明锚点（底边中点）与家族特有字段（沿椭圆/矩形写法）
    expect(prompt).toMatch(/triangle:.*base midpoint/);
    expect(prompt).toMatch(/triangle:.*apexOffset/);
    expect(prompt).toMatch(/parallelogram:.*base midpoint/);
    expect(prompt).toMatch(/parallelogram:.*skew/);
    expect(prompt).toMatch(/trapezoid:.*bottom-base midpoint/);
    expect(prompt).toMatch(/trapezoid:.*topWidth/);
    // 投影含家族成员且两次生成相等
    for (const primitive of family) {
      expect(prompt).toContain(primitive.id);
    }
    expect(documentToPrompt(document)).toBe(prompt);
  });

  test("documents the angle syntax with vertex anchor and equal side length", () => {
    const angle = {
      id: "angle-1",
      type: "angle",
      x: 2,
      y: 3,
      startDeg: 30,
      endDeg: 120,
      length: 4,
    };
    const document = parsed("2d", [angle]);

    const prompt = documentToPrompt(document);

    expect(prompt).toMatch(/angle:.*vertex/);
    expect(prompt).toMatch(/angle:.*startDeg, endDeg/);
    expect(prompt).toMatch(/angle:.*length/);
    expect(prompt).toContain("angle-1");
    expect(documentToPrompt(document)).toBe(prompt);
  });

  test("documents the angle showDeg half-sentence without projecting derived degrees", () => {
    const angle = {
      id: "angle-1",
      type: "angle",
      x: 0,
      y: 0,
      startDeg: 0,
      endDeg: 45,
      length: 4,
      showDeg: true,
    };
    const document = parsed("2d", [angle]);

    const prompt = documentToPrompt(document);

    // 语法行补「可显示推导度数」半句：Agent 知道度量语义存在。
    expect(prompt).toMatch(/angle:.*showDeg/);
    expect(prompt).toMatch(/angle:.*derived degree/);
    // 实例随图元 JSON 全量出现（布尔开关在内），推导数值不进投影。
    expect(prompt).toContain("showDeg");
    expect(prompt).not.toContain("45°");
  });

  test("documents the regular polygon syntax with circumcenter anchor and flat-bottom default", () => {
    const polygon = {
      id: "pent-1",
      type: "regularPolygon",
      x: 2,
      y: 3,
      sides: 5,
      r: 4,
      rotationDeg: 15,
      fill: "solid",
    };
    const document = parsed("2d", [polygon]);

    const prompt = documentToPrompt(document);

    expect(prompt).toMatch(/regularPolygon:.*circumcenter/);
    expect(prompt).toMatch(/regularPolygon:.*sides/);
    expect(prompt).toMatch(/regularPolygon:.*flat-bottom/);
    expect(documentToPrompt(document)).toBe(prompt);
  });

  test("documents the dimension syntax with derived length", () => {
    const dimension = {
      id: "dim-1",
      type: "dimension",
      points: [
        { x: 0, y: 0 },
        { x: 3, y: 4 },
      ],
    };
    const document = parsed("2d", [dimension]);

    const prompt = documentToPrompt(document);

    expect(prompt).toMatch(/dimension:.*exactly 2/);
    expect(prompt).toMatch(/dimension:.*distance/);
    expect(prompt).toMatch(/dimension:.*no text field/);
    expect(documentToPrompt(document)).toBe(prompt);
  });

  test("documents the box anchor and every field in the syntax and projects it deterministically", () => {
    const box = {
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
    const document = parsed("3d", [
      box,
      { id: "voxel-1", type: "voxel", x: 0, y: 2, z: -1 },
    ]);

    const prompt = documentToPrompt(document);

    // 语法行写明锚点（底面中心）与全部字段
    expect(prompt).toMatch(/box:.*bottom-face center/);
    expect(prompt).toMatch(/box:.*width.*depth.*height/);
    expect(prompt).toMatch(/box:.*rotationDegY.*rotationDegX.*rotationDegZ/);
    // 约定行写明高沿 +Y 与欧拉角合成顺序 Y→X→Z
    expect(prompt).toMatch(/\+Y/);
    expect(prompt).toContain("Y→X→Z");
    // 投影含该长方体且两次生成相等
    expect(prompt).toContain("box-1");
    expect(prompt).toContain("voxel-1");
    expect(prompt).toContain("30");
    expect(prompt).toContain("-10");
    expect(documentToPrompt(document)).toBe(prompt);
  });

  test("documents the cylinder, cone and sphere syntax and anchors and projects them deterministically", () => {
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
    ]);

    const prompt = documentToPrompt(document);

    // 语法行写明锚点（圆柱/圆锥底面中心、球球心）与全部字段
    expect(prompt).toMatch(/cylinder:.*bottom-face center/);
    expect(prompt).toMatch(/cylinder:.*r.*height/);
    expect(prompt).toMatch(/cylinder:.*rotationDegY, rotationDegX, rotationDegZ/);
    expect(prompt).toMatch(/cone:.*bottom-face center/);
    expect(prompt).toMatch(/sphere:.*center/);
    // 球没有旋转字段，语法行不得给它列 rotationDeg
    expect(prompt).not.toMatch(/sphere:[^\n]*rotationDeg/);
    // 投影含三种图元且两次生成相等
    expect(prompt).toContain("cylinder-1");
    expect(prompt).toContain("cone-1");
    expect(prompt).toContain("sphere-1");
    expect(documentToPrompt(document)).toBe(prompt);
  });

  test("documents the pyramid and triangularPrism syntax and anchors and projects them deterministically", () => {
    const document = parsed("3d", [
      {
        id: "pyramid-1",
        type: "pyramid",
        x: 0,
        y: 0,
        z: 0,
        width: 2,
        depth: 1,
        height: 1.5,
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
        rotationDegX: 0,
        rotationDegZ: 90,
      },
    ]);

    const prompt = documentToPrompt(document);

    // 语法行写明锚点（底面中心/底面局部原点）与全部字段
    expect(prompt).toMatch(/pyramid:.*bottom-face center/);
    expect(prompt).toMatch(/pyramid:.*width \(X\), depth \(Z\), height \(Y\)/);
    expect(prompt).toMatch(
      /triangularPrism:.*bottom-face center x, y, z/,
    );
    expect(prompt).toMatch(/triangularPrism:.*height along \+Y/);
    expect(prompt).toMatch(/triangularPrism:.*3 local \{x,z\} points/);
    expect(prompt).toMatch(/triangularPrism:.*rotationDegY, rotationDegX, rotationDegZ/);
    // 投影含两种图元且两次生成相等
    expect(prompt).toContain("pyramid-1");
    expect(prompt).toContain("prism-1");
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

describe("documentToPrompt 度量标注（ADR 0020 引用式）", () => {
  test("documents the measure syntax as a source-id relation without projecting derived values", () => {
    // 单位圆：面积 3.14、周长 6.28——推导值若进投影必以这两串数字现形。
    const document = parsed("2d", [
      { id: "circle-1", type: "circle", cx: 0, cy: 0, r: 1, fill: "none" },
      { id: "area-1", type: "measure", sourceId: "circle-1", kind: "area" },
      {
        id: "perimeter-1",
        type: "measure",
        sourceId: "circle-1",
        kind: "perimeter",
      },
    ]);

    const prompt = documentToPrompt(document);

    // 语法行讲清引用语义：按 id 引用封闭源、种类二选一、数值渲染期推导不存储。
    expect(prompt).toMatch(/measure:.*sourceId.*kind/);
    expect(prompt).toMatch(/measure:.*area.*perimeter/);
    expect(prompt).toMatch(/measure:.*derived at render time/);
    // 实例随图元 JSON 全量自然出现（id 引用与 kind），推导数值不进投影。
    expect(prompt).toContain('"type":"measure"');
    expect(prompt).toContain('"sourceId":"circle-1"');
    expect(prompt).toContain('"kind":"area"');
    expect(prompt).toContain('"kind":"perimeter"');
    expect(prompt).not.toContain("3.14");
    expect(prompt).not.toContain("6.28");
    expect(documentToPrompt(document)).toBe(prompt);
  });
});

describe("documentToPrompt 重叠填充（ADR 0019 引用式）", () => {
  test("documents overlapFill as a source-id relation, no coordinates involved", () => {
    const document = parsed("2d", [
      { id: "circle-1", type: "circle", cx: 0, cy: 0, r: 2, fill: "none" },
      {
        id: "triangle-1",
        type: "triangle",
        x: 0,
        y: 0,
        width: 4,
        height: 3,
        apexOffset: 0,
        fill: "none",
      },
      {
        id: "fill-1",
        type: "overlapFill",
        sources: ["circle-1", "triangle-1"],
        fill: "hatch",
      },
    ]);

    const prompt = documentToPrompt(document);

    // 语法行讲清关系语义：交集、按 id 引用、可为空。
    expect(prompt).toMatch(
      /overlapFill:.*sources.*intersection/i,
    );
    // 投影是关系不是坐标：条目 JSON 里只有 id 引用与填充样式。
    expect(prompt).toContain('"type":"overlapFill"');
    expect(prompt).toContain('"sources":["circle-1","triangle-1"]');
    expect(documentToPrompt(document)).toBe(prompt);
  });
});
