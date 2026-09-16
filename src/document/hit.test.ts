import { describe, expect, test } from "vitest";
import {
  hitCandidates,
  hitTest,
  parseDocument,
  type GeometryDocument,
} from "./index.ts";

function doc2d(primitives: unknown[]): GeometryDocument {
  const result = parseDocument({
    version: 1,
    space: "2d",
    underlay: null,
    primitives,
  });
  if (!result.success) throw new Error(result.error);
  return result.document;
}

function doc3d(primitives: unknown[]): GeometryDocument {
  const result = parseDocument({
    version: 1,
    space: "3d",
    underlay: null,
    primitives,
  });
  if (!result.success) throw new Error(result.error);
  return result.document;
}

describe("hitTest", () => {
  test("hits the smaller-area closed primitive when two closed shapes overlap", () => {
    const document = doc2d([
      {
        id: "outer",
        type: "circle",
        cx: 0,
        cy: 0,
        r: 4,
        fill: "none",
      },
      {
        id: "inner",
        type: "circle",
        cx: 0,
        cy: 0,
        r: 1,
        fill: "solid",
      },
    ]);

    const hit = hitTest(document, { x: 0.2, y: -0.3 });

    expect(hit?.id).toBe("inner");
  });

  test("hits the smaller nested closed primitive even if it is listed first", () => {
    const document = doc2d([
      {
        id: "small-poly",
        type: "polygon",
        points: [
          { x: 0, y: 0 },
          { x: 1, y: 0 },
          { x: 0, y: 1 },
        ],
        fill: "hatch",
      },
      {
        id: "big-poly",
        type: "polygon",
        points: [
          { x: -2, y: -2 },
          { x: 4, y: -2 },
          { x: 4, y: 4 },
          { x: -2, y: 4 },
        ],
        fill: "none",
      },
    ]);

    const hit = hitTest(document, { x: 0.2, y: 0.2 });

    expect(hit?.id).toBe("small-poly");
  });

  test("hits a ring in the annulus and the inner circle in the hole", () => {
    const document = doc2d([
      {
        id: "ring",
        type: "ring",
        cx: 0,
        cy: 0,
        rInner: 2,
        rOuter: 4,
        fill: "solid",
      },
      {
        id: "core",
        type: "circle",
        cx: 0,
        cy: 0,
        r: 1,
        fill: "solid",
      },
    ]);

    expect(hitTest(document, { x: 3, y: 0 })?.id).toBe("ring");
    expect(hitTest(document, { x: 0, y: 0 })?.id).toBe("core");
  });

  test("returns null when the point is outside every primitive", () => {
    const document = doc2d([
      {
        id: "circle",
        type: "circle",
        cx: 0,
        cy: 0,
        r: 1,
        fill: "solid",
      },
    ]);

    expect(hitTest(document, { x: 3, y: 3 })).toBeNull();
  });

  test("hits a smaller ellipse nested in a circle", () => {
    const document = doc2d([
      {
        id: "circle",
        type: "circle",
        cx: 0,
        cy: 0,
        r: 3,
        fill: "none",
      },
      {
        id: "ellipse",
        type: "ellipse",
        cx: 0,
        cy: 0,
        rx: 1,
        ry: 0.5,
        fill: "solid",
      },
    ]);

    expect(hitTest(document, { x: 0.4, y: 0.1 })?.id).toBe("ellipse");
  });

  test("hits a sector rather than the larger enclosing circle", () => {
    const document = doc2d([
      {
        id: "circle",
        type: "circle",
        cx: 0,
        cy: 0,
        r: 2,
        fill: "solid",
      },
      {
        id: "sector",
        type: "sector",
        cx: 0,
        cy: 0,
        r: 2,
        startDeg: 0,
        endDeg: 90,
        fill: "hatch",
      },
    ]);

    expect(hitTest(document, { x: 1, y: 0.2 })?.id).toBe("sector");
  });

  test("hits a bow rather than the larger enclosing circle", () => {
    const document = doc2d([
      {
        id: "circle",
        type: "circle",
        cx: 0,
        cy: 0,
        r: 2,
        fill: "solid",
      },
      {
        id: "bow",
        type: "bow",
        cx: 0,
        cy: 0,
        r: 2,
        startDeg: 0,
        endDeg: 90,
        fill: "hatch",
      },
    ]);

    const onCap = { x: Math.cos(Math.PI / 4) * 1.9, y: Math.sin(Math.PI / 4) * 1.9 };
    expect(hitTest(document, onCap)?.id).toBe("bow");
    expect(hitTest(document, { x: 0, y: 0 })?.id).toBe("circle");
  });

  test("treats a 0° to 360° sector as a full disk", () => {
    const document = doc2d([
      {
        id: "full",
        type: "sector",
        cx: 0,
        cy: 0,
        r: 2,
        startDeg: 0,
        endDeg: 360,
        fill: "solid",
      },
    ]);

    expect(hitTest(document, { x: -1, y: 0 })?.id).toBe("full");
  });

  test("hits the unit voxel whose occupancy cube contains the point", () => {
    const document = doc3d([
      { id: "a", type: "voxel", x: 0, y: 0, z: 0 },
      { id: "b", type: "voxel", x: 1, y: 0, z: 0 },
    ]);

    expect(hitTest(document, { x: 0.25, y: 0.5, z: 0.75 })?.id).toBe("a");
    expect(hitTest(document, { x: 1.25, y: 0.5, z: 0.75 })?.id).toBe("b");
    expect(hitTest(document, { x: 0.5, y: 2, z: 0.5 })).toBeNull();
  });
});

