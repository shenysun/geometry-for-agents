import { describe, expect, test } from "vitest";
import {
  addPrimitive,
  commitSnapshot,
  createHistory,
  parseDocument,
  redo,
  removePrimitive,
  setUnderlay,
  undo,
  updatePrimitive,
} from "./index.ts";
import type { GeometryDocument, Primitive, Primitive2d } from "./index.ts";
import {
  addVertex,
  addVertexGeometry,
  moveControlPoint,
  moveControlPointGeometry,
  moveSolidControlPoint,
  moveSolidControlPointGeometry,
  removeVertex,
  removeVertexGeometry,
  rotateEulerYxz,
  rotatePrimitive,
  rotatePrimitiveGeometry,
  rotateSolid,
  rotateSolidGeometry,
  scalePrimitive,
  scalePrimitiveGeometry,
  scaleSolid,
  scaleSolidGeometry,
  translatePrimitive,
  translatePrimitiveGeometry,
  translateSolid,
  translateSolidGeometry,
  unrotateEulerYxz,
  type SolidPrimitive,
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

  test("角 showDeg 开关：勾选写入 true，取消勾选移除字段（老文档语义）", () => {
    const anglePrimitive = {
      id: "angle-1",
      type: "angle",
      x: 0,
      y: 0,
      startDeg: 0,
      endDeg: 90,
      length: 4,
    } as const;
    const base = mustParse({
      version: 1,
      space: "2d",
      underlay: null,
      primitives: [anglePrimitive],
    });

    const on = updatePrimitive(base, "angle-1", {
      ...anglePrimitive,
      showDeg: true,
    });
    expect(on.success).toBe(true);
    if (!on.success) return;
    expect(on.document.primitives[0]).toEqual({
      ...anglePrimitive,
      showDeg: true,
    });

    const off = updatePrimitive(on.document, "angle-1", anglePrimitive);
    expect(off.success).toBe(true);
    if (!off.success) return;
    expect(off.document.primitives[0]).toEqual(anglePrimitive);
  });

  test("角 showDeg 开关经更新管线写入历史，撤销/重做可逆", () => {
    const anglePrimitive: Primitive2d = {
      id: "angle-1",
      type: "angle",
      x: 0,
      y: 0,
      startDeg: 0,
      endDeg: 90,
      length: 4,
    };
    const base = mustParse({
      version: 1,
      space: "2d",
      underlay: null,
      primitives: [anglePrimitive],
    });

    let history = createHistory(base);
    const on = updatePrimitive(history.present, "angle-1", {
      ...anglePrimitive,
      showDeg: true,
    });
    expect(on.success).toBe(true);
    if (!on.success) return;
    history = commitSnapshot(history, on.document);
    const switched = history.present.primitives[0] as Extract<
      Primitive2d,
      { type: "angle" }
    >;
    expect(switched.showDeg).toBe(true);

    history = undo(history);
    const restored = history.present.primitives[0] as Extract<
      Primitive2d,
      { type: "angle" }
    >;
    expect(restored.showDeg).toBeUndefined();

    history = redo(history);
    const redone = history.present.primitives[0] as Extract<
      Primitive2d,
      { type: "angle" }
    >;
    expect(redone.showDeg).toBe(true);
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
    const line: Primitive2d = {
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
    const ellipse = (rotationDeg: number): Primitive2d => ({
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
    const circlePrimitive: Primitive2d = {
      id: "circle-1",
      type: "circle",
      cx: 0,
      cy: 0,
      r: 2,
      fill: "solid",
    };
    const ring: Primitive2d = {
      id: "ring-1",
      type: "ring",
      cx: 0,
      cy: 0,
      rInner: 1,
      rOuter: 3,
      fill: "solid",
    };
    const label: Primitive2d = {
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
    const circlePrimitive: Primitive2d = {
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
    const ellipse: Primitive2d = {
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

describe("moveControlPointGeometry", () => {
  test("拖端点只改那个端点，其余顶点原样", () => {
    const line: Primitive = {
      id: "line-1",
      type: "line",
      points: [
        { x: 0, y: 0 },
        { x: 4, y: 0 },
        { x: 8, y: 0 },
      ],
    };

    const moved = moveControlPointGeometry(line, "vertex-1", { x: 4, y: 3 });

    expect(moved).toEqual({
      id: "line-1",
      type: "line",
      points: [
        { x: 0, y: 0 },
        { x: 4, y: 3 },
        { x: 8, y: 0 },
      ],
    });
    expect(line.points[1]).toEqual({ x: 4, y: 0 });
  });

  test("拖半径点只改半径：圆心、起止角都不动，不是整圆缩放", () => {
    const sector: Primitive = {
      id: "sector-1",
      type: "sector",
      cx: 1,
      cy: -1,
      r: 2,
      startDeg: 45,
      endDeg: 135,
      fill: "hatch",
    };

    const moved = moveControlPointGeometry(sector, "radius", { x: 1, y: 4 });

    expect(moved).toEqual({
      id: "sector-1",
      type: "sector",
      cx: 1,
      cy: -1,
      r: 5,
      startDeg: 45,
      endDeg: 135,
      fill: "hatch",
    });
  });

  test("拖起止角点只改对应角度并归一化，半径不动", () => {
    const arc: Primitive = {
      id: "arc-1",
      type: "arc",
      cx: 0,
      cy: 0,
      r: 2,
      startDeg: 0,
      endDeg: 90,
    };

    const endMoved = moveControlPointGeometry(arc, "endDeg", { x: 0, y: -2 });
    const startMoved = moveControlPointGeometry(arc, "startDeg", { x: -2, y: 0 });

    if (endMoved.type !== "arc" || startMoved.type !== "arc") return;
    expect(endMoved).toEqual({
      id: "arc-1",
      type: "arc",
      cx: 0,
      cy: 0,
      r: 2,
      startDeg: 0,
      endDeg: 270,
    });
    expect(startMoved.startDeg).toBe(180);
    expect(startMoved.endDeg).toBe(90);
    expect(startMoved.r).toBe(2);
  });

  test("拖圆心只挪圆心，半径与角度原样", () => {
    const circle: Primitive = {
      id: "circle-1",
      type: "circle",
      cx: 0,
      cy: 0,
      r: 2,
      fill: "none",
    };

    const moved = moveControlPointGeometry(circle, "center", { x: 3, y: 4 });

    expect(moved).toEqual({
      id: "circle-1",
      type: "circle",
      cx: 3,
      cy: 4,
      r: 2,
      fill: "none",
    });
  });

  test("拖椭圆半轴点沿局部轴度量：改 rx 时 ry 与 rotationDeg 不动", () => {
    const ellipse: Primitive = {
      id: "ellipse-1",
      type: "ellipse",
      cx: 5,
      cy: 5,
      rx: 3,
      ry: 1,
      rotationDeg: 90,
      fill: "none",
    };

    // 长轴被转到 +Y：把 rx 点从 (5,8) 拖到 (5,10)，局部 x 距离为 5。
    const moved = moveControlPointGeometry(ellipse, "rx", { x: 5, y: 10 });

    if (moved.type !== "ellipse") return;
    expect(moved.rx).toBe(5);
    expect(moved.ry).toBe(1);
    expect(moved.rotationDeg).toBe(90);
    expect(moved.cx).toBe(5);
  });

  test("拖环的内外半径点各改各的半径", () => {
    const ring: Primitive = {
      id: "ring-1",
      type: "ring",
      cx: 0,
      cy: 0,
      rInner: 1,
      rOuter: 3,
      fill: "none",
    };

    const inner = moveControlPointGeometry(ring, "rInner", { x: 2, y: 0 });
    const outer = moveControlPointGeometry(ring, "rOuter", { x: 5, y: 0 });

    if (inner.type !== "ring" || outer.type !== "ring") return;
    expect(inner.rInner).toBe(2);
    expect(inner.rOuter).toBe(3);
    expect(outer.rOuter).toBe(5);
    expect(outer.rInner).toBe(1);
  });

  test("未知控制点 id 是恒等变换，原对象原样返回", () => {
    const circle: Primitive = {
      id: "circle-1",
      type: "circle",
      cx: 0,
      cy: 0,
      r: 2,
      fill: "none",
    };

    expect(moveControlPointGeometry(circle, "vertex-0", { x: 1, y: 1 })).toBe(
      circle,
    );
  });
});

describe("moveControlPoint", () => {
  const circleDoc = () =>
    mustParse({
      version: 1,
      space: "2d",
      underlay: null,
      primitives: [
        { id: "circle-1", type: "circle", cx: 0, cy: 0, r: 2, fill: "none" },
        {
          id: "line-1",
          type: "line",
          points: [
            { x: 0, y: 0 },
            { x: 4, y: 0 },
          ],
        },
      ],
    });

  test("把吸附后的目标点写进几何并保持原说明书不变", () => {
    const original = circleDoc();
    const snapshot = structuredClone(original);

    const result = moveControlPoint(original, "circle-1", "radius", {
      x: 0.4,
      y: 4.6,
    }, 1);

    expect(result.success).toBe(true);
    if (!result.success) return;
    const circleMoved = result.document.primitives[0];
    if (circleMoved.type !== "circle") return;
    expect(circleMoved.r).toBe(5);
    expect(circleMoved.cx).toBe(0);
    expect(result.document.primitives[1]).toEqual(original.primitives[1]);
    expect(original).toEqual(snapshot);
  });

  test("拖顶点写进对应下标且新说明书仍能通过契约解析", () => {
    const result = moveControlPoint(circleDoc(), "line-1", "vertex-1", {
      x: 5,
      y: 1,
    }, 1);

    expect(result.success).toBe(true);
    if (!result.success) return;
    const lineMoved = result.document.primitives[1];
    expect(lineMoved).toEqual({
      id: "line-1",
      type: "line",
      points: [
        { x: 0, y: 0 },
        { x: 5, y: 1 },
      ],
    });
    expect(parseDocument(JSON.stringify(result.document)).success).toBe(true);
  });

  test("半径拖成 0 被契约拒绝，不进说明书", () => {
    const result = moveControlPoint(circleDoc(), "circle-1", "radius", {
      x: 0,
      y: 0,
    }, "off");
    expect(result.success).toBe(false);
  });

  test("环内半径拖到不小于外半径被契约拒绝", () => {
    const ringDoc = mustParse({
      version: 1,
      space: "2d",
      underlay: null,
      primitives: [
        {
          id: "ring-1",
          type: "ring",
          cx: 0,
          cy: 0,
          rInner: 1,
          rOuter: 3,
          fill: "none",
        },
      ],
    });

    const tooBig = moveControlPoint(ringDoc, "ring-1", "rInner", {
      x: 3,
      y: 0,
    }, "off");
    expect(tooBig.success).toBe(false);

    const fine = moveControlPoint(ringDoc, "ring-1", "rInner", {
      x: 2,
      y: 0,
    }, "off");
    expect(fine.success).toBe(true);
  });

  test("吸附后与原控制点同位置返回相等说明书，缺失 id 与 3D 报错", () => {
    const original = circleDoc();

    const same = moveControlPoint(original, "circle-1", "center", {
      x: 0.4,
      y: -0.4,
    }, 1);
    expect(same.success).toBe(true);
    if (!same.success) return;
    expect(same.document).toEqual(original);

    expect(
      moveControlPoint(original, "ghost", "radius", { x: 1, y: 1 }, 1).success,
    ).toBe(false);

    const voxelDoc = mustParse({
      version: 1,
      space: "3d",
      underlay: null,
      primitives: [{ id: "vox-1", type: "voxel", x: 0, y: 0, z: 0 }],
    });
    expect(
      moveControlPoint(voxelDoc, "vox-1", "radius", { x: 1, y: 1 }, 1).success,
    ).toBe(false);
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

describe("圆柱圆锥球参数体更新", () => {
  const empty3d = (): GeometryDocument =>
    mustParse({ version: 1, space: "3d", underlay: null, primitives: [] });

  const cylinder = {
    id: "cylinder-1",
    type: "cylinder" as const,
    x: 0,
    y: 0,
    z: 0,
    r: 0.5,
    height: 1,
    rotationDegY: 0,
    rotationDegX: 0,
    rotationDegZ: 0,
  };

  const cone = {
    id: "cone-1",
    type: "cone" as const,
    x: 0,
    y: 0,
    z: 0,
    r: 0.5,
    height: 1,
    rotationDegY: 0,
    rotationDegX: 0,
    rotationDegZ: 0,
  };

  const sphere = {
    id: "sphere-1",
    type: "sphere" as const,
    x: 0,
    y: 0,
    z: 0,
    r: 0.5,
  };

  test("addPrimitive 写入三种图元且仍能通过契约解析", () => {
    const result = addPrimitive(empty3d(), cylinder);
    expect(result.success).toBe(true);
    if (!result.success) return;
    const withCone = addPrimitive(result.document, cone);
    expect(withCone.success).toBe(true);
    if (!withCone.success) return;
    const withSphere = addPrimitive(withCone.document, sphere);
    expect(withSphere.success).toBe(true);
    if (!withSphere.success) return;

    expect(withSphere.document.primitives.map((p) => p.type)).toEqual([
      "cylinder",
      "cone",
      "sphere",
    ]);
    expect(
      parseDocument(JSON.stringify(withSphere.document)).success,
    ).toBe(true);
  });

  test("updatePrimitive 改圆柱半径与欧拉角不可变且仍能通过契约解析", () => {
    const original = mustParse({
      version: 1,
      space: "3d",
      underlay: null,
      primitives: [cylinder],
    });
    const snapshot = structuredClone(original);

    const result = updatePrimitive(original, "cylinder-1", {
      ...cylinder,
      r: 2,
      rotationDegX: 45,
    });

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(original).toEqual(snapshot);
    expect(result.document.primitives[0]).toEqual({
      ...cylinder,
      r: 2,
      rotationDegX: 45,
    });
    expect(parseDocument(JSON.stringify(result.document)).success).toBe(true);
  });

  test("updatePrimitive 拒绝把球改出非法半径", () => {
    const original = mustParse({
      version: 1,
      space: "3d",
      underlay: null,
      primitives: [sphere],
    });

    const result = updatePrimitive(original, "sphere-1", {
      ...sphere,
      r: 0,
    });

    expect(result.success).toBe(false);
  });

  test("2D 说明书拒绝写入圆柱、圆锥与球", () => {
    expect(addPrimitive(empty2d(), cylinder).success).toBe(false);
    expect(addPrimitive(empty2d(), cone).success).toBe(false);
    expect(addPrimitive(empty2d(), sphere).success).toBe(false);
  });
});

describe("四棱锥与三棱柱参数体更新", () => {
  const empty3d = (): GeometryDocument =>
    mustParse({ version: 1, space: "3d", underlay: null, primitives: [] });

  const pyramid = {
    id: "pyramid-1",
    type: "pyramid" as const,
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

  // 底面三点是定长三元组：用带元组类型的工厂避免被推宽成数组
  const prismBase = (): [
    { x: number; z: number },
    { x: number; z: number },
    { x: number; z: number },
  ] => [
    { x: 0, z: Math.sqrt(3) / 3 },
    { x: -0.5, z: -Math.sqrt(3) / 6 },
    { x: 0.5, z: -Math.sqrt(3) / 6 },
  ];

  const prism = {
    id: "prism-1",
    type: "triangularPrism" as const,
    x: 0,
    y: 0,
    z: 0,
    height: 1,
    base: prismBase(),
    rotationDegY: 0,
    rotationDegX: 0,
    rotationDegZ: 0,
  };

  test("addPrimitive 写入两种图元且仍能通过契约解析", () => {
    const withPyramid = addPrimitive(empty3d(), pyramid);
    expect(withPyramid.success).toBe(true);
    if (!withPyramid.success) return;
    const withPrism = addPrimitive(withPyramid.document, prism);
    expect(withPrism.success).toBe(true);
    if (!withPrism.success) return;

    expect(withPrism.document.primitives.map((p) => p.type)).toEqual([
      "pyramid",
      "triangularPrism",
    ]);
    expect(
      parseDocument(JSON.stringify(withPrism.document)).success,
    ).toBe(true);
  });

  test("updatePrimitive 把正方形底拉开成长方形底且仍能通过契约解析", () => {
    const original = mustParse({
      version: 1,
      space: "3d",
      underlay: null,
      primitives: [pyramid],
    });
    const snapshot = structuredClone(original);

    const result = updatePrimitive(original, "pyramid-1", {
      ...pyramid,
      width: 3,
    });

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(original).toEqual(snapshot);
    expect(result.document.primitives[0]).toEqual({ ...pyramid, width: 3 });
    expect(parseDocument(JSON.stringify(result.document)).success).toBe(true);
  });

  test("updatePrimitive 把正三角底拉开成一般三角形且仍能通过契约解析", () => {
    const original = mustParse({
      version: 1,
      space: "3d",
      underlay: null,
      primitives: [prism],
    });

    const skewedBase: typeof prism.base = [
      prism.base[0],
      prism.base[1],
      { x: 1.5, z: -0.2 },
    ];
    const result = updatePrimitive(original, "prism-1", {
      ...prism,
      base: skewedBase,
    });

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.document.primitives[0].type).toBe("triangularPrism");
    const updated = result.document.primitives[0];
    if (updated.type !== "triangularPrism") return;
    expect(updated.base).toEqual(skewedBase);
    expect(parseDocument(JSON.stringify(result.document)).success).toBe(true);
  });

  test("2D 说明书拒绝写入四棱锥与三棱柱", () => {
    expect(addPrimitive(empty2d(), pyramid).success).toBe(false);
    expect(addPrimitive(empty2d(), prism).success).toBe(false);
  });
});

describe("3D 参数体变换（票 11）", () => {
  const solidDoc = (primitive: unknown): GeometryDocument =>
    mustParse({
      version: 1,
      space: "3d",
      underlay: null,
      primitives: [primitive],
    });

  /** 从说明书里取回已收窄的参数体：几何纯函数测试都吃它。 */
  const solidOf = (document: GeometryDocument, id: string): SolidPrimitive => {
    if (document.space !== "3d") {
      throw new Error("not a 3D document");
    }
    const primitive = document.primitives.find((item) => item.id === id);
    if (primitive === undefined || primitive.type === "voxel") {
      throw new Error(`solid "${id}" not found`);
    }
    return primitive;
  };

  const box = {
    id: "box-1",
    type: "box" as const,
    x: 0.5,
    y: 1,
    z: -0.5,
    width: 1,
    depth: 2,
    height: 3,
    rotationDegY: 0,
    rotationDegX: 0,
    rotationDegZ: 0,
  };

  const cylinder = {
    id: "cyl-1",
    type: "cylinder" as const,
    x: 0,
    y: 0,
    z: 0,
    r: 0.5,
    height: 1,
    rotationDegY: 0,
    rotationDegX: 0,
    rotationDegZ: 0,
  };

  const sphere = {
    id: "sphere-1",
    type: "sphere" as const,
    x: 0,
    y: 2,
    z: 0,
    r: 0.5,
  };

  const prism = {
    id: "prism-1",
    type: "triangularPrism" as const,
    x: 1,
    y: 0,
    z: 1,
    height: 2,
    base: [
      { x: 1, z: 0 },
      { x: 0, z: 1 },
      { x: -1, z: -1 },
    ] as [
      { x: number; z: number },
      { x: number; z: number },
      { x: number; z: number },
    ],
    rotationDegY: 0,
    rotationDegX: 0,
    rotationDegZ: 0,
  };

  const voxelDoc = (): GeometryDocument =>
    mustParse({
      version: 1,
      space: "3d",
      underlay: null,
      primitives: [{ id: "voxel-1", type: "voxel", x: 0, y: 0, z: 0 }],
    });

  test("rotateEulerYxz 按 Y→X→Z 合成（矩阵 Ry·Rx·Rz，对向量先 Z 后 X 再 Y），unrotate 是它的逆", () => {
    // 绕 Y 90°：局部 +X 转到世界 −Z
    const aroundY = rotateEulerYxz(90, 0, 0, { x: 1, y: 0, z: 0 });
    expectCloseTo(aroundY.x, 0);
    expectCloseTo(aroundY.y, 0);
    expectCloseTo(aroundY.z, -1);
    // (Y90, X90)：对向量先 X 后 Y——与 three 内旋 'YXZ' 同一约定
    const composed = rotateEulerYxz(90, 90, 0, { x: 0, y: 0, z: 1 });
    expectCloseTo(composed.x, 0);
    expectCloseTo(composed.y, -1);
    expectCloseTo(composed.z, 0);
    const restored = unrotateEulerYxz(90, 90, 0, composed);
    expectCloseTo(restored.x, 0);
    expectCloseTo(restored.y, 0);
    expectCloseTo(restored.z, 1);
  });

  test("translateSolidGeometry 只动锚点：尺寸、欧拉角与三棱柱局部底面都不动", () => {
    const moved = translateSolidGeometry(solidOf(solidDoc(box), "box-1"), 1.5, -1, 2.5);
    expect(moved).toEqual({ ...box, x: 2, y: 0, z: 2 });

    const prismMoved = translateSolidGeometry(
      solidOf(solidDoc(prism), "prism-1"),
      1,
      0,
      0,
    );
    expect(prismMoved.type).toBe("triangularPrism");
    if (prismMoved.type !== "triangularPrism") return;
    expect(prismMoved.x).toBe(2);
    expect(prismMoved.base).toEqual(prism.base);
  });

  test("translateSolid 把位移吸附当前格后写入：1、1/2、关三档都仍能 parse", () => {
    const document = solidDoc(box);
    const cases = [
      { grid: 1 as const, expected: { x: 1.5, y: 1, z: -1.5 } },
      { grid: 0.5 as const, expected: { x: 1, y: 1, z: -1.5 } },
      { grid: "off" as const, expected: { x: 1.2, y: 1, z: -1.7 } },
    ];
    for (const { grid, expected } of cases) {
      const result = translateSolid(document, "box-1", 0.7, 0, -1.2, grid);
      expect(result.success).toBe(true);
      if (!result.success) return;
      const moved = result.document.primitives[0];
      expect(moved.type).toBe("box");
      if (moved.type !== "box") return;
      expect(moved.x).toBe(expected.x);
      expect(moved.y).toBe(expected.y);
      expect(moved.z).toBe(expected.z);
      expect(parseDocument(JSON.stringify(result.document)).success).toBe(true);
    }
  });

  test("translateSolid 吸附后零位移返回同一份说明书；体素、2D 说明书与未知 id 报错", () => {
    const document = solidDoc(box);
    const zero = translateSolid(document, "box-1", 0.4, 0, 0, 1);
    expect(zero.success).toBe(true);
    if (zero.success) {
      expect(zero.document).toBe(document);
    }
    expect(translateSolid(voxelDoc(), "voxel-1", 1, 0, 0, 1).success).toBe(false);
    expect(translateSolid(empty2d(), "box-1", 1, 0, 0, 1).success).toBe(false);
    expect(translateSolid(document, "nope", 1, 0, 0, 1).success).toBe(false);
  });

  test("rotateSolidGeometry 逐轴写欧拉角并归一到 [0,360)，另两轴不动", () => {
    const base = solidDoc({ ...box, rotationDegY: 30 });
    const rotated = rotateSolidGeometry(solidOf(base, "box-1"), "y", 40);
    expect(rotated).toEqual({ ...box, rotationDegY: 70 });

    const wrapped = rotateSolidGeometry(
      solidOf(solidDoc({ ...box, rotationDegY: 350 }), "box-1"),
      "y",
      20,
    );
    expect(wrapped.type).toBe("box");
    if (wrapped.type !== "box") return;
    expect(wrapped.rotationDegY).toBe(10);

    const tipped = rotateSolidGeometry(solidOf(base, "box-1"), "x", -90);
    expect(tipped.type).toBe("box");
    if (tipped.type !== "box") return;
    expect(tipped.rotationDegX).toBe(270);
    expect(tipped.rotationDegY).toBe(30);
    expect(tipped.rotationDegZ).toBe(0);
  });

  test("rotateSolid 增量写入后说明书仍能 parse；零增量与球都是恒等", () => {
    const document = solidDoc({ ...box, rotationDegY: 30 });
    const result = rotateSolid(document, "box-1", "y", 40);
    expect(result.success).toBe(true);
    if (!result.success) return;
    const rotated = result.document.primitives[0];
    expect(rotated.type).toBe("box");
    if (rotated.type !== "box") return;
    expect(rotated.rotationDegY).toBe(70);
    expect(parseDocument(JSON.stringify(result.document)).success).toBe(true);

    const zero = rotateSolid(document, "box-1", "z", 0);
    expect(zero.success).toBe(true);
    if (zero.success) {
      expect(zero.document).toBe(document);
    }

    const sphereResult = rotateSolid(solidDoc(sphere), "sphere-1", "y", 90);
    expect(sphereResult.success).toBe(true);
    if (sphereResult.success) {
      expect(sphereResult.document.primitives[0]).toEqual(sphere);
    }
  });

  test("scaleSolidGeometry 等比改尺寸：box 三维、cylinder r 与 height、sphere r、prism 连底面同乘", () => {
    const scaledBox = scaleSolidGeometry(solidOf(solidDoc(box), "box-1"), 2);
    expect(scaledBox).toEqual({ ...box, width: 2, depth: 4, height: 6 });

    const scaledCylinder = scaleSolidGeometry(
      solidOf(solidDoc(cylinder), "cyl-1"),
      2,
    );
    expect(scaledCylinder).toEqual({ ...cylinder, r: 1, height: 2 });

    const scaledSphere = scaleSolidGeometry(
      solidOf(solidDoc(sphere), "sphere-1"),
      3,
    );
    expect(scaledSphere).toEqual({ ...sphere, r: 1.5 });

    const scaledPrism = scaleSolidGeometry(
      solidOf(solidDoc(prism), "prism-1"),
      2,
    );
    expect(scaledPrism.type).toBe("triangularPrism");
    if (scaledPrism.type !== "triangularPrism") return;
    expect(scaledPrism.height).toBe(4);
    expect(scaledPrism.base).toEqual([
      { x: 2, z: 0 },
      { x: 0, z: 2 },
      { x: -2, z: -2 },
    ]);
  });

  test("scaleSolid 非正因子报错；体素与 2D 说明书拒绝", () => {
    const document = solidDoc(box);
    expect(scaleSolid(document, "box-1", 0).success).toBe(false);
    expect(scaleSolid(document, "box-1", -2).success).toBe(false);
    expect(scaleSolid(voxelDoc(), "voxel-1", 2).success).toBe(false);
    expect(scaleSolid(empty2d(), "box-1", 2).success).toBe(false);
  });

  test("moveSolidControlPointGeometry：box 宽/深/高各只改一处，按局部轴投影取绝对值", () => {
    const solid = solidOf(solidDoc(box), "box-1");
    const width = moveSolidControlPointGeometry(solid, "width", {
      x: 2,
      y: 1,
      z: -0.5,
    });
    expect(width).toEqual({ ...box, width: 3 });

    const mirrored = moveSolidControlPointGeometry(solid, "width", {
      x: -0.5,
      y: 1,
      z: -0.5,
    });
    expect(mirrored).toEqual({ ...box, width: 2 });

    const depth = moveSolidControlPointGeometry(solid, "depth", {
      x: 0.5,
      y: 1,
      z: 1.5,
    });
    expect(depth).toEqual({ ...box, depth: 4 });

    const height = moveSolidControlPointGeometry(solid, "height", {
      x: 0.5,
      y: 5,
      z: -0.5,
    });
    expect(height).toEqual({ ...box, height: 4 });
  });

  test("moveSolidControlPointGeometry：旋转过的 box 先逆旋转回局部再度量（Y 90° 时世界 −Z 即局部 +X）", () => {
    const solid = solidOf(
      solidDoc({ ...box, x: 0, y: 0, z: 0, rotationDegY: 90 }),
      "box-1",
    );
    const width = moveSolidControlPointGeometry(solid, "width", {
      x: 0,
      y: 0,
      z: -1.5,
    });
    expect(width).toEqual({ ...solid, width: 3 });
  });

  test("moveSolidControlPointGeometry：cylinder r 取底面径向距离、height 取局部 Y；sphere r 是到球心的距离", () => {
    const cyl = solidOf(solidDoc(cylinder), "cyl-1");
    const r = moveSolidControlPointGeometry(cyl, "r", { x: 0, y: 0, z: 2 });
    expect(r).toEqual({ ...cylinder, r: 2 });
    const height = moveSolidControlPointGeometry(cyl, "height", {
      x: 0,
      y: 3,
      z: 0,
    });
    expect(height).toEqual({ ...cylinder, height: 3 });

    const ball = solidOf(solidDoc(sphere), "sphere-1");
    const radius = moveSolidControlPointGeometry(ball, "r", { x: 3, y: 2, z: 4 });
    expect(radius).toEqual({ ...sphere, r: 5 });
  });

  test("moveSolidControlPointGeometry：prism 高柄改高、底面点写回局部 XZ、未知 pointId 恒等", () => {
    const solid = solidOf(solidDoc(prism), "prism-1");
    const height = moveSolidControlPointGeometry(solid, "height", {
      x: 1,
      y: 4,
      z: 1,
    });
    expect(height).toEqual({ ...prism, height: 4 });

    const base = moveSolidControlPointGeometry(solid, "base-1", {
      x: 2.5,
      y: 0,
      z: -1,
    });
    expect(base.type).toBe("triangularPrism");
    if (base.type !== "triangularPrism") return;
    expect(base.base[1]).toEqual({ x: 1.5, z: -2 });
    expect(base.base[0]).toEqual(prism.base[0]);

    const unknown = moveSolidControlPointGeometry(solid, "nope", {
      x: 9,
      y: 9,
      z: 9,
    });
    expect(unknown).toBe(solid);
  });

  test("moveSolidControlPoint 先吸附当前格再写那一处；体素与 2D 说明书拒绝", () => {
    const document = solidDoc(box);
    const snapped = moveSolidControlPoint(document, "box-1", "width", { x: 1.9, y: 1, z: -0.5 }, 1);
    expect(snapped.success).toBe(true);
    if (!snapped.success) return;
    const moved = snapped.document.primitives[0];
    expect(moved.type).toBe("box");
    if (moved.type !== "box") return;
    // 未吸附是 2.8，吸附到 (2,1,0) 后局部偏移 1.5 → 宽 3
    expect(moved.width).toBe(3);
    expect(parseDocument(JSON.stringify(snapped.document)).success).toBe(true);

    expect(
      moveSolidControlPoint(voxelDoc(), "voxel-1", "width", { x: 1, y: 0, z: 0 }, 1)
        .success,
    ).toBe(false);
    expect(
      moveSolidControlPoint(empty2d(), "box-1", "width", { x: 1, y: 0, z: 0 }, 1)
        .success,
    ).toBe(false);
  });
});

describe("矩形更新", () => {
  const rectangle: Primitive2d = {
    id: "rect-1",
    type: "rectangle",
    x: 1,
    y: 2,
    width: 4,
    height: 2,
    rotationDeg: 0,
    fill: "none",
  };

  const rectDoc = (): GeometryDocument =>
    mustParse({
      version: 1,
      space: "2d",
      underlay: null,
      primitives: [rectangle],
    });

  test("translatePrimitiveGeometry 只平移中心 x y，宽高与旋转角原样", () => {
    const rotated = { ...rectangle, rotationDeg: 30 };
    const moved = translatePrimitiveGeometry(rotated, -1, 3);

    expect(moved).toEqual({ ...rotated, x: 0, y: 5 });
    expect(rotated.x).toBe(1);
  });

  test("rotatePrimitiveGeometry 写 rotationDeg 并归一到 [0,360)，中心与尺寸不动", () => {
    const quarter = rotatePrimitiveGeometry(rectangle, 90);
    const wrap = rotatePrimitiveGeometry({ ...rectangle, rotationDeg: 270 }, 90);
    const back = rotatePrimitiveGeometry({ ...rectangle, rotationDeg: 30 }, -60);

    expect(quarter).toEqual({ ...rectangle, rotationDeg: 90 });
    expect(wrap).toEqual({ ...rectangle, rotationDeg: 0 });
    expect(back).toEqual({ ...rectangle, rotationDeg: 330 });
  });

  test("scalePrimitiveGeometry 宽高同乘因子（等比缩放），旋转角与中心保留", () => {
    const rotated = { ...rectangle, rotationDeg: 30 };
    const moved = scalePrimitiveGeometry(rotated, 1.5);

    expect(moved).toEqual({
      ...rotated,
      width: 6,
      height: 3,
    });
  });

  test("moveControlPointGeometry 拖角只改宽高：中心不动，沿局部轴度量", () => {
    // 角点 corner-0 在局部 (+2,+1) 即世界 (3,3)；拖到 (3,5) → 局部 (2,3)。
    const moved = moveControlPointGeometry(rectangle, "corner-0", {
      x: 3,
      y: 5,
    });

    expect(moved).toEqual({ ...rectangle, width: 4, height: 6 });
  });

  test("moveControlPointGeometry 旋转过的矩形先把世界点逆旋转回局部再度量", () => {
    // rotationDeg 90：局部 +X 轴指向世界 +Y。角点 corner-0 在世界 (0,4)；
    // 沿世界 +Y 拖到 (0,8) 即局部 x 距离 6、y 距离 1 → 宽 12 高 2。
    const rotated = { ...rectangle, rotationDeg: 90 };
    const moved = moveControlPointGeometry(rotated, "corner-0", { x: 0, y: 8 });

    if (moved.type !== "rectangle") return;
    expectCloseTo(moved.width, 12);
    expectCloseTo(moved.height, 2);
    expect(moved.x).toBe(1);
    expect(moved.y).toBe(2);
    expect(moved.rotationDeg).toBe(90);
  });

  test("moveControlPointGeometry 未知控制点 id 是恒等变换", () => {
    expect(
      moveControlPointGeometry(rectangle, "vertex-0", { x: 9, y: 9 }),
    ).toBe(rectangle);
  });

  test("moveControlPoint 先吸附当前格再提交，新说明书仍能通过契约解析", () => {
    const original = rectDoc();
    const snapshot = structuredClone(original);

    const result = moveControlPoint(original, "rect-1", "corner-0", {
      x: 3.4,
      y: 4.6,
    }, 1);

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.document.primitives[0]).toEqual({
      ...rectangle,
      height: 6,
    });
    expect(original).toEqual(snapshot);
    expect(parseDocument(JSON.stringify(result.document)).success).toBe(true);
  });

  test("拖角把宽拖成 0 被契约拒绝，不进说明书", () => {
    const result = moveControlPoint(rectDoc(), "rect-1", "corner-0", {
      x: 1,
      y: 3,
    }, "off");
    expect(result.success).toBe(false);
  });
});

describe("底/高家族更新", () => {
  const triangle: Primitive2d = {
    id: "tri-1",
    type: "triangle",
    x: 1,
    y: 2,
    width: 4,
    height: 3,
    apexOffset: 1,
    rotationDeg: 0,
    fill: "none",
  };

  const parallelogram: Primitive2d = {
    id: "para-1",
    type: "parallelogram",
    x: 1,
    y: 2,
    width: 4,
    height: 2,
    skew: 1.5,
    rotationDeg: 0,
    fill: "none",
  };

  const trapezoid: Primitive2d = {
    id: "trap-1",
    type: "trapezoid",
    x: 1,
    y: 2,
    width: 4,
    topWidth: 2,
    height: 2,
    topOffset: 0.5,
    rotationDeg: 0,
    fill: "none",
  };

  const familyDoc = (
    primitive: Primitive2d,
  ): GeometryDocument =>
    mustParse({
      version: 1,
      space: "2d",
      underlay: null,
      primitives: [primitive],
    });

  test("translatePrimitiveGeometry 只平移锚点，尺寸与偏移原样", () => {
    const moved = translatePrimitiveGeometry(
      { ...triangle, rotationDeg: 30 },
      -1,
      3,
    );

    expect(moved).toEqual({ ...triangle, rotationDeg: 30, x: 0, y: 5 });
    expect(triangle.x).toBe(1);
  });

  test("rotatePrimitiveGeometry 写 rotationDeg 并归一到 [0,360)，锚点不动", () => {
    const quarter = rotatePrimitiveGeometry(triangle, 90);
    const wrap = rotatePrimitiveGeometry(
      { ...parallelogram, rotationDeg: 270 },
      90,
    );
    const back = rotatePrimitiveGeometry(
      { ...trapezoid, rotationDeg: 30 },
      -60,
    );

    expect(quarter).toEqual({ ...triangle, rotationDeg: 90 });
    expect(wrap).toEqual({ ...parallelogram, rotationDeg: 0 });
    expect(back).toEqual({ ...trapezoid, rotationDeg: 330 });
  });

  test("scalePrimitiveGeometry 所有长度字段同乘因子，形状保持相似", () => {
    expect(scalePrimitiveGeometry(triangle, 2)).toEqual({
      ...triangle,
      width: 8,
      height: 6,
      apexOffset: 2,
    });
    expect(scalePrimitiveGeometry(parallelogram, 2)).toEqual({
      ...parallelogram,
      width: 8,
      height: 4,
      skew: 3,
    });
    expect(scalePrimitiveGeometry(trapezoid, 2)).toEqual({
      ...trapezoid,
      width: 8,
      topWidth: 4,
      height: 4,
      topOffset: 1,
    });
  });

  test("moveControlPointGeometry 拖底角对称改底宽：锚点不动", () => {
    // 左底角在 (-1,2)，拖到 (0,2) → 局部 x=-1 → 宽 2。
    const moved = moveControlPointGeometry(triangle, "corner-0", {
      x: 0,
      y: 2,
    });
    expect(moved).toEqual({ ...triangle, width: 2 });

    const shifted = moveControlPointGeometry(trapezoid, "corner-1", {
      x: 4,
      y: 2,
    });
    expect(shifted).toEqual({ ...trapezoid, width: 6 });
  });

  test("moveControlPointGeometry 拖三角顶点改 apexOffset 与 height", () => {
    // 顶点在 (2,5)，拖到 (-1,6) → 局部 (-2,4)。
    const moved = moveControlPointGeometry(triangle, "corner-2", {
      x: -1,
      y: 6,
    });
    expect(moved).toEqual({
      ...triangle,
      width: 4,
      apexOffset: -2,
      height: 4,
    });
  });

  test("moveControlPointGeometry 拖平四上角改 skew 与 height", () => {
    // 右上角在 (3.5,4)，拖到 (4,5) → 局部 (3,3) → skew = 3-2 = 1。
    const moved = moveControlPointGeometry(parallelogram, "corner-2", {
      x: 4,
      y: 5,
    });
    expect(moved).toEqual({
      ...parallelogram,
      skew: 1,
      height: 3,
    });

    // 左上角在 (-0.5,4)，拖到 (0.5,5) → 局部 (-0.5,3) → skew = -0.5+2 = 1.5。
    const fromLeft = moveControlPointGeometry(parallelogram, "corner-3", {
      x: 0.5,
      y: 5,
    });
    expect(fromLeft).toEqual({
      ...parallelogram,
      skew: 1.5,
      height: 3,
    });
  });

  test("moveControlPointGeometry 拖梯形上角对称改 topWidth 与 height", () => {
    // 右上角在 (1.5,4)，拖到 (2.5,5) → 局部 (1.5,3)：topWidth = 2|1.5-0.5| = 2。
    const moved = moveControlPointGeometry(trapezoid, "corner-2", {
      x: 2.5,
      y: 5,
    });
    expect(moved).toEqual({
      ...trapezoid,
      topWidth: 2,
      height: 3,
    });

    // 左上角在 (-0.5,4)，拖到 (1,5) → 局部 (0,3)：topWidth = 2|0-0.5| = 1。
    const fromLeft = moveControlPointGeometry(trapezoid, "corner-3", {
      x: 1,
      y: 5,
    });
    expect(fromLeft).toEqual({
      ...trapezoid,
      topWidth: 1,
      height: 3,
    });
  });

  test("moveControlPointGeometry 旋转过的形状先把世界点逆旋转回局部度量", () => {
    // rotationDeg 90：局部 +X 指向世界 +Y。左底角世界在 (1,0)；
    // 沿世界 -Y 拖到 (1,-4) 即局部 x=-6 → 宽 12。
    const rotated = { ...triangle, rotationDeg: 90 };
    const moved = moveControlPointGeometry(rotated, "corner-0", {
      x: 1,
      y: -4,
    });

    if (moved.type !== "triangle") return;
    expectCloseTo(moved.width, 12);
    expectCloseTo(moved.height, 3);
    expect(moved.x).toBe(1);
    expect(moved.y).toBe(2);
  });

  test("moveControlPointGeometry 未知控制点 id 是恒等变换", () => {
    for (const primitive of [triangle, parallelogram, trapezoid]) {
      expect(
        moveControlPointGeometry(primitive, "vertex-0", { x: 9, y: 9 }),
      ).toBe(primitive);
    }
  });

  test("moveControlPoint 先吸附当前格再提交，新说明书仍过契约", () => {
    const original = familyDoc(triangle);
    const snapshot = structuredClone(original);

    const result = moveControlPoint(
      original,
      "tri-1",
      "corner-2",
      { x: -1.2, y: 6.3 },
      1,
    );

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.document.primitives[0]).toEqual({
      ...triangle,
      apexOffset: -2,
      height: 4,
    });
    expect(original).toEqual(snapshot);
    expect(parseDocument(JSON.stringify(result.document)).success).toBe(true);
  });

  test("拖顶点把高拖成 0 被契约拒绝，不进说明书", () => {
    const result = moveControlPoint(
      familyDoc(triangle),
      "tri-1",
      "corner-2",
      { x: 2, y: 2 },
      "off",
    );
    expect(result.success).toBe(false);
  });

  test("拖平四上角把斜移拖成 0 被契约拒绝（那是矩形）", () => {
    // 右上角局部 (2+skew, 2)，拖到局部 x=2 → skew=0。
    const result = moveControlPoint(
      familyDoc(parallelogram),
      "para-1",
      "corner-2",
      { x: 3, y: 4 },
      "off",
    );
    expect(result.success).toBe(false);
  });

  test("拖梯形上角把上底拖成与下底等长被契约拒绝（那是平四）", () => {
    // 上底中点局部 x=topOffset=0.5，拖右上角到局部 x=2.5 → topWidth=4=width。
    const result = moveControlPoint(
      familyDoc(trapezoid),
      "trap-1",
      "corner-2",
      { x: 3.5, y: 4 },
      "off",
    );
    expect(result.success).toBe(false);
  });
});

describe("角更新", () => {
  const angle: Primitive2d = {
    id: "angle-1",
    type: "angle",
    x: 1,
    y: 2,
    startDeg: 30,
    endDeg: 120,
    length: 3,
  };

  const angleDoc = (): GeometryDocument =>
    mustParse({
      version: 1,
      space: "2d",
      underlay: null,
      primitives: [angle],
    });

  test("translatePrimitiveGeometry 只平移顶点，角度与边长不动", () => {
    const moved = translatePrimitiveGeometry(angle, -1, 3);

    expect(moved).toEqual({ ...angle, x: 0, y: 5 });
    expect(angle.x).toBe(1);
  });

  test("rotatePrimitiveGeometry 无 rotationDeg 字段：改写两角并归一", () => {
    const quarter = rotatePrimitiveGeometry(angle, 90);
    const wrap = rotatePrimitiveGeometry(
      { ...angle, startDeg: 300, endDeg: 350 },
      90,
    );

    expect(quarter).toEqual({ ...angle, startDeg: 120, endDeg: 210 });
    expect(wrap).toEqual({ ...angle, startDeg: 30, endDeg: 80 });
  });

  test("scalePrimitiveGeometry 只乘边长（两边等长，角度不动）", () => {
    const moved = scalePrimitiveGeometry(angle, 2);

    expect(moved).toEqual({ ...angle, length: 6 });
  });

  test("moveControlPointGeometry 拖顶点只写 x y", () => {
    const moved = moveControlPointGeometry(angle, "apex", { x: 4, y: 5 });

    expect(moved).toEqual({ ...angle, x: 4, y: 5 });
  });

  test("moveControlPointGeometry 拖边端点改该角与公共边长", () => {
    // startDeg 30 的端点在世界 (1+3cos30, 2+3sin30)；拖到 (4,2) → 角 0、边长 3。
    const moved = moveControlPointGeometry(angle, "startDeg", { x: 4, y: 2 });

    if (moved.type !== "angle") return;
    expectCloseTo(moved.startDeg, 0);
    expectCloseTo(moved.length, 3);
    expect(moved.endDeg).toBe(120);

    // 拖 endDeg 端点到正上方 (1,7)：角 90、边长 5。
    const endMoved = moveControlPointGeometry(angle, "endDeg", { x: 1, y: 7 });
    if (endMoved.type !== "angle") return;
    expectCloseTo(endMoved.endDeg, 90);
    expectCloseTo(endMoved.length, 5);
    expect(endMoved.startDeg).toBe(30);
  });

  test("moveControlPointGeometry 未知控制点 id 是恒等变换", () => {
    expect(moveControlPointGeometry(angle, "vertex-0", { x: 9, y: 9 })).toBe(
      angle,
    );
  });

  test("moveControlPoint 先吸附当前格再提交，新说明书仍过契约", () => {
    const original = angleDoc();
    const snapshot = structuredClone(original);

    const result = moveControlPoint(
      original,
      "angle-1",
      "startDeg",
      { x: 4.2, y: 2.3 },
      1,
    );

    expect(result.success).toBe(true);
    if (!result.success) return;
    const moved = result.document.primitives[0];
    if (moved.type !== "angle") return;
    expect(moved.startDeg).toBe(0);
    expectCloseTo(moved.length, 3);
    expect(original).toEqual(snapshot);
    expect(parseDocument(JSON.stringify(result.document)).success).toBe(true);
  });

  test("拖边端点到顶点（边长 0）或拖成起止同角被契约拒绝", () => {
    expect(
      moveControlPoint(angleDoc(), "angle-1", "startDeg", { x: 1, y: 2 }, "off")
        .success,
    ).toBe(false);
    // 轴向角夹具（0°/90°，atan2 在轴上无浮点误差）：startDeg 拖到 endDeg
    // 射线上的点 → 起止同角拒绝。
    const axisAngle = { ...angle, startDeg: 0, endDeg: 90 };
    const axisDoc = mustParse({
      version: 1,
      space: "2d",
      underlay: null,
      primitives: [axisAngle],
    });
    expect(
      moveControlPoint(axisDoc, "angle-1", "startDeg", { x: 1, y: 7 }, "off")
        .success,
    ).toBe(false);
  });
});

describe("正多边形更新", () => {
  const hexagon: Primitive2d = {
    id: "hex-1",
    type: "regularPolygon",
    x: 1,
    y: 2,
    sides: 6,
    r: 2,
    rotationDeg: 0,
    fill: "none",
  };

  const polygonDoc = (): GeometryDocument =>
    mustParse({
      version: 1,
      space: "2d",
      underlay: null,
      primitives: [hexagon],
    });

  test("translatePrimitiveGeometry 只平移中心", () => {
    const moved = translatePrimitiveGeometry({ ...hexagon, rotationDeg: 30 }, -1, 3);

    expect(moved).toEqual({ ...hexagon, rotationDeg: 30, x: 0, y: 5 });
    expect(hexagon.x).toBe(1);
  });

  test("rotatePrimitiveGeometry 写 rotationDeg 并归一，中心与尺寸不动", () => {
    const quarter = rotatePrimitiveGeometry(hexagon, 90);
    const wrap = rotatePrimitiveGeometry({ ...hexagon, rotationDeg: 270 }, 90);

    expect(quarter).toEqual({ ...hexagon, rotationDeg: 90 });
    expect(wrap).toEqual({ ...hexagon, rotationDeg: 0 });
  });

  test("scalePrimitiveGeometry 只乘外接圆半径，形状保持相似", () => {
    const moved = scalePrimitiveGeometry(hexagon, 1.5);

    expect(moved).toEqual({ ...hexagon, r: 3 });
  });

  test("moveControlPointGeometry 拖顶点只改外接圆半径（角度朝向不动）", () => {
    // 顶点 vertex-0 世界 (2, 2-√3)；拖到中心正下方 1 单位的 (1,1) → r=1。
    const moved = moveControlPointGeometry(hexagon, "vertex-0", {
      x: 1,
      y: 1,
    });

    if (moved.type !== "regularPolygon") return;
    expectCloseTo(moved.r, 1);
    expect(moved.sides).toBe(6);
    expect(moved.rotationDeg).toBe(0);
  });

  test("moveControlPointGeometry 旋转过的多边形按中心距离度量半径", () => {
    // 旋转 30° 不改变顶点到中心的距离：拖到距中心 3 处 → r=3。
    const rotated = { ...hexagon, rotationDeg: 30 };
    const moved = moveControlPointGeometry(rotated, "vertex-2", {
      x: 1 + 3 * Math.cos((90 * Math.PI) / 180),
      y: 2 + 3 * Math.sin((90 * Math.PI) / 180),
    });

    if (moved.type !== "regularPolygon") return;
    expectCloseTo(moved.r, 3);
    expect(moved.rotationDeg).toBe(30);
  });

  test("moveControlPointGeometry 未知控制点 id 是恒等变换", () => {
    expect(
      moveControlPointGeometry(hexagon, "vertex-9", { x: 9, y: 9 }),
    ).toBe(hexagon);
    expect(
      moveControlPointGeometry(hexagon, "center", { x: 9, y: 9 }),
    ).toBe(hexagon);
  });

  test("moveControlPoint 拖顶点到中心（r=0）被契约拒绝", () => {
    const result = moveControlPoint(
      polygonDoc(),
      "hex-1",
      "vertex-0",
      { x: 1, y: 2 },
      "off",
    );
    expect(result.success).toBe(false);
  });
});

describe("尺寸标注线更新", () => {
  const dimension: Primitive2d = {
    id: "dim-1",
    type: "dimension",
    points: [
      { x: 0, y: 0 },
      { x: 4, y: 0 },
    ],
  };

  const dimensionDoc = (): GeometryDocument =>
    mustParse({
      version: 1,
      space: "2d",
      underlay: null,
      primitives: [dimension],
    });

  test("translatePrimitiveGeometry 整体平移两点", () => {
    const moved = translatePrimitiveGeometry(dimension, 1, 2);

    expect(moved).toEqual({
      ...dimension,
      points: [
        { x: 1, y: 2 },
        { x: 5, y: 2 },
      ],
    });
    expect(dimension.points[0]).toEqual({ x: 0, y: 0 });
  });

  test("rotatePrimitiveGeometry 绕中点转两点（无锚点字段，沿 line 先例）", () => {
    // 中点 (2,0)；转 90°：(0,0)→(2,-2)、(4,0)→(2,2)。
    const quarter = rotatePrimitiveGeometry(dimension, 90);

    if (quarter.type !== "dimension") return;
    expectCloseTo(quarter.points[0]!.x, 2);
    expectCloseTo(quarter.points[0]!.y, -2);
    expectCloseTo(quarter.points[1]!.x, 2);
    expectCloseTo(quarter.points[1]!.y, 2);
  });

  test("scalePrimitiveGeometry 两点朝中点收放，长度乘因子", () => {
    const moved = scalePrimitiveGeometry(dimension, 1.5);

    expect(moved).toEqual({
      ...dimension,
      points: [
        { x: -1, y: 0 },
        { x: 5, y: 0 },
      ],
    });
  });

  test("moveControlPointGeometry 拖端点只动那一个，保 tuple", () => {
    const moved = moveControlPointGeometry(dimension, "vertex-1", {
      x: 4,
      y: 3,
    });

    expect(moved).toEqual({
      ...dimension,
      points: [
        { x: 0, y: 0 },
        { x: 4, y: 3 },
      ],
    });
  });

  test("moveControlPointGeometry 未知控制点 id 是恒等变换", () => {
    expect(
      moveControlPointGeometry(dimension, "vertex-2", { x: 9, y: 9 }),
    ).toBe(dimension);
  });

  test("moveControlPoint 拖端点到另一端（两点重合）被契约拒绝", () => {
    const result = moveControlPoint(
      dimensionDoc(),
      "dim-1",
      "vertex-1",
      { x: 0, y: 0 },
      "off",
    );
    expect(result.success).toBe(false);
  });
});

describe("addVertexGeometry / removeVertexGeometry", () => {
  type LineType = Extract<Primitive2d, { type: "line" }>;
  type PolygonType = Extract<Primitive2d, { type: "polygon" }>;

  const line2 = (id: string): LineType => ({
    id,
    type: "line",
    points: [
      { x: 0, y: 0 },
      { x: 1, y: 1 },
    ],
  });

  const polygon3 = (id: string): PolygonType => ({
    id,
    type: "polygon",
    points: [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 0.5, y: 1 },
    ],
    fill: "none",
  });

  test("addVertexGeometry line: 复制最后一个顶点", () => {
    const line = line2("line-1");
    const result = addVertexGeometry(line);
    expect(result.type).toBe("line");
    if (result.type === "line") {
      expect(result.points).toHaveLength(3);
      expect(result.points[2]).toEqual(result.points[1]);
    }
  });

  test("addVertexGeometry polygon: 复制最后一个顶点", () => {
    const poly = polygon3("poly-1");
    const result = addVertexGeometry(poly);
    expect(result.type).toBe("polygon");
    if (result.type === "polygon") {
      expect(result.points).toHaveLength(4);
      expect(result.points[3]).toEqual(result.points[2]);
    }
  });

  test("addVertexGeometry 非 line/polygon 返回原图元", () => {
    const circle: Primitive2d = {
      id: "c1",
      type: "circle",
      cx: 0,
      cy: 0,
      r: 1,
      fill: "none",
    };
    expect(addVertexGeometry(circle)).toBe(circle);
  });

  test("removeVertexGeometry line: 删除中间顶点", () => {
    const line = line2("line-1");
    const extended = addVertexGeometry(line);
    expect(extended.type).toBe("line");
    if (extended.type !== "line") return;
    const result = removeVertexGeometry(extended, 1);
    expect(result.type).toBe("line");
    if (result.type === "line") {
      expect(result.points).toHaveLength(2);
      expect(result.points).toEqual(line.points);
    }
  });

  test("removeVertexGeometry line: 已在 2 点下限不删除", () => {
    const line = line2("line-1");
    const result = removeVertexGeometry(line, 0);
    expect(result).toBe(line);
  });

  test("removeVertexGeometry polygon: 已在 3 点下限不删除", () => {
    const poly = polygon3("poly-1");
    const result = removeVertexGeometry(poly, 0);
    expect(result).toBe(poly);
  });

  test("removeVertexGeometry polygon: 4 点删到 3 点允许", () => {
    const poly = polygon3("poly-1");
    const extended = addVertexGeometry(poly);
    expect(extended.type).toBe("polygon");
    if (extended.type !== "polygon") return;
    expect(extended.points).toHaveLength(4);
    const result = removeVertexGeometry(extended, 2);
    expect(result.type).toBe("polygon");
    if (result.type === "polygon") {
      expect(result.points).toHaveLength(3);
    }
  });

  test("removeVertexGeometry 索引超范围返回原图元", () => {
    const line = line2("line-1");
    expect(removeVertexGeometry(line, 999)).toBe(line);
    expect(removeVertexGeometry(line, -1)).toBe(line);
  });
});

describe("addVertex / removeVertex (document-level)", () => {
  const docWithLine = (): GeometryDocument =>
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
            { x: 1, y: 1 },
          ],
        },
      ],
    });

  test("addVertex 添加一个顶点到 line", () => {
    const doc = docWithLine();
    const result = addVertex(doc, "line-1");
    expect(result.success).toBe(true);
    if (!result.success) return;
    const line = result.document.primitives[0];
    expect(line?.type).toBe("line");
    if (line?.type === "line") {
      expect(line.points).toHaveLength(3);
    }
  });

  test("removeVertex 删除一个顶点（line >= 2 下限）", () => {
    const doc = docWithLine();
    const addResult = addVertex(doc, "line-1");
    expect(addResult.success).toBe(true);
    if (!addResult.success) return;

    const removeResult = removeVertex(addResult.document, "line-1", 1);
    expect(removeResult.success).toBe(true);
    if (!removeResult.success) return;
    const line = removeResult.document.primitives[0];
    expect(line?.type).toBe("line");
    if (line?.type === "line") {
      expect(line.points).toHaveLength(2);
    }
  });

  test("addVertex 不存在的 id 返回错误", () => {
    const doc = docWithLine();
    const result = addVertex(doc, "nonexistent");
    expect(result.success).toBe(false);
  });

  test("removeVertex 非 2D 文档返回错误", () => {
    const doc = mustParse({
      version: 1,
      space: "3d",
      underlay: null,
      primitives: [],
    });
    const result = removeVertex(doc, "some-id", 0);
    expect(result.success).toBe(false);
  });
});

describe("removePrimitive / 变换恒等：重叠填充（ADR 0019）", () => {
  function overlapDoc(): GeometryDocument {
    return mustParse({
      version: 1,
      space: "2d",
      underlay: null,
      primitives: [
        circle("circle-a", 2),
        {
          id: "fill-1",
          type: "overlapFill",
          sources: ["circle-a", "bow-b"],
          fill: "hatch",
        },
        bow("bow-b"),
        circle("circle-c", 5),
      ],
    });
  }

  test("removing a source cascades away the overlapFill that references it", () => {
    const result = removePrimitive(overlapDoc(), "circle-a");

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.document.primitives.map((p) => p.id)).toEqual([
      "bow-b",
      "circle-c",
    ]);
  });

  test("removing the overlapFill itself removes only the entry", () => {
    const result = removePrimitive(overlapDoc(), "fill-1");

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.document.primitives.map((p) => p.id)).toEqual([
      "circle-a",
      "bow-b",
      "circle-c",
    ]);
  });

  test("translate/rotate/scale/control-point are all identity on overlapFill", () => {
    const doc = overlapDoc();
    const entry = doc.primitives[1];
    if (entry.type !== "overlapFill") throw new Error("fixture");

    expect(translatePrimitiveGeometry(entry, 3, -4)).toBe(entry);
    expect(rotatePrimitiveGeometry(entry, 45)).toBe(entry);
    expect(scalePrimitiveGeometry(entry, 2)).toBe(entry);
    expect(moveControlPointGeometry(entry, "vertex-0", { x: 9, y: 9 })).toBe(
      entry,
    );
  });
});

describe("removePrimitive / 变换恒等：度量标注（ADR 0020）", () => {
  function measureDoc(): GeometryDocument {
    return mustParse({
      version: 1,
      space: "2d",
      underlay: null,
      primitives: [
        circle("circle-a", 2),
        { id: "measure-1", type: "measure", sourceId: "circle-a", kind: "area" },
        bow("bow-b"),
        circle("circle-c", 5),
      ],
    });
  }

  test("removing the source cascades away the measure that references it", () => {
    const result = removePrimitive(measureDoc(), "circle-a");

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.document.primitives.map((p) => p.id)).toEqual([
      "bow-b",
      "circle-c",
    ]);
  });

  test("removing the measure itself removes only the entry", () => {
    const result = removePrimitive(measureDoc(), "measure-1");

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.document.primitives.map((p) => p.id)).toEqual([
      "circle-a",
      "bow-b",
      "circle-c",
    ]);
  });

  test("translate/rotate/scale/control-point are all identity on measure", () => {
    const doc = measureDoc();
    const entry = doc.primitives[1];
    if (entry.type !== "measure") throw new Error("fixture");

    expect(translatePrimitiveGeometry(entry, 3, -4)).toBe(entry);
    expect(rotatePrimitiveGeometry(entry, 45)).toBe(entry);
    expect(scalePrimitiveGeometry(entry, 2)).toBe(entry);
    expect(moveControlPointGeometry(entry, "vertex-0", { x: 9, y: 9 })).toBe(
      entry,
    );
  });

  test("create and cascade delete are both undoable through the history pipeline", () => {
    const base = mustParse({
      version: 1,
      space: "2d",
      underlay: null,
      primitives: [circle("circle-a", 2), bow("bow-b")],
    });

    let history = createHistory(base);
    const added = addPrimitive(history.present, {
      id: "measure-1",
      type: "measure",
      sourceId: "circle-a",
      kind: "area",
    });
    expect(added.success).toBe(true);
    if (!added.success) return;
    history = commitSnapshot(history, added.document);

    const removed = removePrimitive(history.present, "circle-a");
    expect(removed.success).toBe(true);
    if (!removed.success) return;
    history = commitSnapshot(history, removed.document);
    expect(history.present.primitives.map((p) => p.id)).toEqual(["bow-b"]);

    // 级联删除可撤销：源与标注一起回来（addPrimitive 追加在表尾）。
    history = undo(history);
    expect(history.present.primitives.map((p) => p.id)).toEqual([
      "circle-a",
      "bow-b",
      "measure-1",
    ]);

    // 创建也可撤销/重做。
    history = undo(history);
    expect(history.present.primitives.map((p) => p.id)).toEqual([
      "circle-a",
      "bow-b",
    ]);
    history = redo(history);
    expect(history.present.primitives.map((p) => p.id)).toEqual([
      "circle-a",
      "bow-b",
      "measure-1",
    ]);
  });
});

describe("函数曲线更新层（ADR 0021）", () => {
  const curve: Primitive = {
    id: "f1",
    type: "functionCurve",
    kind: "linear",
    a: 1,
    b: 0,
  };

  function docWithCurve(): GeometryDocument {
    const result = parseDocument({
      version: 1,
      space: "2d",
      underlay: null,
      primitives: [curve],
    });
    if (!result.success) throw new Error(result.error);
    return result.document;
  }

  test("创建与删除走历史可逆：undo/redo 还原函数曲线", () => {
    const empty = parseDocument({
      version: 1,
      space: "2d",
      underlay: null,
      primitives: [],
    });
    if (!empty.success) throw new Error(empty.error);

    let history = createHistory(empty.document);
    const added = addPrimitive(history.present, curve);
    expect(added.success).toBe(true);
    if (!added.success) return;
    history = commitSnapshot(history, added.document);
    expect(history.present.primitives).toHaveLength(1);

    history = undo(history);
    expect(history.present.primitives).toHaveLength(0);
    history = redo(history);
    expect(history.present.primitives[0]).toEqual(curve);

    const removed = removePrimitive(history.present, "f1");
    expect(removed.success).toBe(true);
    if (!removed.success) return;
    history = commitSnapshot(history, removed.document);
    expect(history.present.primitives).toHaveLength(0);
    history = undo(history);
    expect(history.present.primitives[0]).toEqual(curve);
  });

  test("平移旋转缩放恒等：无几何身份，说明书不变", () => {
    const document = docWithCurve();

    const moved = translatePrimitive(document, "f1", 1, 0, 1);
    expect(moved.success).toBe(true);
    if (moved.success) {
      expect(moved.document.primitives[0]).toEqual(curve);
    }

    const rotated = rotatePrimitive(document, "f1", 45);
    expect(rotated.success).toBe(true);
    if (rotated.success) {
      expect(rotated.document.primitives[0]).toEqual(curve);
    }

    const scaled = scalePrimitive(document, "f1", 2);
    expect(scaled.success).toBe(true);
    if (scaled.success) {
      expect(scaled.document.primitives[0]).toEqual(curve);
    }
  });
});
