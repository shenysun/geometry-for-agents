import { describe, expect, test } from "vitest";
import { parseDocument, type GeometryDocument } from "../document/index.ts";
import {
  commitBox,
  commitCone,
  commitCylinder,
  commitSolid,
  commitSphere,
  commitPyramid,
  commitTriangularPrism,
  equilateralTriangleBase,
  isSolidTool,
  solidAnchorFromWorld,
} from "./solid-commit.ts";

function empty3d(): GeometryDocument {
  const parsed = parseDocument({
    version: 1,
    space: "3d",
    underlay: null,
    primitives: [],
  });
  if (!parsed.success) {
    throw new Error(parsed.error);
  }
  return parsed.document;
}

describe("commitBox", () => {
  test("单击落点吸附整格后提交默认 1×1×1、三欧拉角为 0 的长方体", () => {
    const commit = commitBox(empty3d(), { x: 1.4, y: 0, z: 0.6 }, 1, "box-1");

    expect(commit).toEqual({
      id: "box-1",
      type: "box",
      x: 1,
      y: 0,
      z: 1,
      width: 1,
      depth: 1,
      height: 1,
      rotationDegY: 0,
      rotationDegX: 0,
      rotationDegZ: 0,
    });
  });

  test("位置是底面中心：y 取吸附后的底面高度", () => {
    const commit = commitBox(empty3d(), { x: 0.2, y: 1.3, z: 0 }, 1, "box-1");

    expect(commit).not.toBeNull();
    if (commit === null) return;
    expect(commit.y).toBe(1);
  });

  test("吃当前格：1/2 格吸附到半格点，关则原样落点", () => {
    const half = commitBox(
      empty3d(),
      { x: 0.3, y: 0.2, z: 0.7 },
      0.5,
      "box-half",
    );
    expect(half).toMatchObject({ x: 0.5, y: 0, z: 0.5 });

    const free = commitBox(empty3d(), { x: 0.3, y: 0.2, z: 0.7 }, "off", "box-free");
    expect(free).toMatchObject({ x: 0.3, y: 0.2, z: 0.7 });
  });

  test("提交结果能直接通过契约解析，且与体素共存于同一份 3D 说明书", () => {
    const commit = commitBox(empty3d(), { x: 0.2, y: 0, z: 0.1 }, 1, "box-1");
    expect(commit).not.toBeNull();
    if (commit === null) return;

    const parsed = parseDocument({
      version: 1,
      space: "3d",
      underlay: null,
      primitives: [commit, { id: "voxel-1", type: "voxel", x: 0, y: 0, z: 0 }],
    });
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect(parsed.document.primitives.map((p) => p.type)).toEqual([
      "box",
      "voxel",
    ]);
  });

  test("refuses to commit a box into a 2d 说明书", () => {
    const parsed = parseDocument({
      version: 1,
      space: "2d",
      underlay: null,
      primitives: [],
    });
    if (!parsed.success) {
      throw new Error(parsed.error);
    }

    expect(commitBox(parsed.document, { x: 0, y: 0, z: 0 }, 1, "box-1")).toBeNull();
  });

  test("solidAnchorFromWorld 就是吸附后的底面中心", () => {
    expect(solidAnchorFromWorld({ x: 1.4, y: 0.2, z: -0.6 }, 1)).toEqual({
      x: 1,
      y: 0,
      z: -1,
    });
  });
});

describe("commitCylinder", () => {
  test("单击落点吸附整格后提交默认 r=0.5、height=1、三欧拉角为 0 的圆柱", () => {
    const commit = commitCylinder(
      empty3d(),
      { x: 1.4, y: 0, z: 0.6 },
      1,
      "cylinder-1",
    );

    expect(commit).toEqual({
      id: "cylinder-1",
      type: "cylinder",
      x: 1,
      y: 0,
      z: 1,
      r: 0.5,
      height: 1,
      rotationDegY: 0,
      rotationDegX: 0,
      rotationDegZ: 0,
    });
  });

  test("位置是底面中心：y 取吸附后的底面高度", () => {
    const commit = commitCylinder(
      empty3d(),
      { x: 0.2, y: 1.3, z: 0 },
      1,
      "cylinder-1",
    );

    expect(commit).not.toBeNull();
    if (commit === null) return;
    expect(commit.y).toBe(1);
  });

  test("吃当前格：1/2 格吸附到半格点，关则原样落点", () => {
    const half = commitCylinder(
      empty3d(),
      { x: 0.3, y: 0.2, z: 0.7 },
      0.5,
      "cylinder-half",
    );
    expect(half).toMatchObject({ x: 0.5, y: 0, z: 0.5 });

    const free = commitCylinder(
      empty3d(),
      { x: 0.3, y: 0.2, z: 0.7 },
      "off",
      "cylinder-free",
    );
    expect(free).toMatchObject({ x: 0.3, y: 0.2, z: 0.7 });
  });

  test("拒绝写进 2D 说明书", () => {
    const parsed = parseDocument({
      version: 1,
      space: "2d",
      underlay: null,
      primitives: [],
    });
    if (!parsed.success) throw new Error(parsed.error);

    expect(
      commitCylinder(parsed.document, { x: 0, y: 0, z: 0 }, 1, "cylinder-1"),
    ).toBeNull();
  });
});

