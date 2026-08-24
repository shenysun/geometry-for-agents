import { describe, expect, test } from "vitest";
import {
  addPrimitive,
  parseDocument,
  removePrimitive,
  setUnderlay,
  updatePrimitive,
} from "./index.ts";
import type { GeometryDocument, Primitive } from "./index.ts";
import {
  rotatePrimitive,
  rotatePrimitiveGeometry,
  scalePrimitive,
  scalePrimitiveGeometry,
  translatePrimitive,
  translatePrimitiveGeometry,
  type TwoDPrimitive,
} from "./update-document.ts";

function expectCloseTo(actual: number, expected: number): void {
  expect(Math.abs(actual - expected)).toBeLessThan(1e-9);
}

function mustParse(input: unknown): GeometryDocument {
  const result = parseDocument(input);
  if (!result.success) {
    throw new Error(result.error);
  }
  return result.document;
}

const empty2d = (): GeometryDocument =>
  mustParse({ version: 1, space: "2d", underlay: null, primitives: [] });

const circle = (id: string, r = 2): Primitive => ({
  id,
  type: "circle",
  cx: 0,
  cy: 0,
  r,
  fill: "solid",
});

const bow = (id: string): Primitive => ({
  id,
  type: "bow",
  cx: 1,
  cy: 1,
  r: 3,
  startDeg: 45,
  endDeg: 135,
  fill: "hatch",
});

describe("addPrimitive", () => {
  test("returns a new document and leaves the original unchanged", () => {
    const original = empty2d();
    const snapshot = structuredClone(original);
    const primitive = circle("circle-1");

    const result = addPrimitive(original, primitive);

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.document).not.toBe(original);
    expect(result.document.primitives).not.toBe(original.primitives);
    expect(original).toEqual(snapshot);
    expect(original.primitives).toEqual([]);
    expect(result.document.primitives).toEqual([primitive]);
  });

  test("does not let later mutation of the returned document change the original", () => {
    const original = mustParse({
      version: 1,
      space: "2d",
      underlay: null,
      primitives: [circle("circle-1")],
    });
    const snapshot = structuredClone(original);
    const result = addPrimitive(original, bow("bow-1"));
    expect(result.success).toBe(true);
    if (!result.success) return;

    result.document.primitives.length = 0;

    expect(original).toEqual(snapshot);
    expect(original.primitives).toHaveLength(1);
  });
});

describe("removePrimitive", () => {
  test("returns a new document without the primitive and leaves the original unchanged", () => {
    const keep = circle("keep");
    const gone = bow("gone");
    const original = mustParse({
      version: 1,
      space: "2d",
      underlay: null,
      primitives: [keep, gone],
    });
    const snapshot = structuredClone(original);

    const result = removePrimitive(original, "gone");

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.document).not.toBe(original);
    expect(result.document.primitives).not.toBe(original.primitives);
    expect(original).toEqual(snapshot);
    expect(result.document.primitives).toEqual([keep]);
  });
});

describe("updatePrimitive", () => {
  test("returns a new document with updated properties and leaves the original unchanged", () => {
    const originalPrimitive = circle("circle-1", 2);
    const original = mustParse({
      version: 1,
      space: "2d",
      underlay: null,
      primitives: [originalPrimitive],
    });
    const snapshot = structuredClone(original);
    const updated = circle("circle-1", 5);

    const result = updatePrimitive(original, "circle-1", updated);

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.document).not.toBe(original);
    expect(result.document.primitives).not.toBe(original.primitives);
    expect(original).toEqual(snapshot);
    expect(original.primitives[0]).toEqual(originalPrimitive);
    expect(result.document.primitives).toEqual([updated]);
  });
});

