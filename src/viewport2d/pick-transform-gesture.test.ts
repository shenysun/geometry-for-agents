import { describe, expect, test } from "vitest";
import {
  clickPickTransform,
  escPickTransform,
  idlePickTransformState,
  movePickTransform,
  startPickTransformStep,
  upPickTransform,
  type PickTransformContext,
} from "./pick-transform-gesture.ts";
import { parseDocument, type GeometryDocument } from "../document/index.ts";

function transformDoc(): GeometryDocument {
  const result = parseDocument({
    version: 1,
    space: "2d",
    underlay: null,
    primitives: [
      { id: "circle-a", type: "circle", cx: 0, cy: 0, r: 4, fill: "none" },
      {
        id: "line-b",
        type: "line",
        points: [
          { x: 10, y: 0 },
          { x: 14, y: 0 },
        ],
      },
      {
        id: "f1",
        type: "functionCurve",
        kind: "linear",
        a: 1,
        b: 0,
      },
      {
        id: "m1",
        type: "measure",
        sourceId: "circle-a",
        kind: "perimeter",
      },
    ],
  });
  if (!result.success) throw new Error(result.error);
  return result.document;
}

function ctxAt(over: Partial<PickTransformContext> = {}): PickTransformContext {
  return {
    document: transformDoc(),
    point: { x: 0, y: 0 },
    tolerance: 0,
    grid: 1,
    id: "transform-new",
    kind: "translate",
    ...over,
  };
}

describe("变换两步拾取手势（ADR 0022）：第一步点源锁定", () => {
  test("click on a whitelisted source locks it, no commit yet", () => {
    const result = clickPickTransform(idlePickTransformState(), ctxAt());

    expect(result.state).toEqual({ kind: "source", id: "circle-a" });
    expect(result.commit).toBeNull();
    expect(result.selectionId).toBeUndefined();
    expect(result.rejection).toBeNull();
  });

  test("stroke family is a legal source too", () => {
    const result = clickPickTransform(
      idlePickTransformState(),
      ctxAt({ point: { x: 12, y: 0 }, tolerance: 1 }),
    );

    expect(result.state).toEqual({ kind: "source", id: "line-b" });
  });

  test("function curve is rejected immediately with no state change", () => {
    // 曲线 y=x 过 (6,6)：远离圆与线段，带采样视口命中函数曲线（白名单外）。
    const result = clickPickTransform(
      idlePickTransformState(),
      ctxAt({
        point: { x: 6, y: 6 },
        tolerance: 0.5,
        curveViewport: { xMin: 0, xMax: 20, scale: 40, heightWorld: 20 },
      }),
    );

    expect(result.state).toEqual({ kind: "idle" });
    expect(result.commit).toBeNull();
    expect(result.rejection).toBe("not-transformable");
  });

  test("measure entry is rejected through the same whitelist", () => {
    // 周长文本悬在圆包围盒上方 (0,4)~(0,4.6)：点文本区命中标注条目，
    // 白名单同样拒绝。
    const result = clickPickTransform(
      idlePickTransformState(),
      ctxAt({ point: { x: 0, y: 4.3 }, worldPerPx: 0.05 }),
    );

    expect(result.state).toEqual({ kind: "idle" });
    expect(result.rejection).toBe("not-transformable");
  });

  test("clicking empty space is ignored", () => {
    const result = clickPickTransform(
      idlePickTransformState(),
      ctxAt({ point: { x: 100, y: 100 } }),
    );

    expect(result.state).toEqual({ kind: "idle" });
    expect(result.rejection).toBeNull();
  });

  test("3D document is ignored", () => {
    const result = parseDocument({
      version: 1,
      space: "3d",
      underlay: null,
      primitives: [{ id: "voxel-a", type: "voxel", x: 0, y: 0, z: 0 }],
    });
    if (!result.success) throw new Error(result.error);

    const pick = clickPickTransform(
      idlePickTransformState(),
      ctxAt({ document: result.document, point: { x: 0.5, y: 0.5 } }),
    );
    expect(pick.state).toEqual({ kind: "idle" });
    expect(pick.commit).toBeNull();
    expect(pick.rejection).toBeNull();
  });
});