describe("hitTest 矩形", () => {
  test("轴对齐矩形：内点与边界命中，外点落空", () => {
    const document = doc2d([
      {
        id: "rect-1",
        type: "rectangle",
        x: 1,
        y: 2,
        width: 4,
        height: 2,
        rotationDeg: 0,
        fill: "none",
      },
    ]);

    expect(hitTest(document, { x: 1, y: 2 })?.id).toBe("rect-1");
    expect(hitTest(document, { x: 3, y: 3 })?.id).toBe("rect-1");
    expect(hitTest(document, { x: 3.1, y: 2 })).toBeNull();
    expect(hitTest(document, { x: 1, y: 3.1 })).toBeNull();
  });

  test("旋转矩形：把点反旋转到局部系再判", () => {
    const document = doc2d([
      {
        id: "rect-1",
        type: "rectangle",
        x: 0,
        y: 0,
        width: 4,
        height: 2,
        rotationDeg: 45,
        fill: "none",
      },
    ]);

    // 转过 45° 后长轴指向世界 (+,+) 方向：局部 (1.9, 0) 落在长轴内。
    const onLongAxis = {
      x: 1.9 * Math.cos(Math.PI / 4),
      y: 1.9 * Math.sin(Math.PI / 4),
    };
    expect(hitTest(document, onLongAxis)?.id).toBe("rect-1");

    // 世界 +X 上的同距离点反旋转后 |局部 y| 超过半高，落空。
    expect(hitTest(document, { x: 1.9, y: 0 })).toBeNull();
  });

  test("矩形是闭合图元：面积 width×height 参与小者优先", () => {
    const document = doc2d([
      { id: "circle-1", type: "circle", cx: 0, cy: 0, r: 4, fill: "none" },
      {
        id: "rect-1",
        type: "rectangle",
        x: 0,
        y: 0,
        width: 2,
        height: 1,
        rotationDeg: 0,
        fill: "solid",
      },
    ]);

    expect(hitTest(document, { x: 0.3, y: 0.2 })?.id).toBe("rect-1");
    expect(hitTest(document, { x: 3, y: 0 })?.id).toBe("circle-1");
  });
});