describe("translatePrimitiveGeometry", () => {
  test("moves every line point and keeps the id", () => {
    const line: Primitive = {
      id: "line-1",
      type: "line",
      points: [
        { x: 0, y: 0 },
        { x: 2, y: 1 },
      ],
    };

    const moved = translatePrimitiveGeometry(line, 1, 2);

    expect(moved).toEqual({
      id: "line-1",
      type: "line",
      points: [
        { x: 1, y: 2 },
        { x: 3, y: 3 },
      ],
    });
    expect(line.points[0]).toEqual({ x: 0, y: 0 });
  });

  test("moves a sweep center keeping r and angles", () => {
    const sector: Primitive = {
      id: "sector-1",
      type: "sector",
      cx: 1,
      cy: -1,
      r: 3,
      startDeg: 45,
      endDeg: 135,
      fill: "hatch",
    };

    const moved = translatePrimitiveGeometry(sector, -1, 1);

    expect(moved).toEqual({
      id: "sector-1",
      type: "sector",
      cx: 0,
      cy: 0,
      r: 3,
      startDeg: 45,
      endDeg: 135,
      fill: "hatch",
    });
  });

  test("moves polygon points keeping fill, and label x y keeping text", () => {
    const polygon: Primitive = {
      id: "poly-1",
      type: "polygon",
      points: [
        { x: 0, y: 0 },
        { x: 1, y: 0 },
        { x: 0, y: 1 },
      ],
      fill: "solid",
    };
    expect(translatePrimitiveGeometry(polygon, 2, 3)).toEqual({
      id: "poly-1",
      type: "polygon",
      points: [
        { x: 2, y: 3 },
        { x: 3, y: 3 },
        { x: 2, y: 4 },
      ],
      fill: "solid",
    });

    const label: Primitive = { id: "label-1", type: "label", x: 0, y: 0, text: "A" };
    expect(translatePrimitiveGeometry(label, 1, 1)).toEqual({
      id: "label-1",
      type: "label",
      x: 1,
      y: 1,
      text: "A",
    });
  });
});

describe("translatePrimitive", () => {
  const lineDoc = () =>
    mustParse({
      version: 1,
      space: "2d",
      underlay: null,
      primitives: [
        {
          id: "line-1",
          type: "line",
          points: [
            { x: 0, y: 0 },
            { x: 2, y: 1 },
          ],
        },
        { id: "circle-1", type: "circle", cx: 5, cy: 0, r: 1, fill: "none" },
      ],
    });

  test("把吸附后的世界位移写进几何字段并保持原说明书不变", () => {
    const original = lineDoc();
    const snapshot = structuredClone(original);

    const result = translatePrimitive(original, "line-1", 0.4, 1.6, 1);

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.document.primitives[0]).toEqual({
      id: "line-1",
      type: "line",
      points: [
        { x: 0, y: 2 },
        { x: 2, y: 3 },
      ],
    });
    expect(result.document.primitives[1]).toEqual(
      original.primitives[1],
    );
    expect(original).toEqual(snapshot);
  });

  test("半格与关：位移分别落半格与保留原始值", () => {
    const original = lineDoc();

    const half = translatePrimitive(original, "circle-1", 0.3, 0.1, 0.5);
    expect(half.success).toBe(true);
    if (!half.success) return;
    expect(half.document.primitives[1]).toEqual({
      id: "circle-1",
      type: "circle",
      cx: 5.5,
      cy: 0,
      r: 1,
      fill: "none",
    });

    const off = translatePrimitive(original, "circle-1", 0.3, 0.1, "off");
    expect(off.success).toBe(true);
    if (!off.success) return;
    expect(off.document.primitives[1]).toEqual({
      id: "circle-1",
      type: "circle",
      cx: 5.3,
      cy: 0.1,
      r: 1,
      fill: "none",
    });
  });

  test("零位移返回原文档相等的说明书且不产生变化", () => {
    const original = lineDoc();
    const result = translatePrimitive(original, "circle-1", 0.4, -0.4, 1);
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.document).toEqual(original);
  });

  test("id 不存在时报错", () => {
    const result = translatePrimitive(lineDoc(), "ghost", 1, 1, 1);
    expect(result.success).toBe(false);
  });

  test("3D 体素说明书拒绝平移（体素整格平移另有序号）", () => {
    const voxelDoc = mustParse({
      version: 1,
      space: "3d",
      underlay: null,
      primitives: [{ id: "vox-1", type: "voxel", x: 0, y: 0, z: 0 }],
    });
    const result = translatePrimitive(voxelDoc, "vox-1", 1, 0, 1);
    expect(result.success).toBe(false);
  });

  test("平移后的说明书仍能通过契约解析", () => {
    const result = translatePrimitive(lineDoc(), "line-1", 2, -1, 1);
    expect(result.success).toBe(true);
    if (!result.success) return;
    const parsed = parseDocument(JSON.stringify(result.document));
    expect(parsed.success).toBe(true);
  });
});