describe("变换两步拾取手势：第二步拖位移向量", () => {
  test("vector drag previews the image and commits one undoable entry on release", () => {
    const locked = clickPickTransform(idlePickTransformState(), ctxAt());
    const started = startPickTransformStep(
      locked.state,
      ctxAt({ point: { x: 1.2, y: -0.8 } }),
    );

    expect(started.state).toMatchObject({ kind: "vector", id: "circle-a" });
    // 起点落格：1.2 → 1，-0.8 → -1。
    expect(started.state).toMatchObject({ start: { x: 1, y: -1 } });

    const moved = movePickTransform(
      started.state,
      ctxAt({ point: { x: 4.6, y: 1.2 } }),
    );
    expect(moved.preview).not.toBeNull();
    if (moved.preview === null) return;
    // 像是源几何施加位移后的图元值：圆心 = (0,0) + 位移 (4,2)。
    expect(moved.preview.image).toMatchObject({
      type: "circle",
      cx: 4,
      cy: 2,
    });

    const released = upPickTransform(
      moved.state,
      ctxAt({ point: { x: 4.6, y: 1.2 } }),
    );
    // 松手点 4.6,1.2 落格 5,1；位移 = (5,1)−(1,−1) = (4,2)。
    expect(released.commit).toEqual({
      id: "transform-new",
      type: "transform",
      sourceId: "circle-a",
      kind: "translate",
      dx: 4,
      dy: 2,
    });
    expect(released.selectionId).toBe("transform-new");
    expect(released.state).toEqual({ kind: "idle" });
    expect(released.preview).toBeNull();
  });

  test("zero displacement on release commits nothing and returns to the locked source", () => {
    const locked = clickPickTransform(idlePickTransformState(), ctxAt());
    const started = startPickTransformStep(
      locked.state,
      ctxAt({ point: { x: 1.2, y: 1.2 } }),
    );
    const released = upPickTransform(
      started.state,
      ctxAt({ point: { x: 1.4, y: 1.4 } }),
    );

    // 起止同格：零位移触碰不提交（退化值不静默钳到端点）。
    expect(released.commit).toBeNull();
    expect(released.state).toEqual({ kind: "source", id: "circle-a" });
  });

  test("grid off keeps raw coordinates (Alt 暂不落格)", () => {
    const locked = clickPickTransform(idlePickTransformState(), ctxAt());
    const started = startPickTransformStep(
      locked.state,
      ctxAt({ point: { x: 1.25, y: 1.25 }, grid: "off" }),
    );
    const released = upPickTransform(
      started.state,
      ctxAt({ point: { x: 2.75, y: 3.25 }, grid: "off" }),
    );

    expect(released.commit).toMatchObject({ dx: 1.5, dy: 2 });
  });

  test("escape resets the gesture to idle", () => {
    const locked = clickPickTransform(idlePickTransformState(), ctxAt());
    const started = startPickTransformStep(
      locked.state,
      ctxAt({ point: { x: 1, y: 1 } }),
    );

    expect(escPickTransform(started.state).state).toEqual({ kind: "idle" });
    expect(escPickTransform(locked.state).state).toEqual({ kind: "idle" });
  });

  test("source vanishing mid-gesture neither previews nor commits", () => {
    const locked = clickPickTransform(idlePickTransformState(), ctxAt());
    const started = startPickTransformStep(
      locked.state,
      ctxAt({ point: { x: 1, y: 1 } }),
    );
    // 源被删：拖动与松手都安全返回，不产出悬空条目。
    const hollowDoc = parseDocument({
      version: 1,
      space: "2d",
      underlay: null,
      primitives: [
        {
          id: "line-b",
          type: "line",
          points: [
            { x: 10, y: 0 },
            { x: 14, y: 0 },
          ],
        },
      ],
    });
    if (!hollowDoc.success) throw new Error(hollowDoc.error);
    const hollow = ctxAt({ document: hollowDoc.document });

    const moved = movePickTransform(started.state, hollow);
    expect(moved.preview).toBeNull();
    const released = upPickTransform(started.state, hollow);
    expect(released.commit).toBeNull();
    expect(released.state).toEqual({ kind: "idle" });
  });
});