describe("hitTest 底/高家族", () => {
  test("三角/平四/梯形：内点与底边边界命中，外点落空", () => {
    const document = doc2d([
      {
        id: "tri-1",
        type: "triangle",
        x: 0,
        y: 0,
        width: 4,
        height: 3,
        apexOffset: 0,
        rotationDeg: 0,
        fill: "none",
      },
      {
        id: "para-1",
        type: "parallelogram",
        x: 6,
        y: 0,
        width: 4,
        height: 2,
        skew: 1,
        rotationDeg: 0,
        fill: "none",
      },
      {
        id: "trap-1",
        type: "trapezoid",
        x: 0,
        y: 5,
        width: 4,
        topWidth: 2,
        height: 2,
        topOffset: 0,
        rotationDeg: 0,
        fill: "none",
      },
    ]);

    // 三角：底边中点 (0,0) 在边界上，形内 (0,1) 命中，形外 (1.9,2.9) 落空。
    expect(hitTest(document, { x: 0, y: 0 })?.id).toBe("tri-1");
    expect(hitTest(document, { x: 0, y: 1 })?.id).toBe("tri-1");
    expect(hitTest(document, { x: 1.9, y: 2.9 })).toBeNull();

    // 平四 (6,0) 底 4 高 2 斜移 1：上底占据 x∈[5,9]、y=2；(9.5,1) 在斜边外。
    expect(hitTest(document, { x: 6, y: 1 })?.id).toBe("para-1");
    expect(hitTest(document, { x: 8.5, y: 2 })?.id).toBe("para-1");
    expect(hitTest(document, { x: 4.4, y: 1 })).toBeNull();
    expect(hitTest(document, { x: 9.5, y: 1 })).toBeNull();

    // 梯形：下底宽 4 上底宽 2，y=5.5 处腰在 |x|=1.75。
    expect(hitTest(document, { x: 0, y: 5.5 })?.id).toBe("trap-1");
    expect(hitTest(document, { x: 1.9, y: 5.5 })).toBeNull();
  });

  test("旋转过的三角形按旋转后的世界顶点判定", () => {
    const document = doc2d([
      {
        id: "tri-1",
        type: "triangle",
        x: 0,
        y: 0,
        width: 4,
        height: 3,
        apexOffset: 0,
        rotationDeg: 90,
        fill: "none",
      },
    ]);

    // 旋 90° 后底边竖直、顶点指向世界 -X：(0.5,1) 出形，(-1,0) 进形。
    expect(hitTest(document, { x: 0.5, y: 1 })).toBeNull();
    expect(hitTest(document, { x: -1, y: 0 })?.id).toBe("tri-1");
  });

  test("家族是闭合图元：面积参与重叠小者优先", () => {
    // 平四 wh=3 小于三角 wh/2=6：重叠点选平四，只属三角的点归三角。
    const document = doc2d([
      {
        id: "tri-1",
        type: "triangle",
        x: 0,
        y: 0,
        width: 4,
        height: 3,
        apexOffset: 0,
        rotationDeg: 0,
        fill: "none",
      },
      {
        id: "para-1",
        type: "parallelogram",
        x: 0,
        y: 0,
        width: 2,
        height: 1.5,
        skew: 0.5,
        rotationDeg: 0,
        fill: "solid",
      },
    ]);

    expect(hitTest(document, { x: 0, y: 1 })?.id).toBe("para-1");
    expect(hitTest(document, { x: 0, y: 2.5 })?.id).toBe("tri-1");
  });
});