describe("commitCone", () => {
  test("提交默认 r=0.5、height=1 的圆锥，字段与圆柱同构只是 type 不同", () => {
    const commit = commitCone(
      empty3d(),
      { x: 0.4, y: 0, z: -0.6 },
      1,
      "cone-1",
    );

    expect(commit).toEqual({
      id: "cone-1",
      type: "cone",
      x: 0,
      y: 0,
      z: -1,
      r: 0.5,
      height: 1,
      rotationDegY: 0,
      rotationDegX: 0,
      rotationDegZ: 0,
    });
  });
});

describe("commitSphere", () => {
  test("提交默认 r=0.5 的球：位置是球心且没有旋转字段", () => {
    const commit = commitSphere(
      empty3d(),
      { x: 1.4, y: 0.2, z: 0.6 },
      1,
      "sphere-1",
    );

    expect(commit).toEqual({
      id: "sphere-1",
      type: "sphere",
      x: 1,
      y: 0,
      z: 1,
      r: 0.5,
    });
  });

  test("球心吃吸附后的落点，同样吃 1/2 格与关", () => {
    const half = commitSphere(
      empty3d(),
      { x: 0.3, y: 0.2, z: 0.7 },
      0.5,
      "sphere-half",
    );
    expect(half).toMatchObject({ x: 0.5, y: 0, z: 0.5 });

    const free = commitSphere(
      empty3d(),
      { x: 0.3, y: 0.2, z: 0.7 },
      "off",
      "sphere-free",
    );
    expect(free).toMatchObject({ x: 0.3, y: 0.2, z: 0.7 });
  });

  test("拒绝写进 2D 说明书", () => {
    const parsed = parseDocument({
      version: 1,
      space: "2d",
      underlay: null,
      primitives: [],
    });
    if (!parsed.success) throw new Error(parsed.error);

    expect(
      commitSphere(parsed.document, { x: 0, y: 0, z: 0 }, 1, "sphere-1"),
    ).toBeNull();
  });
});

describe("commitSolid 按工具分发", () => {
  test("各参数体工具分发到对应提交", () => {
    const document = empty3d();
    const box = commitSolid(document, "box", { x: 0, y: 0, z: 0 }, 1, "p-box");
    const cylinder = commitSolid(
      document,
      "cylinder",
      { x: 0, y: 0, z: 0 },
      1,
      "p-cylinder",
    );
    const cone = commitSolid(
      document,
      "cone",
      { x: 0, y: 0, z: 0 },
      1,
      "p-cone",
    );
    const sphere = commitSolid(
      document,
      "sphere",
      { x: 0, y: 0, z: 0 },
      1,
      "p-sphere",
    );
    const pyramid = commitSolid(
      document,
      "pyramid",
      { x: 0, y: 0, z: 0 },
      1,
      "p-pyramid",
    );
    const prism = commitSolid(
      document,
      "triangularPrism",
      { x: 0, y: 0, z: 0 },
      1,
      "p-prism",
    );

    expect(box?.type).toBe("box");
    expect(cylinder?.type).toBe("cylinder");
    expect(cone?.type).toBe("cone");
    expect(sphere?.type).toBe("sphere");
    expect(pyramid?.type).toBe("pyramid");
    expect(prism?.type).toBe("triangularPrism");
  });

  test("提交结果与体素共存于同一份 3D 说明书且能通过契约解析", () => {
    const cylinder = commitSolid(
      empty3d(),
      "cylinder",
      { x: 0.2, y: 0, z: 0.1 },
      1,
      "cylinder-1",
    );
    const sphere = commitSolid(
      empty3d(),
      "sphere",
      { x: 0.2, y: 0, z: 0.1 },
      1,
      "sphere-1",
    );
    expect(cylinder).not.toBeNull();
    expect(sphere).not.toBeNull();
    if (cylinder === null || sphere === null) return;

    const parsed = parseDocument({
      version: 1,
      space: "3d",
      underlay: null,
      primitives: [
        cylinder,
        sphere,
        { id: "voxel-1", type: "voxel", x: 0, y: 0, z: 0 },
      ],
    });
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect(parsed.document.primitives.map((p) => p.type)).toEqual([
      "cylinder",
      "sphere",
      "voxel",
    ]);
  });

  test("isSolidTool 只认参数体工具，不认选择/体素/2D 工具", () => {
    expect(isSolidTool("box")).toBe(true);
    expect(isSolidTool("cylinder")).toBe(true);
    expect(isSolidTool("cone")).toBe(true);
    expect(isSolidTool("sphere")).toBe(true);
    expect(isSolidTool("pyramid")).toBe(true);
    expect(isSolidTool("triangularPrism")).toBe(true);
    expect(isSolidTool("voxel")).toBe(false);
    expect(isSolidTool("select")).toBe(false);
    expect(isSolidTool("circle")).toBe(false);
    expect(isSolidTool(null)).toBe(false);
  });
});