describe("rotatePrimitiveGeometry", () => {
  test("折线绕顶点质心旋转，id 不变、原对象不动", () => {
    const line: TwoDPrimitive = {
      id: "line-1",
      type: "line",
      points: [
        { x: 0, y: 0 },
        { x: 2, y: 0 },
      ],
    };

    // 质心 (1,0)，逆时针 90°：(0,0)→(1,-1)，(2,0)→(1,1)
    const moved = rotatePrimitiveGeometry(line, 90);

    expect(moved.id).toBe("line-1");
    expect(moved.type).toBe("line");
    if (moved.type !== "line") return;
    expect(moved.points).toHaveLength(2);
    expectCloseTo(moved.points[0].x, 1);
    expectCloseTo(moved.points[0].y, -1);
    expectCloseTo(moved.points[1].x, 1);
    expectCloseTo(moved.points[1].y, 1);
    expect(line.points[0]).toEqual({ x: 0, y: 0 });
  });

  test("椭圆旋转写 rotationDeg 并归一化到 [0,360)", () => {
    const ellipse = (rotationDeg: number): TwoDPrimitive => ({
      id: "ellipse-1",
      type: "ellipse",
      cx: 0,
      cy: 0,
      rx: 2,
      ry: 1,
      rotationDeg,
      fill: "none",
    });

    const quarter = rotatePrimitiveGeometry(ellipse(0), 90);
    const wrap = rotatePrimitiveGeometry(ellipse(270), 90);
    const back = rotatePrimitiveGeometry(ellipse(30), -60);

    if (quarter.type !== "ellipse") return;
    if (wrap.type !== "ellipse") return;
    if (back.type !== "ellipse") return;
    expect(quarter.rotationDeg).toBe(90);
    expect(wrap.rotationDeg).toBe(0);
    expect(back.rotationDeg).toBe(330);
    expect(quarter.cx).toBe(0);
    expect(quarter.rx).toBe(2);
  });

  test("扇形旋转写起止角，圆心与半径不变", () => {
    const sector: Primitive = {
      id: "sector-1",
      type: "sector",
      cx: 1,
      cy: -1,
      r: 3,
      startDeg: 45,
      endDeg: 135,
      fill: "hatch",
    };

    const moved = rotatePrimitiveGeometry(sector, 90);

    if (moved.type !== "sector") return;
    expect(moved.cx).toBe(1);
    expect(moved.cy).toBe(-1);
    expect(moved.r).toBe(3);
    expect(moved.startDeg).toBe(135);
    expect(moved.endDeg).toBe(225);
    expect(moved.fill).toBe("hatch");
  });

  test("圆、环、标签旋转是恒等（旋转对称或无角度字段）", () => {
    const circlePrimitive: TwoDPrimitive = {
      id: "circle-1",
      type: "circle",
      cx: 0,
      cy: 0,
      r: 2,
      fill: "solid",
    };
    const ring: TwoDPrimitive = {
      id: "ring-1",
      type: "ring",
      cx: 0,
      cy: 0,
      rInner: 1,
      rOuter: 3,
      fill: "solid",
    };
    const label: TwoDPrimitive = {
      id: "label-1",
      type: "label",
      x: 1,
      y: 1,
      text: "A",
    };

    expect(rotatePrimitiveGeometry(circlePrimitive, 90)).toEqual(circlePrimitive);
    expect(rotatePrimitiveGeometry(ring, 37)).toEqual(ring);
    expect(rotatePrimitiveGeometry(label, 90)).toEqual(label);
  });
});