describe("变换两步拾取手势：第二步点旋转中心（票 03）", () => {
  test("press-move-release previews the rotated image and commits default 90°", () => {
    const locked = clickPickTransform(idlePickTransformState(), ctxAt());
    const started = startPickTransformStep(
      locked.state,
      ctxAt({ point: { x: 5.2, y: 0.8 }, kind: "rotate" }),
    );

    // 中心落格：5.2,0.8 → 5,1；按下即出像（全程实时预览，US 8）。
    expect(started.state).toEqual({
      kind: "center",
      centerKind: "rotate",
      id: "circle-a",
      center: { x: 5, y: 1 },
    });
    expect(started.preview).not.toBeNull();
    if (started.preview === null) return;
    // 按下点的像：圆心 (0,0) 绕 (5,1) 逆时针 90° = (6,−4)。
    expect(started.preview.image).toMatchObject({ type: "circle", cx: 6, cy: -4 });

    const moved = movePickTransform(
      started.state,
      ctxAt({ point: { x: 6.6, y: -1.2 }, kind: "rotate" }),
    );
    expect(moved.preview).not.toBeNull();
    if (moved.preview === null) return;
    // 中心落格 6.6,−1.2 → 7,−1；像圆心 = (0,0) 绕 (7,−1) 逆时针 90°：
    // p−c = (−7,1) 旋转后 (−1,−7)，加回中心得 (6,−8)。
    expect(moved.preview.image).toMatchObject({ type: "circle", cx: 6, cy: -8 });
    // 中心辅助点随预览（总是显示的辅助几何）。
    expect(moved.preview.center).toEqual({ x: 7, y: -1 });

    const released = upPickTransform(
      moved.state,
      ctxAt({ point: { x: 6.6, y: -1.2 }, kind: "rotate" }),
    );
    // 存储保留符号约定（正为逆时针），显示归一属属性面板（票 05）。
    expect(released.commit).toEqual({
      id: "transform-new",
      type: "transform",
      sourceId: "circle-a",
      kind: "rotate",
      centerX: 7,
      centerY: -1,
      angleDeg: 90,
    });
    expect(released.selectionId).toBe("transform-new");
    expect(released.state).toEqual({ kind: "idle" });
    expect(released.preview).toBeNull();
  });

  test("a plain click on the center commits too（点中心一步定参）", () => {
    const locked = clickPickTransform(idlePickTransformState(), ctxAt());
    const started = startPickTransformStep(
      locked.state,
      ctxAt({ point: { x: 3, y: 2 }, kind: "rotate" }),
    );
    const released = upPickTransform(
      started.state,
      ctxAt({ point: { x: 3.1, y: 2.1 }, kind: "rotate" }),
    );

    expect(released.commit).toMatchObject({
      kind: "rotate",
      centerX: 3,
      centerY: 2,
      angleDeg: 90,
    });
  });

  test("center gesture neither previews nor commits after the source vanishes", () => {
    const locked = clickPickTransform(idlePickTransformState(), ctxAt());
    const started = startPickTransformStep(
      locked.state,
      ctxAt({ point: { x: 5, y: 1 }, kind: "rotate" }),
    );
    const hollowDoc = parseDocument({
      version: 1,
      space: "2d",
      underlay: null,
      primitives: [
        {
          id: "line-b",
          type: "line",
          points: [
            { x: 10, y: 0 },
            { x: 14, y: 0 },
          ],
        },
      ],
    });
    if (!hollowDoc.success) throw new Error(hollowDoc.error);
    const hollow = ctxAt({ document: hollowDoc.document, kind: "rotate" });

    expect(movePickTransform(started.state, hollow).preview).toBeNull();
    const released = upPickTransform(started.state, hollow);
    expect(released.commit).toBeNull();
    expect(released.state).toEqual({ kind: "idle" });
  });

  test("escape resets the center gesture to idle", () => {
    const locked = clickPickTransform(idlePickTransformState(), ctxAt());
    const started = startPickTransformStep(
      locked.state,
      ctxAt({ point: { x: 5, y: 1 }, kind: "rotate" }),
    );

    expect(escPickTransform(started.state).state).toEqual({ kind: "idle" });
  });

  test("kind 由创建工具定死：拖动中换工具不改变本次提交的变换种类", () => {
    const locked = clickPickTransform(idlePickTransformState(), ctxAt());
    const started = startPickTransformStep(
      locked.state,
      ctxAt({ point: { x: 3, y: 2 }, kind: "rotate" }),
    );
    // 拖中心期间键盘切到位似工具（松手上下文的 kind 已变）：仍按旋转提交。
    const released = upPickTransform(
      started.state,
      ctxAt({ point: { x: 3, y: 2 }, kind: "dilate" }),
    );

    expect(released.commit).toMatchObject({ kind: "rotate", angleDeg: 90 });
  });

  test("平移按下瞬间零位移不预览（恒等像不虚线叠在源上）", () => {
    const locked = clickPickTransform(idlePickTransformState(), ctxAt());
    const started = startPickTransformStep(
      locked.state,
      ctxAt({ point: { x: 1, y: 1 }, kind: "translate" }),
    );

    expect(started.preview).toBeNull();
  });
});