describe("commitPyramid", () => {
  test("单击落点吸附整格后提交默认底 1×1、高 1 的正方形底四棱锥", () => {
    const commit = commitPyramid(
      empty3d(),
      { x: 1.4, y: 0, z: 0.6 },
      1,
      "pyramid-1",
    );

    expect(commit).toEqual({
      id: "pyramid-1",
      type: "pyramid",
      x: 1,
      y: 0,
      z: 1,
      width: 1,
      depth: 1,
      height: 1,
      rotationDegY: 0,
      rotationDegX: 0,
      rotationDegZ: 0,
    });
  });

  test("位置是底面中心：y 取吸附后的底面高度", () => {
    const commit = commitPyramid(
      empty3d(),
      { x: 0.2, y: 1.3, z: 0 },
      1,
      "pyramid-1",
    );

    expect(commit).not.toBeNull();
    if (commit === null) return;
    expect(commit.y).toBe(1);
  });

  test("拒绝写进 2D 说明书", () => {
    const parsed = parseDocument({
      version: 1,
      space: "2d",
      underlay: null,
      primitives: [],
    });
    if (!parsed.success) throw new Error(parsed.error);

    expect(
      commitPyramid(parsed.document, { x: 0, y: 0, z: 0 }, 1, "pyramid-1"),
    ).toBeNull();
  });
});

describe("commitTriangularPrism", () => {
  test("提交默认高 1、底为边长 1 正三角、形心在局部原点的三棱柱", () => {
    const commit = commitTriangularPrism(
      empty3d(),
      { x: 1.4, y: 0, z: 0.6 },
      1,
      "prism-1",
    );

    expect(commit).toEqual({
      id: "prism-1",
      type: "triangularPrism",
      x: 1,
      y: 0,
      z: 1,
      height: 1,
      base: [
        { x: 0, z: Math.sqrt(3) / 3 },
        { x: -0.5, z: -Math.sqrt(3) / 6 },
        { x: 0.5, z: -Math.sqrt(3) / 6 },
      ],
      rotationDegY: 0,
      rotationDegX: 0,
      rotationDegZ: 0,
    });
  });

  test("默认底三角形按几何精确：三边长都是 1、形心在原点", () => {
    const base = equilateralTriangleBase();

    const side = (a: { x: number; z: number }, b: { x: number; z: number }) =>
      Math.hypot(a.x - b.x, a.z - b.z);
    expect(side(base[0], base[1])).toBeCloseTo(1, 12);
    expect(side(base[1], base[2])).toBeCloseTo(1, 12);
    expect(side(base[2], base[0])).toBeCloseTo(1, 12);

    const centroid = {
      x: (base[0].x + base[1].x + base[2].x) / 3,
      z: (base[0].z + base[1].z + base[2].z) / 3,
    };
    expect(centroid.x).toBe(0);
    expect(centroid.z).toBe(0);
  });

  test("吃当前格：1/2 格吸附到半格点，关则原样落点", () => {
    const half = commitTriangularPrism(
      empty3d(),
      { x: 0.3, y: 0.2, z: 0.7 },
      0.5,
      "prism-half",
    );
    expect(half).toMatchObject({ x: 0.5, y: 0, z: 0.5 });

    const free = commitTriangularPrism(
      empty3d(),
      { x: 0.3, y: 0.2, z: 0.7 },
      "off",
      "prism-free",
    );
    expect(free).toMatchObject({ x: 0.3, y: 0.2, z: 0.7 });
  });

  test("提交结果与体素、长方体共存且能通过契约解析", () => {
    const prism = commitTriangularPrism(
      empty3d(),
      { x: 0.2, y: 0, z: 0.1 },
      1,
      "prism-1",
    );
    expect(prism).not.toBeNull();
    if (prism === null) return;

    const parsed = parseDocument({
      version: 1,
      space: "3d",
      underlay: null,
      primitives: [
        prism,
        { id: "voxel-1", type: "voxel", x: 0, y: 0, z: 0 },
        {
          id: "box-1",
          type: "box",
          x: 0,
          y: 0,
          z: 0,
          width: 1,
          depth: 1,
          height: 1,
          rotationDegY: 0,
          rotationDegX: 0,
          rotationDegZ: 0,
        },
      ],
    });
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect(parsed.document.primitives.map((p) => p.type)).toEqual([
      "triangularPrism",
      "voxel",
      "box",
    ]);
  });

  test("拒绝写进 2D 说明书", () => {
    const parsed = parseDocument({
      version: 1,
      space: "2d",
      underlay: null,
      primitives: [],
    });
    if (!parsed.success) throw new Error(parsed.error);

    expect(
      commitTriangularPrism(parsed.document, { x: 0, y: 0, z: 0 }, 1, "prism-1"),
    ).toBeNull();
  });
});