describe("scalePrimitiveGeometry", () => {
  test("圆等比缩放：半径乘因子、圆心不变", () => {
    const circlePrimitive: TwoDPrimitive = {
      id: "circle-1",
      type: "circle",
      cx: 0,
      cy: 0,
      r: 2,
      fill: "solid",
    };
    const moved = scalePrimitiveGeometry(circlePrimitive, 1.5);

    if (moved.type !== "circle") return;
    expect(moved.r).toBe(3);
    expect(moved.cx).toBe(0);
    expect(moved.cy).toBe(0);
  });

  test("椭圆 rx ry 同乘保持形状，rotationDeg 跟着保留", () => {
    const ellipse: TwoDPrimitive = {
      id: "ellipse-1",
      type: "ellipse",
      cx: 0,
      cy: 0,
      rx: 2,
      ry: 1,
      rotationDeg: 30,
      fill: "none",
    };

    const moved = scalePrimitiveGeometry(ellipse, 2);

    if (moved.type !== "ellipse") return;
    expect(moved.rx).toBe(4);
    expect(moved.ry).toBe(2);
    expect(moved.rotationDeg).toBe(30);
  });

  test("折线与多边形绕质心缩放", () => {
    const line: Primitive = {
      id: "line-1",
      type: "line",
      points: [
        { x: 0, y: 0 },
        { x: 2, y: 0 },
      ],
    };

    const moved = scalePrimitiveGeometry(line, 2);

    if (moved.type !== "line") return;
    expect(moved.points).toEqual([
      { x: -1, y: 0 },
      { x: 3, y: 0 },
    ]);
  });

  test("环两半径同乘保持 rInner < rOuter，扇形缩半径不动起止角", () => {
    const ring: Primitive = {
      id: "ring-1",
      type: "ring",
      cx: 0,
      cy: 0,
      rInner: 1,
      rOuter: 3,
      fill: "solid",
    };
    const sector: Primitive = {
      id: "sector-1",
      type: "sector",
      cx: 0,
      cy: 0,
      r: 4,
      startDeg: 10,
      endDeg: 80,
      fill: "none",
    };

    const ringMoved = scalePrimitiveGeometry(ring, 0.5);
    const sectorMoved = scalePrimitiveGeometry(sector, 0.5);

    if (ringMoved.type !== "ring") return;
    expect(ringMoved.rInner).toBe(0.5);
    expect(ringMoved.rOuter).toBe(1.5);
    if (sectorMoved.type !== "sector") return;
    expect(sectorMoved.r).toBe(2);
    expect(sectorMoved.startDeg).toBe(10);
    expect(sectorMoved.endDeg).toBe(80);
  });
});