/** 轴对称专用夹具：圆悬在 x 轴上方（像翻到下方可断言），线段躺 x 轴上
 *  （线段吸附分支的现成对称轴）。 */
function reflectDoc(): GeometryDocument {
  const result = parseDocument({
    version: 1,
    space: "2d",
    underlay: null,
    primitives: [
      { id: "circle-a", type: "circle", cx: 0, cy: 3, r: 1, fill: "none" },
      {
        id: "axis-line",
        type: "line",
        points: [
          { x: 10, y: 0 },
          { x: 14, y: 0 },
        ],
      },
    ],
  });
  if (!result.success) throw new Error(result.error);
  return result.document;
}

function reflectCtxAt(
  over: Partial<PickTransformContext> = {},
): PickTransformContext {
  return {
    document: reflectDoc(),
    point: { x: 0, y: 0 },
    tolerance: 0,
    grid: 1,
    id: "transform-new",
    kind: "reflect",
    ...over,
  };
}

describe("变换两步拾取手势：第二步点两点定轴（票 04）", () => {
  test("点源 → 点两点定轴：两次点击提交，预览实时跟随光标", () => {
    const locked = clickPickTransform(
      idlePickTransformState(),
      reflectCtxAt({ point: { x: 0, y: 3 } }),
    );
    expect(locked.state).toEqual({ kind: "source", id: "circle-a" });

    // 第一定轴点：落格 0.2,0.9 → 0,1。
    const first = clickPickTransform(locked.state, reflectCtxAt({
      point: { x: 0.2, y: 0.9 },
    }));
    expect(first.state).toEqual({
      kind: "axis",
      id: "circle-a",
      first: { x: 0, y: 1 },
    });
    expect(first.commit).toBeNull();

    // 两点击之间悬停移动：像与轴虚线实时预览（US 8）。
    // 轴 = (0,1)→(2,1) 水平线，圆心 (0,3) 翻到 (0,−1)。
    const hovered = movePickTransform(
      first.state,
      reflectCtxAt({ point: { x: 2.4, y: 0.8 } }),
    );
    expect(hovered.state).toEqual(first.state);
    expect(hovered.preview).not.toBeNull();
    if (hovered.preview === null) return;
    expect(hovered.preview.image).toMatchObject({
      type: "circle",
      cx: 0,
      cy: -1,
    });
    expect(hovered.preview.axis).toEqual([
      { x: 0, y: 1 },
      { x: 2, y: 1 },
    ]);

    // 第二定轴点：落格 2.4,0.8 → 2,1，一次提交（一步 undo）。
    const second = clickPickTransform(first.state, reflectCtxAt({
      point: { x: 2.4, y: 0.8 },
    }));
    expect(second.commit).toEqual({
      id: "transform-new",
      type: "transform",
      sourceId: "circle-a",
      kind: "reflect",
      x1: 0,
      y1: 1,
      x2: 2,
      y2: 1,
    });
    expect(second.selectionId).toBe("transform-new");
    expect(second.state).toEqual({ kind: "idle" });
    expect(second.preview).toBeNull();
  });

  test("第二点与第一点同格：轴退化不提交，继续等待第二点", () => {
    const locked = clickPickTransform(
      idlePickTransformState(),
      reflectCtxAt({ point: { x: 0, y: 3 } }),
    );
    const first = clickPickTransform(locked.state, reflectCtxAt({
      point: { x: 1, y: 1 },
    }));
    const sameCell = clickPickTransform(first.state, reflectCtxAt({
      point: { x: 1.4, y: 1.4 },
    }));

    expect(sameCell.state).toEqual({
      kind: "axis",
      id: "circle-a",
      first: { x: 1, y: 1 },
    });
    expect(sameCell.commit).toBeNull();
    // 同格悬停无轴可预览（退化轴无定义）。
    expect(
      movePickTransform(sameCell.state, reflectCtxAt({ point: { x: 1.4, y: 1.4 } }))
        .preview,
    ).toBeNull();
  });

  test("第二步点中现成线段：直接取其两端点为轴，一次点击完成定轴（US 4）", () => {
    const locked = clickPickTransform(
      idlePickTransformState(),
      reflectCtxAt({ point: { x: 0, y: 3 } }),
    );
    // 点中线段（带容差命中）：轴 = 线段两端点 (10,0)/(14,0) 原样，不落格。
    const snapped = clickPickTransform(locked.state, reflectCtxAt({
      point: { x: 12, y: 0.2 },
      tolerance: 1,
    }));

    expect(snapped.commit).toEqual({
      id: "transform-new",
      type: "transform",
      sourceId: "circle-a",
      kind: "reflect",
      x1: 10,
      y1: 0,
      x2: 14,
      y2: 0,
    });
    expect(snapped.state).toEqual({ kind: "idle" });
  });

  test("定轴中点中现成线段同样一次成轴（从 axis 态吸附）", () => {
    const locked = clickPickTransform(
      idlePickTransformState(),
      reflectCtxAt({ point: { x: 0, y: 3 } }),
    );
    const first = clickPickTransform(locked.state, reflectCtxAt({
      point: { x: 0, y: 1 },
    }));
    const snapped = clickPickTransform(first.state, reflectCtxAt({
      point: { x: 11, y: -0.3 },
      tolerance: 1,
    }));

    expect(snapped.commit).toMatchObject({
      kind: "reflect",
      x1: 10,
      y1: 0,
      x2: 14,
      y2: 0,
    });
  });

  test("多顶点线段取首末两端为轴", () => {
    const doc = parseDocument({
      version: 1,
      space: "2d",
      underlay: null,
      primitives: [
        { id: "circle-a", type: "circle", cx: 0, cy: 3, r: 1, fill: "none" },
        {
          id: "axis-line",
          type: "line",
          points: [
            { x: 10, y: 0 },
            { x: 12, y: 1 },
            { x: 14, y: 0 },
          ],
        },
      ],
    });
    if (!doc.success) throw new Error(doc.error);

    const locked = clickPickTransform(
      idlePickTransformState(),
      reflectCtxAt({ point: { x: 0, y: 3 } }),
    );
    const snapped = clickPickTransform(locked.state, reflectCtxAt({
      document: doc.document,
      point: { x: 12, y: 1 },
      tolerance: 0.5,
    }));

    expect(snapped.commit).toMatchObject({
      kind: "reflect",
      x1: 10,
      y1: 0,
      x2: 14,
      y2: 0,
    });
  });

  test("kind 由创建工具定死：定轴中换工具不改变本次提交的变换种类", () => {
    const locked = clickPickTransform(
      idlePickTransformState(),
      reflectCtxAt({ point: { x: 0, y: 3 } }),
    );
    const first = clickPickTransform(locked.state, reflectCtxAt({
      point: { x: 0, y: 1 },
    }));
    // 定轴期间键盘切到位似工具（本次点击上下文的 kind 已变）：仍按轴对称提交。
    const second = clickPickTransform(first.state, reflectCtxAt({
      point: { x: 2, y: 1 },
      kind: "dilate",
    }));

    expect(second.commit).toMatchObject({ kind: "reflect" });
  });

  test("源消失后定轴中的点击不提交、整体复位", () => {
    const locked = clickPickTransform(
      idlePickTransformState(),
      reflectCtxAt({ point: { x: 0, y: 3 } }),
    );
    const first = clickPickTransform(locked.state, reflectCtxAt({
      point: { x: 0, y: 1 },
    }));
    const hollowDoc = parseDocument({
      version: 1,
      space: "2d",
      underlay: null,
      primitives: [
        {
          id: "axis-line",
          type: "line",
          points: [
            { x: 10, y: 0 },
            { x: 14, y: 0 },
          ],
        },
      ],
    });
    if (!hollowDoc.success) throw new Error(hollowDoc.error);
    const hollow = reflectCtxAt({ document: hollowDoc.document });

    expect(movePickTransform(first.state, hollow).preview).toBeNull();
    const clicked = clickPickTransform(first.state, hollow);
    expect(clicked.commit).toBeNull();
    expect(clicked.state).toEqual({ kind: "idle" });
  });

  test("escape 复位定轴手势；按下/松手通道对轴对称是恒等", () => {
    const locked = clickPickTransform(
      idlePickTransformState(),
      reflectCtxAt({ point: { x: 0, y: 3 } }),
    );
    const first = clickPickTransform(locked.state, reflectCtxAt({
      point: { x: 0, y: 1 },
    }));

    expect(escPickTransform(first.state).state).toEqual({ kind: "idle" });
    // 已锁源后的按下不启动拖动（定轴走点击通道），松手同样恒等。
    const pressed = startPickTransformStep(
      locked.state,
      reflectCtxAt({ point: { x: 5, y: 5 } }),
    );
    expect(pressed.state).toEqual(locked.state);
    const released = upPickTransform(first.state, reflectCtxAt({
      point: { x: 5, y: 5 },
    }));
    expect(released.state).toEqual(first.state);
    expect(released.commit).toBeNull();
  });

  test("grid off 保留原始坐标定轴（Alt 暂不落格）", () => {
    const locked = clickPickTransform(
      idlePickTransformState(),
      reflectCtxAt({ point: { x: 0, y: 3 } }),
    );
    const first = clickPickTransform(locked.state, reflectCtxAt({
      point: { x: 0.25, y: 1.25 },
      grid: "off",
    }));
    const second = clickPickTransform(first.state, reflectCtxAt({
      point: { x: 2.75, y: 1.25 },
      grid: "off",
    }));

    expect(second.commit).toMatchObject({
      kind: "reflect",
      x1: 0.25,
      y1: 1.25,
      x2: 2.75,
      y2: 1.25,
    });
  });
});