describe("hitTest 角", () => {
  const angleDoc = () =>
    doc2d([
      {
        id: "angle-1",
        type: "angle",
        x: 0,
        y: 0,
        startDeg: 0,
        endDeg: 90,
        length: 4,
      },
    ]);

  test("两边线段在容差内命中：精确零容差只在边上命中", () => {
    const document = angleDoc();

    // 起始边是 (0,0)-(4,0) 上的点。
    expect(hitTest(document, { x: 2, y: 0 })?.id).toBe("angle-1");
    // 终止边是 (0,0)-(0,4) 上的点；cos(90°) 有 1e-16 级 ε，传极小容差。
    expect(hitTest(document, { x: 0, y: 3 }, 1e-9)?.id).toBe("angle-1");
    // 两边之间的空白（角平分线上）零容差落空。
    expect(hitTest(document, { x: 1, y: 1 })).toBeNull();
  });

  test("容差内近边可命中，弧标也是角的一部分", () => {
    const document = angleDoc();

    // 近边 (2, 0.3) 在 0.5 容差内。
    expect(hitTest(document, { x: 2, y: 0.3 }, 0.5)?.id).toBe("angle-1");
    // 弧标半径 = 4×0.25 = 1：45° 方向 (cos45, sin45) 上距顶点 1 的点。
    const onArc = {
      x: Math.cos(Math.PI / 4),
      y: Math.sin(Math.PI / 4),
    };
    expect(hitTest(document, onArc, 1e-9)?.id).toBe("angle-1");
    // 扫角之外的反方向弧不命中：225° 方向同半径。
    const offArc = {
      x: -Math.cos(Math.PI / 4),
      y: -Math.sin(Math.PI / 4),
    };
    expect(hitTest(document, offArc)).toBeNull();
  });

  test("角非闭合：远离边的点不命中，面积不参与", () => {
    const document = angleDoc();

    expect(hitTest(document, { x: 3, y: 3 })).toBeNull();
    expect(hitTest(document, { x: -1, y: -1 })).toBeNull();
  });
});

describe("hitTest 正多边形", () => {
  test("平底六边形：形内与底边命中，外点落空", () => {
    const document = doc2d([
      {
        id: "hex-1",
        type: "regularPolygon",
        x: 0,
        y: 0,
        sides: 6,
        r: 2,
        rotationDeg: 0,
        fill: "none",
      },
    ]);

    expect(hitTest(document, { x: 0, y: 0 })?.id).toBe("hex-1");
    expect(hitTest(document, { x: 1, y: -1.5 })?.id).toBe("hex-1");
    // 底边 y=-√3 上 |x|≤1：边界命中。
    expect(hitTest(document, { x: 0.5, y: -Math.sqrt(3) }, 1e-9)?.id).toBe(
      "hex-1",
    );
    // 腰外的点：六边形在 y=-1.5 处 |x| 上限约 1.13。
    expect(hitTest(document, { x: 1.9, y: -1.5 })).toBeNull();
    expect(hitTest(document, { x: 2.1, y: 0 })).toBeNull();
  });

  test("旋转过的五边形按世界顶点判定", () => {
    const document = doc2d([
      {
        id: "pent-1",
        type: "regularPolygon",
        x: 0,
        y: 0,
        sides: 5,
        r: 2,
        rotationDeg: 90,
        fill: "none",
      },
    ]);

    // 旋 90° 后原顶点方向（90° 房顶尖）转到 180°：(-1.9,0) 在该尖内侧；
    // (0,2) 原是尖、旋转后是腰外。
    expect(hitTest(document, { x: -1.9, y: 0 })?.id).toBe("pent-1");
    expect(hitTest(document, { x: 0, y: 2 })).toBeNull();
  });

  test("正多边形是闭合图元：面积 n/2·r²·sin(2π/n) 参与小者优先", () => {
    // 五边形面积 (5/2)·(1.5²)·sin72° ≈ 5.36 小于三角 wh/2 = 6：重叠点选五边形。
    const document = doc2d([
      {
        id: "tri-1",
        type: "triangle",
        x: 0,
        y: 0,
        width: 4,
        height: 3,
        apexOffset: 0,
        rotationDeg: 0,
        fill: "none",
      },
      {
        id: "pent-1",
        type: "regularPolygon",
        x: 0,
        y: 0,
        sides: 5,
        r: 1.5,
        rotationDeg: 0,
        fill: "solid",
      },
    ]);

    expect(hitTest(document, { x: 0, y: 0.5 })?.id).toBe("pent-1");
    expect(hitTest(document, { x: 0, y: 2.5 })?.id).toBe("tri-1");
  });
});