describe("rotatePrimitive / scalePrimitive", () => {
  const docWithSector = () =>
    mustParse({
      version: 1,
      space: "2d",
      underlay: null,
      primitives: [
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
        { id: "circle-1", type: "circle", cx: 5, cy: 0, r: 1, fill: "none" },
      ],
    });

  test("rotatePrimitive 把起止角写进说明书，原图元与文档不变", () => {
    const original = docWithSector();
    const snapshot = structuredClone(original);

    const result = rotatePrimitive(original, "sector-1", 90);

    expect(result.success).toBe(true);
    if (!result.success) return;
    const sector = result.document.primitives[0];
    if (sector.type !== "sector") return;
    expect(sector.startDeg).toBe(90);
    expect(sector.endDeg).toBe(180);
    expect(result.document.primitives[1]).toEqual(original.primitives[1]);
    expect(original).toEqual(snapshot);
  });

  test("scalePrimitive 圆等比缩放后的说明书仍能通过契约解析", () => {
    const result = scalePrimitive(docWithSector(), "circle-1", 2.5);

    expect(result.success).toBe(true);
    if (!result.success) return;
    const circleMoved = result.document.primitives[1];
    if (circleMoved.type !== "circle") return;
    expect(circleMoved.r).toBe(2.5);
    const parsed = parseDocument(JSON.stringify(result.document));
    expect(parsed.success).toBe(true);
  });

  test("旋转圆是恒等变换，返回与原文档相等", () => {
    const original = docWithSector();
    const result = rotatePrimitive(original, "circle-1", 123);
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.document).toEqual(original);
  });

  test("非正缩放因子与缺失 id 报错，3D 说明书拒绝", () => {
    expect(scalePrimitive(docWithSector(), "circle-1", 0).success).toBe(false);
    expect(scalePrimitive(docWithSector(), "circle-1", -1).success).toBe(false);
    expect(rotatePrimitive(docWithSector(), "ghost", 90).success).toBe(false);

    const voxelDoc = mustParse({
      version: 1,
      space: "3d",
      underlay: null,
      primitives: [{ id: "vox-1", type: "voxel", x: 0, y: 0, z: 0 }],
    });
    expect(rotatePrimitive(voxelDoc, "vox-1", 90).success).toBe(false);
    expect(scalePrimitive(voxelDoc, "vox-1", 2).success).toBe(false);
  });
});

describe("setUnderlay", () => {
  test("writes https alignment immutably and roundtrips opacity x y scale", () => {
    const original = empty2d();
    const snapshot = structuredClone(original);
    const underlay = {
      url: "https://example.com/problem.png",
      opacity: 0.4,
      x: 1,
      y: -2,
      scale: 1.5,
    };

    const result = setUnderlay(original, underlay);

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.document).not.toBe(original);
    expect(original).toEqual(snapshot);
    expect(result.document.underlay).toEqual(underlay);

    const parsed = parseDocument(JSON.stringify(result.document));
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect(parsed.document.underlay).toEqual(underlay);
  });

  test("rejects a file URL so it cannot enter the 说明书", () => {
    const original = empty2d();
    const result = setUnderlay(original, {
      url: "file:///tmp/problem.png",
      opacity: 0.5,
      x: 0,
      y: 0,
      scale: 1,
    });

    expect(result.success).toBe(false);
    expect(original.underlay).toBeNull();
  });
});

describe("box 参数体更新", () => {
  const empty3d = (): GeometryDocument =>
    mustParse({ version: 1, space: "3d", underlay: null, primitives: [] });

  const box = {
    id: "box-1",
    type: "box" as const,
    x: 0,
    y: 0,
    z: 0,
    width: 1,
    depth: 1,
    height: 1,
    rotationDegY: 0,
    rotationDegX: 0,
    rotationDegZ: 0,
  };

  test("addPrimitive 把长方体写进 3D 说明书且仍能通过契约解析", () => {
    const original = empty3d();
    const result = addPrimitive(original, box);

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.document.primitives).toEqual([box]);
    expect(parseDocument(JSON.stringify(result.document)).success).toBe(true);
  });

  test("updatePrimitive 改尺寸与旋转不可变且仍能通过契约解析", () => {
    const original = mustParse({
      version: 1,
      space: "3d",
      underlay: null,
      primitives: [box],
    });
    const snapshot = structuredClone(original);

    const result = updatePrimitive(original, "box-1", {
      ...box,
      width: 4,
      height: 2,
      rotationDegY: 90,
    });

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(original).toEqual(snapshot);
    expect(result.document.primitives[0]).toEqual({
      ...box,
      width: 4,
      height: 2,
      rotationDegY: 90,
    });
    expect(parseDocument(JSON.stringify(result.document)).success).toBe(true);
  });

  test("2D 说明书拒绝写入长方体", () => {
    const result = addPrimitive(empty2d(), box);
    expect(result.success).toBe(false);
  });
});