describe("变换两步拾取手势：第二步点位似中心（票 03）", () => {
  test("press-move-release previews the dilated image and commits default ratio 2", () => {
    const locked = clickPickTransform(idlePickTransformState(), ctxAt());
    const started = startPickTransformStep(
      locked.state,
      ctxAt({ point: { x: 5.2, y: 0.8 }, kind: "dilate" }),
    );

    expect(started.state).toEqual({
      kind: "center",
      centerKind: "dilate",
      id: "circle-a",
      center: { x: 5, y: 1 },
    });

    const moved = movePickTransform(
      started.state,
      ctxAt({ point: { x: 6.6, y: -1.2 }, kind: "dilate" }),
    );
    expect(moved.preview).not.toBeNull();
    if (moved.preview === null) return;
    // 中心落格 6.6,−1.2 → 7,−1；像圆心 = (7,−1) + 2×((0,0)−(7,−1)) = (−7,1)，
    // 半径 4×2 = 8。
    expect(moved.preview.image).toMatchObject({
      type: "circle",
      cx: -7,
      cy: 1,
      r: 8,
    });
    expect(moved.preview.center).toEqual({ x: 7, y: -1 });

    const released = upPickTransform(
      moved.state,
      ctxAt({ point: { x: 6.6, y: -1.2 }, kind: "dilate" }),
    );
    expect(released.commit).toEqual({
      id: "transform-new",
      type: "transform",
      sourceId: "circle-a",
      kind: "dilate",
      centerX: 7,
      centerY: -1,
      ratio: 2,
    });
    expect(released.selectionId).toBe("transform-new");
    expect(released.state).toEqual({ kind: "idle" });
  });

  test("a plain click commits the dilation at the clicked center", () => {
    const locked = clickPickTransform(idlePickTransformState(), ctxAt());
    const started = startPickTransformStep(
      locked.state,
      ctxAt({ point: { x: 2, y: 3 }, kind: "dilate" }),
    );
    const released = upPickTransform(
      started.state,
      ctxAt({ point: { x: 2.05, y: 3.05 }, kind: "dilate" }),
    );

    expect(released.commit).toMatchObject({
      kind: "dilate",
      centerX: 2,
      centerY: 3,
      ratio: 2,
    });
  });

  test("grid off keeps raw center coordinates（Alt 暂不落格）", () => {
    const locked = clickPickTransform(idlePickTransformState(), ctxAt());
    const started = startPickTransformStep(
      locked.state,
      ctxAt({ point: { x: 2.25, y: 1.25 }, grid: "off", kind: "dilate" }),
    );
    const released = upPickTransform(
      started.state,
      ctxAt({ point: { x: 3.75, y: 2.25 }, grid: "off", kind: "dilate" }),
    );

    expect(released.commit).toMatchObject({ centerX: 3.75, centerY: 2.25 });
  });
});