describe("hitTest 尺寸标注线", () => {
  test("主段笔画命中：线上与容差内命中，线外落空；非闭合不参与面积", () => {
    const document = doc2d([
      {
        id: "dim-1",
        type: "dimension",
        points: [
          { x: 0, y: 0 },
          { x: 4, y: 0 },
        ],
      },
    ]);

    expect(hitTest(document, { x: 2, y: 0 })?.id).toBe("dim-1");
    expect(hitTest(document, { x: 2, y: 0.3 }, 0.5)?.id).toBe("dim-1");
    expect(hitTest(document, { x: 2, y: 0.3 })).toBeNull();
    expect(hitTest(document, { x: 2, y: 1 })).toBeNull();
    // 中点上方 0.8 处是数字标签区域，但数字不是几何：仍落空。
    expect(hitTest(document, { x: 2, y: 0.8 })).toBeNull();
  });
});

describe("hitTest 命中容差", () => {
  test("细线在容差内可命中，零容差保持精确", () => {
    const document = doc2d([
      {
        id: "line",
        type: "line",
        points: [
          { x: 0, y: 0 },
          { x: 4, y: 0 },
        ],
      },
    ]);
    const near = { x: 2, y: 0.3 };

    expect(hitTest(document, near, 0.5)?.id).toBe("line");
    expect(hitTest(document, near)).toBeNull();
    expect(hitTest(document, near, 0.2)).toBeNull();
  });

  test("弧在半径容差内可命中", () => {
    const document = doc2d([
      {
        id: "arc",
        type: "arc",
        cx: 0,
        cy: 0,
        r: 2,
        startDeg: 0,
        endDeg: 90,
      },
    ]);

    expect(hitTest(document, { x: 2.2, y: 0 }, 0.25)?.id).toBe("arc");
    expect(hitTest(document, { x: -2.2, y: 0 }, 0.25)).toBeNull();
    expect(hitTest(document, { x: 4, y: 4 }, 0.25)).toBeNull();
  });

  test("标签点在容差内可命中", () => {
    const document = doc2d([
      { id: "label", type: "label", x: 1, y: 1, text: "A" },
    ]);

    expect(hitTest(document, { x: 1.2, y: 1 }, 0.5)?.id).toBe("label");
    expect(hitTest(document, { x: 1.2, y: 1 })).toBeNull();
  });
});

describe("hitTest 重叠填充区域（ADR 0019 引用式）", () => {
  const overlapDoc = (extra: unknown[] = []) =>
    doc2d([
      { id: "circle-a", type: "circle", cx: 0, cy: 0, r: 4, fill: "none" },
      { id: "rect-b", type: "rectangle", x: 2, y: 0, width: 4, height: 6, fill: "none" },
      { id: "fill-1", type: "overlapFill", sources: ["circle-a", "rect-b"], fill: "hatch" },
      ...extra,
    ]);

  test("a click inside both sources returns the overlapFill entry, not a source", () => {
    // 圆 (r=4, 圆心 0,0) 与矩形 (中心 2,0, 4×6) 的交集内取 (2,0)。
    const hit = hitTest(overlapDoc(), { x: 2, y: 0 });

    expect(hit?.id).toBe("fill-1");
  });

  test("a click inside only one source returns that source", () => {
    expect(hitTest(overlapDoc(), { x: -2, y: 0 })?.id).toBe("circle-a");
    // (3.8,2.8) 在矩形内、圆外（离圆心 4.72 > 4）。
    expect(hitTest(overlapDoc(), { x: 3.8, y: 2.8 })?.id).toBe("rect-b");
  });

  test("a click inside a smaller nested shape still beats the overlapFill region", () => {
    // 交集里再放一个小圆：面内命中按面积小者优先的现行规则不该被引用条目劫走。
    const document = doc2d([
      { id: "circle-a", type: "circle", cx: 0, cy: 0, r: 4, fill: "none" },
      { id: "rect-b", type: "rectangle", x: 2, y: 0, width: 4, height: 6, fill: "none" },
      { id: "tiny", type: "circle", cx: 2, cy: 0, r: 0.5, fill: "none" },
      { id: "fill-1", type: "overlapFill", sources: ["circle-a", "rect-b"], fill: "hatch" },
    ]);

    expect(hitTest(document, { x: 2, y: 0 })?.id).toBe("tiny");
  });

  test("stacked overlapFill entries: the later one in document order wins", () => {
    const document = overlapDoc([
      { id: "fill-2", type: "overlapFill", sources: ["circle-a", "rect-b"], fill: "solid" },
    ]);

    expect(hitTest(document, { x: 2, y: 0 })?.id).toBe("fill-2");
  });

  test("a stale entry whose sources no longer intersect is never hit", () => {
    const document = doc2d([
      { id: "circle-a", type: "circle", cx: 0, cy: 0, r: 1, fill: "none" },
      { id: "rect-b", type: "rectangle", x: 50, y: 50, width: 4, height: 6, fill: "none" },
      { id: "fill-1", type: "overlapFill", sources: ["circle-a", "rect-b"], fill: "hatch" },
    ]);

    expect(hitTest(document, { x: 0, y: 0 })?.id).toBe("circle-a");
  });
});

describe("hitCandidates 同点循环候选（ADR 0019 选不中另一源的补全）", () => {
  const overlapDoc = (extra: unknown[] = []) =>
    doc2d([
      { id: "circle-a", type: "circle", cx: 0, cy: 0, r: 4, fill: "none" },
      { id: "rect-b", type: "rectangle", x: 2, y: 0, width: 4, height: 6, fill: "none" },
      { id: "fill-1", type: "overlapFill", sources: ["circle-a", "rect-b"], fill: "hatch" },
      ...extra,
    ]);

  test("首位候选恒等于 hitTest 胜者，现行首击行为不变", () => {
    const document = overlapDoc();
    const point = { x: 2, y: 0 };
    const first = hitCandidates(document, point)[0];
    expect(first?.id).toBe(hitTest(document, point)?.id);
  });

  test("交集内的循环序覆盖条目与全部源", () => {
    // 条目（首）→ 封闭源按面积升序（rect 24 < circle 16π）→ 笔画无。
    const ids = hitCandidates(overlapDoc(), { x: 2, y: 0 }).map((p) => p.id);
    expect(ids).toEqual(["fill-1", "rect-b", "circle-a"]);
  });

  test("嵌套小面仍是首位，其后回到条目与源", () => {
    const document = overlapDoc([
      { id: "tiny", type: "circle", cx: 2, cy: 0, r: 0.5, fill: "none" },
    ]);
    const ids = hitCandidates(document, { x: 2, y: 0 }).map((p) => p.id);
    expect(ids).toEqual(["tiny", "fill-1", "rect-b", "circle-a"]);
  });

  test("命中笔画与封闭并列时，循环序里封闭在前、笔画随后", () => {
    const document = doc2d([
      { id: "line-a", type: "line", points: [{ x: 0, y: 0 }, { x: 4, y: 0 }] },
      { id: "rect-b", type: "rectangle", x: 2, y: 0, width: 4, height: 6, fill: "none" },
    ]);
    // y=0 在矩形边上（contains 含边界）：封闭 rect 首位，线段其次。
    const ids = hitCandidates(document, { x: 2, y: 0 }).map((p) => p.id);
    expect(ids).toEqual(["rect-b", "line-a"]);
  });

  test("空白处候选为空数组", () => {
    expect(hitCandidates(overlapDoc(), { x: 40, y: 40 })).toEqual([]);
  });

  test("3D 体素退化为单候选", () => {
    const document = doc3d([
      { id: "voxel-a", type: "voxel", x: 0, y: 0, z: 0 },
    ]);
    const candidates = hitCandidates(document, { x: 0, y: 0, z: 0 });
    expect(candidates.map((p) => p.id)).toEqual(["voxel-a"]);
  });
});
