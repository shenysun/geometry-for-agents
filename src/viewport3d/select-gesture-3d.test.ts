import { describe, expect, test } from "vitest";
import {
  parseDocument,
  type GeometryDocument,
  type Point3,
} from "../document/index.ts";
import {
  clickSelect3d,
  escSelect3d,
  idleSelect3dState,
  moveSelect3d,
  solidTransformHandles,
  startSelect3d,
  upSelect3d,
  type Ray3,
  type Select3dContext,
} from "./select-gesture-3d.ts";

function doc3d(primitives: unknown[]): GeometryDocument {
  const parsed = parseDocument({
    version: 1,
    space: "3d",
    underlay: null,
    primitives,
  });
  if (!parsed.success) {
    throw new Error(parsed.error);
  }
  return parsed.document;
}

const VOXEL_A = { id: "voxel-a", type: "voxel", x: 1, y: 0, z: 2 } as const;

function baseContext(
  overrides: Partial<Select3dContext> = {},
): Select3dContext {
  return {
    tool: "select",
    document: doc3d([VOXEL_A]),
    point: { x: 1.5, y: 0.5, z: 2.5 },
    grid: 1,
    selectionId: null,
    hitId: null,
    ...overrides,
  };
}

describe("startSelect3d", () => {
  test("点在体素上：进入拖动态并选中，不产生任何提交", () => {
    const result = startSelect3d(
      idleSelect3dState(),
      baseContext({ hitId: "voxel-a" }),
    );

    expect(result.state).toEqual({
      kind: "drag",
      id: "voxel-a",
      startWorld: { x: 1.5, y: 0.5, z: 2.5 },
      startCorner: { x: 1, y: 0, z: 2 },
    });
    expect(result.selectionId).toBe("voxel-a");
    expect(result.preview).toBeNull();
    expect(result.commit).toBeNull();
  });

  test("点在空处：保持 idle，不动当前选中", () => {
    const result = startSelect3d(
      idleSelect3dState(),
      baseContext({ hitId: null, selectionId: "voxel-a" }),
    );

    expect(result.state).toEqual({ kind: "idle" });
    expect(result.selectionId).toBeUndefined();
    expect(result.commit).toBeNull();
  });

  test("命中的是参数体（票 11 起）：进入平移态并选中", () => {
    const document = doc3d([
      { id: "box-1", type: "box", x: 0, y: 0, z: 0, width: 1, depth: 1, height: 1, rotationDegY: 0, rotationDegX: 0, rotationDegZ: 0 },
    ]);
    const result = startSelect3d(
      idleSelect3dState(),
      baseContext({ document, hitId: "box-1", point: { x: 0.2, y: 0, z: 0.3 } }),
    );

    expect(result.state).toMatchObject({ kind: "solid-translate", id: "box-1" });
    expect(result.selectionId).toBe("box-1");
  });
});

describe("clickSelect3d", () => {
  test("单击命中体素则选中它", () => {
    const result = clickSelect3d(
      idleSelect3dState(),
      baseContext({ hitId: "voxel-a" }),
    );

    expect(result.selectionId).toBe("voxel-a");
    expect(result.commit).toBeNull();
  });

  test("单击空处取消选中", () => {
    const result = clickSelect3d(
      idleSelect3dState(),
      baseContext({ hitId: null, selectionId: "voxel-a" }),
    );

    expect(result.selectionId).toBeNull();
  });
});

describe("moveSelect3d", () => {
  function dragFrom(start: Select3dContext) {
    return startSelect3d(idleSelect3dState(), start);
  }

  test("拖过一格：预览目标整数角，说明书不动", () => {
    const started = dragFrom(
      baseContext({ hitId: "voxel-a", point: { x: 1.4, y: 0.3, z: 2.6 } }),
    );
    const moved = moveSelect3d(
      started.state,
      baseContext({ point: { x: 2.6, y: 0.4, z: 3.6 } }),
    );

    expect(moved.preview).toEqual({
      kind: "voxel",
      corner: { x: 2, y: 0, z: 3 },
    });
    expect(moved.commit).toBeNull();
  });

  test("位移不足一格：不显示预览", () => {
    const started = dragFrom(
      baseContext({ hitId: "voxel-a", point: { x: 1.4, y: 0.3, z: 2.6 } }),
    );
    const moved = moveSelect3d(
      started.state,
      baseContext({ point: { x: 1.6, y: 0.3, z: 2.8 } }),
    );

    expect(moved.preview).toBeNull();
    expect(moved.commit).toBeNull();
  });

  test("格为 1/2 或关、Alt 按下：目标角仍是同一个整数格", () => {
    const started = dragFrom(
      baseContext({ hitId: "voxel-a", point: { x: 1.4, y: 0.3, z: 2.6 } }),
    );
    const expected = {
      kind: "voxel",
      corner: { x: 2, y: 0, z: 3 },
    } as const;

    const halfGrid = moveSelect3d(
      started.state,
      baseContext({ point: { x: 2.6, y: 0.4, z: 3.6 }, grid: 0.5 }),
    );
    expect(halfGrid.preview).toEqual(expected);

    const offGrid = moveSelect3d(
      started.state,
      baseContext({ point: { x: 2.6, y: 0.4, z: 3.6 }, grid: "off" }),
    );
    expect(offGrid.preview).toEqual(expected);
  });
});

describe("upSelect3d", () => {
  test("拖到另一整数格松手：一次 commit 整数平移，手势回 idle", () => {
    const started = startSelect3d(
      idleSelect3dState(),
      baseContext({ hitId: "voxel-a", point: { x: 1.4, y: 0.3, z: 2.6 } }),
    );
    // 手势中反复移动只更新预览，从不提交
    const during = moveSelect3d(
      started.state,
      baseContext({ point: { x: 2.6, y: 0.4, z: 3.6 } }),
    );
    expect(during.commit).toBeNull();
    const duringAgain = moveSelect3d(
      during.state,
      baseContext({ point: { x: 2.4, y: 0.4, z: 3.4 } }),
    );
    expect(duringAgain.commit).toBeNull();

    // 一次 pointerup 只有一次提交，且只会是整格平移
    const result = upSelect3d(
      duringAgain.state,
      baseContext({ point: { x: 2.4, y: 0.4, z: 3.4 } }),
    );

    expect(result.state).toEqual({ kind: "idle" });
    expect(result.commit).toEqual({
      kind: "translate",
      id: "voxel-a",
      dx: 1,
      dy: 0,
      dz: 1,
    });
  });

  test("原地松手：不提交，选中已在按下时定下", () => {
    const started = startSelect3d(
      idleSelect3dState(),
      baseContext({ hitId: "voxel-a", point: { x: 1.4, y: 0.3, z: 2.6 } }),
    );
    const result = upSelect3d(
      started.state,
      baseContext({ point: { x: 1.5, y: 0.3, z: 2.7 } }),
    );

    expect(result.state).toEqual({ kind: "idle" });
    expect(result.commit).toBeNull();
    expect(result.selectionId).toBeUndefined();
  });
});

describe("escSelect3d", () => {
  test("Esc 中断拖动：回 idle，无预览无提交", () => {
    const started = startSelect3d(
      idleSelect3dState(),
      baseContext({ hitId: "voxel-a" }),
    );
    const result = escSelect3d(started.state);

    expect(result.state).toEqual({ kind: "idle" });
    expect(result.preview).toBeNull();
    expect(result.commit).toBeNull();
  });
});

// ---- 票 11：参数体拾取、变换手柄、控制点与格 ----

const BOX_1 = {
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

const CYL_1 = {
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

const SPHERE_1 = {
  id: "sphere-1",
  type: "sphere" as const,
  x: 0,
  y: 0,
  z: 0,
  r: 0.5,
};

/** 世界单位的柄/控制点命中容差；柄布放间距 = 4×该值（与 2D 同一规则）。 */
const TOLERANCE = { handleTolerance: 0.1, controlTolerance: 0.1 } as const;

/** 沿 approach 方向穿过 point 的视线：origin 在 point 后方 10 个单位处。 */
function rayHitting(point: Point3, approach: Point3): Ray3 {
  const len = Math.hypot(approach.x, approach.y, approach.z);
  const direction = {
    x: approach.x / len,
    y: approach.y / len,
    z: approach.z / len,
  };
  return {
    origin: {
      x: point.x - direction.x * 10,
      y: point.y - direction.y * 10,
      z: point.z - direction.z * 10,
    },
    direction,
  };
}

function solidContext(
  overrides: Partial<Select3dContext> = {},
): Select3dContext {
  return {
    tool: "select",
    document: doc3d([BOX_1]),
    point: { x: 0, y: 0, z: 0 },
    grid: 1,
    selectionId: null,
    hitId: null,
    ...TOLERANCE,
    ...overrides,
  };
}

function expectClose(actual: number, expected: number): void {
  expect(Math.abs(actual - expected)).toBeLessThan(1e-9);
}

describe("solidTransformHandles", () => {
  test("站立体三旋转柄加一缩放柄：头顶、两侧、地面斜角；球只有缩放柄", () => {
    const boxHandles = solidTransformHandles(BOX_1, TOLERANCE.handleTolerance);
    // 间距 4×容差 = 0.4：rotateY (0,1.4,0)、rotateX (0,0.5,0.9)、rotateZ (0.9,0.5,0)、scale (0.9,0,0.9)
    expect(boxHandles).toEqual({
      id: "box-1",
      anchor: { x: 0, y: 0, z: 0 },
      rotateY: { x: 0, y: 1.4, z: 0 },
      rotateX: { x: 0, y: 0.5, z: 0.9 },
      rotateZ: { x: 0.9, y: 0.5, z: 0 },
      scale: { x: 0.9, y: 0, z: 0.9 },
    });

    const sphereHandles = solidTransformHandles(
      SPHERE_1,
      TOLERANCE.handleTolerance,
    );
    expect(sphereHandles.rotateY).toBeNull();
    expect(sphereHandles.rotateX).toBeNull();
    expect(sphereHandles.rotateZ).toBeNull();
    expect(sphereHandles.scale).toEqual({ x: 0.9, y: 0, z: 0.9 });
  });
});

describe("startSelect3d 参数体命中顺序", () => {
  test("控制点优先于本体：视线擦过选中长方体的宽点，即使身后命中的是别的参数体", () => {
    const document = doc3d([BOX_1, CYL_1]);
    const result = startSelect3d(
      idleSelect3dState(),
      solidContext({
        document,
        selectionId: "box-1",
        hitId: "cyl-1",
        point: { x: 0.5, y: 0, z: 0 },
        ray: rayHitting({ x: 0.5, y: 0, z: 0 }, { x: 0, y: 1, z: 1 }),
      }),
    );

    expect(result.state).toMatchObject({
      kind: "solid-control",
      id: "box-1",
      pointId: "width",
      planeOrigin: { x: 0.5, y: 0, z: 0 },
    });
    expect(result.selectionId).toBe("box-1");
    expect(result.commit).toBeNull();
  });

  test("旋转/缩放柄优先于本体：视线落在缩放柄上进入缩放态", () => {
    const result = startSelect3d(
      idleSelect3dState(),
      solidContext({
        selectionId: "box-1",
        hitId: "box-1",
        ray: rayHitting({ x: 0.9, y: 0, z: 0.9 }, { x: 0, y: 0, z: 1 }),
      }),
    );

    expect(result.state.kind).toBe("solid-scale");
    if (result.state.kind !== "solid-scale") return;
    expectClose(result.state.startRadius, 0.9);
  });

  test("视线落在旋转柄上进入对应轴的旋转态，起点角取柄位方位", () => {
    const result = startSelect3d(
      idleSelect3dState(),
      solidContext({
        selectionId: "box-1",
        hitId: "box-1",
        ray: rayHitting({ x: 0, y: 1.4, z: 0 }, { x: 1, y: -1, z: 0 }),
      }),
    );

    expect(result.state.kind).toBe("solid-rotate");
    if (result.state.kind !== "solid-rotate") return;
    expect(result.state.axis).toBe("y");
    expectClose(result.state.startDeg, 0);
  });

  test("未选中时没有控制点与柄：落在宽点位置也进本体平移态并顺手选中", () => {
    const result = startSelect3d(
      idleSelect3dState(),
      solidContext({
        selectionId: null,
        hitId: "box-1",
        point: { x: 0.5, y: 0, z: 0 },
        ray: rayHitting({ x: 0.5, y: 0, z: 0 }, { x: 0, y: 1, z: 1 }),
      }),
    );

    expect(result.state).toMatchObject({
      kind: "solid-translate",
      id: "box-1",
      startAnchor: { x: 0, y: 0, z: 0 },
    });
    expect(result.selectionId).toBe("box-1");
  });

  test("命中的是参数体本体：进入平移态，不产生提交", () => {
    const result = startSelect3d(
      idleSelect3dState(),
      solidContext({
        hitId: "box-1",
        point: { x: 0.2, y: 0, z: 0.3 },
      }),
    );

    expect(result.state).toEqual({
      kind: "solid-translate",
      id: "box-1",
      startWorld: { x: 0.2, y: 0, z: 0.3 },
      startAnchor: { x: 0, y: 0, z: 0 },
    });
    expect(result.selectionId).toBe("box-1");
    expect(result.preview).toBeNull();
    expect(result.commit).toBeNull();
  });

  test("体素回归：选中体素时视线再近也没有控制点/柄，仍是整格拖动", () => {
    const result = startSelect3d(
      idleSelect3dState(),
      baseContext({
        selectionId: "voxel-a",
        hitId: "voxel-a",
        point: { x: 1.5, y: 0.5, z: 2.5 },
        ray: rayHitting({ x: 1.5, y: 0.5, z: 2.5 }, { x: 0, y: 1, z: 1 }),
        ...TOLERANCE,
      }),
    );

    expect(result.state.kind).toBe("drag");
  });

  test("球没有旋转柄：视线落在旋转柄该在的位置不产生任何手势", () => {
    const result = startSelect3d(
      idleSelect3dState(),
      solidContext({
        document: doc3d([SPHERE_1]),
        selectionId: "sphere-1",
        ray: rayHitting({ x: 0, y: 0.9, z: 0 }, { x: 0.2, y: -1, z: 0.2 }),
      }),
    );

    expect(result.state).toEqual({ kind: "idle" });
    expect(result.selectionId).toBeUndefined();
  });
});

describe("moveSelect3d / upSelect3d 参数体平移", () => {
  function press(overrides: Partial<Select3dContext> = {}) {
    return startSelect3d(
      idleSelect3dState(),
      solidContext({
        hitId: "box-1",
        point: { x: 0.25, y: 0, z: 0.25 },
        ...overrides,
      }),
    );
  }

  test("拖动只预览吸附后的落点：格 1、1/2、关三档", () => {
    const started = press();
    const moved = { x: 0.95, y: 0, z: 0.55 };

    const grid1 = moveSelect3d(
      started.state,
      solidContext({ point: moved, grid: 1 }),
    );
    expect(grid1.preview).toEqual({
      kind: "box",
      anchor: { x: 1, y: 0, z: 0 },
      width: 1,
      depth: 1,
      height: 1,
      rotationDegY: 0,
      rotationDegX: 0,
      rotationDegZ: 0,
    });

    const halfGrid = moveSelect3d(
      started.state,
      solidContext({ point: moved, grid: 0.5 }),
    );
    expect(halfGrid.preview).toMatchObject({
      kind: "box",
      anchor: { x: 0.5, y: 0, z: 0.5 },
    });

    // 关格（Alt 由视口层折算成 off 再喂进来）：保留原始位移
    const offGrid = moveSelect3d(
      started.state,
      solidContext({ point: moved, grid: "off" }),
    );
    expect(offGrid.preview).toMatchObject({
      kind: "box",
      anchor: { x: expect.closeTo(0.7), y: 0, z: expect.closeTo(0.3) },
    });
  });

  test("手势中多次移动只更新预览从不提交；松手一次提交原始位移", () => {
    const started = press();
    const during = moveSelect3d(
      started.state,
      solidContext({ point: { x: 0.95, y: 0, z: 0.55 } }),
    );
    expect(during.commit).toBeNull();
    const duringAgain = moveSelect3d(
      during.state,
      solidContext({ point: { x: 0.8, y: 0, z: 0.5 } }),
    );
    expect(duringAgain.commit).toBeNull();

    const result = upSelect3d(
      duringAgain.state,
      solidContext({ point: { x: 0.8, y: 0, z: 0.5 } }),
    );

    expect(result.state).toEqual({ kind: "idle" });
    expect(result.commit).toMatchObject({
      kind: "translateSolid",
      id: "box-1",
    });
    if (result.commit?.kind !== "translateSolid") return;
    expectClose(result.commit.dx, 0.55);
    expectClose(result.commit.dy, 0);
    expectClose(result.commit.dz, 0.25);
  });

  test("松手时位移不足一格：不提交", () => {
    const started = press();
    const result = upSelect3d(
      started.state,
      solidContext({ point: { x: 0.3, y: 0, z: 0.3 } }),
    );

    expect(result.state).toEqual({ kind: "idle" });
    expect(result.commit).toBeNull();
  });
});

describe("moveSelect3d / upSelect3d 参数体旋转", () => {
  function pressRotateY() {
    return startSelect3d(
      idleSelect3dState(),
      solidContext({
        selectionId: "box-1",
        hitId: "box-1",
        ray: rayHitting({ x: 0, y: 1.4, z: 0 }, { x: 1, y: -1, z: 0 }),
      }),
    );
  }

  test("绕 Y 拖 90°：预览与提交都只写 rotationDegY，另两轴保持 0", () => {
    const started = pressRotateY();
    const moveRay = rayHitting({ x: 0, y: 0, z: -1.4 }, { x: 0.3, y: -1, z: 0.1 });
    const moved = moveSelect3d(
      started.state,
      solidContext({ ray: moveRay }),
    );

    expect(moved.commit).toBeNull();
    expect(moved.preview).toMatchObject({
      kind: "box",
      anchor: { x: 0, y: 0, z: 0 },
      width: 1,
      depth: 1,
      height: 1,
    });
    if (moved.preview?.kind !== "box") return;
    expectClose(moved.preview.rotationDegY, 90);
    expectClose(moved.preview.rotationDegX, 0);
    expectClose(moved.preview.rotationDegZ, 0);

    const result = upSelect3d(moved.state, solidContext({ ray: moveRay }));
    expect(result.commit).toMatchObject({
      kind: "rotateSolid",
      id: "box-1",
      axis: "y",
    });
    if (result.commit?.kind !== "rotateSolid") return;
    expectClose(result.commit.deg, 90);
  });

  test("绕 X 旋转：从柄位方位起算的增量（圆柱可由此放倒）", () => {
    const started = startSelect3d(
      idleSelect3dState(),
      solidContext({
        document: doc3d([CYL_1]),
        selectionId: "cyl-1",
        hitId: "cyl-1",
        ray: rayHitting({ x: 0, y: 0.5, z: 0.9 }, { x: 0.3, y: -0.2, z: -1 }),
      }),
    );
    expect(started.state.kind).toBe("solid-rotate");

    const moveRay = rayHitting({ x: 0, y: 0, z: 2 }, { x: 0.3, y: -1, z: 0.2 });
    const moved = moveSelect3d(
      started.state,
      solidContext({ document: doc3d([CYL_1]), ray: moveRay }),
    );
    if (moved.preview?.kind !== "cylinder") return;
    const expected = 90 - (Math.atan2(0.9, 0.5) * 180) / Math.PI;
    expectClose(moved.preview.rotationDegX, expected);

    const result = upSelect3d(
      moved.state,
      solidContext({ document: doc3d([CYL_1]), ray: moveRay }),
    );
    if (result.commit?.kind !== "rotateSolid") return;
    expect(result.commit.axis).toBe("x");
    expectClose(result.commit.deg, expected);
  });

  test("转回原方位松手：不提交", () => {
    const started = pressRotateY();
    const result = upSelect3d(
      started.state,
      solidContext({
        ray: rayHitting({ x: 0, y: 1.4, z: 0 }, { x: 1, y: -1, z: 0 }),
      }),
    );

    expect(result.state).toEqual({ kind: "idle" });
    expect(result.commit).toBeNull();
  });
});

describe("moveSelect3d / upSelect3d 参数体缩放", () => {
  function pressScale() {
    return startSelect3d(
      idleSelect3dState(),
      solidContext({
        selectionId: "box-1",
        hitId: "box-1",
        ray: rayHitting({ x: 0.9, y: 0, z: 0.9 }, { x: 0, y: 0, z: 1 }),
      }),
    );
  }

  test("拉远一倍：预览与提交因子都是 2，锚点不动", () => {
    const started = pressScale();
    const moveRay = rayHitting({ x: 1.8, y: 0, z: 1.8 }, { x: 0, y: 0, z: 1 });
    const moved = moveSelect3d(started.state, solidContext({ ray: moveRay }));

    expect(moved.commit).toBeNull();
    expect(moved.preview).toMatchObject({
      kind: "box",
      anchor: { x: 0, y: 0, z: 0 },
      width: 2,
      depth: 2,
      height: 2,
    });

    const result = upSelect3d(moved.state, solidContext({ ray: moveRay }));
    expect(result.commit).toMatchObject({
      kind: "scaleSolid",
      id: "box-1",
    });
    if (result.commit?.kind !== "scaleSolid") return;
    expectClose(result.commit.factor, 2);
  });

  test("拉回原位松手：因子为 1 不提交", () => {
    const started = pressScale();
    const result = upSelect3d(
      started.state,
      solidContext({
        ray: rayHitting({ x: 0.9, y: 0, z: 0.9 }, { x: 0, y: 0, z: 1 }),
      }),
    );

    expect(result.state).toEqual({ kind: "idle" });
    expect(result.commit).toBeNull();
  });
});

describe("moveSelect3d / upSelect3d 参数体控制点", () => {
  function pressRadius() {
    return startSelect3d(
      idleSelect3dState(),
      solidContext({
        document: doc3d([CYL_1]),
        selectionId: "cyl-1",
        hitId: "cyl-1",
        ray: rayHitting({ x: 0.5, y: 0, z: 0 }, { x: 0, y: 1, z: 1 }),
      }),
    );
  }

  test("拖半径点：目标点先吃格，预览与提交只改 r", () => {
    const started = pressRadius();
    expect(started.state.kind).toBe("solid-control");

    const moveRay = rayHitting({ x: 2, y: 0, z: 0 }, { x: 0.3, y: -1, z: 0.2 });
    const moved = moveSelect3d(
      started.state,
      solidContext({ document: doc3d([CYL_1]), ray: moveRay }),
    );

    expect(moved.commit).toBeNull();
    expect(moved.preview).toMatchObject({
      kind: "cylinder",
      anchor: { x: 0, y: 0, z: 0 },
      r: 2,
      height: 1,
    });

    const result = upSelect3d(
      moved.state,
      solidContext({ document: doc3d([CYL_1]), ray: moveRay }),
    );
    expect(result.commit).toEqual({
      kind: "solidControlPoint",
      id: "cyl-1",
      pointId: "r",
      point: { x: 2, y: 0, z: 0 },
    });
  });

  test("拖回原位（关格时目标即原点）：不提交", () => {
    const started = pressRadius();
    const moveRay = rayHitting({ x: 0.5, y: 0, z: 0 }, { x: 0.3, y: -1, z: 0.2 });
    const result = upSelect3d(
      started.state,
      solidContext({ document: doc3d([CYL_1]), grid: "off", ray: moveRay }),
    );

    expect(result.state).toEqual({ kind: "idle" });
    expect(result.commit).toBeNull();
  });
});

describe("clickSelect3d 参数体", () => {
  test("单击命中参数体本体则选中；点空则取消", () => {
    const hit = clickSelect3d(
      idleSelect3dState(),
      solidContext({ hitId: "box-1" }),
    );
    expect(hit.selectionId).toBe("box-1");

    const miss = clickSelect3d(
      idleSelect3dState(),
      solidContext({ hitId: null, selectionId: "box-1" }),
    );
    expect(miss.selectionId).toBeNull();
  });

  test("单击落在控制点或柄上保持选中，不产生提交", () => {
    const onControl = clickSelect3d(
      idleSelect3dState(),
      solidContext({
        selectionId: "box-1",
        ray: rayHitting({ x: 0.5, y: 0, z: 0 }, { x: 0, y: 1, z: 1 }),
      }),
    );
    expect(onControl.selectionId).toBe("box-1");
    expect(onControl.commit).toBeNull();

    const onHandle = clickSelect3d(
      idleSelect3dState(),
      solidContext({
        selectionId: "box-1",
        ray: rayHitting({ x: 0.9, y: 0, z: 0.9 }, { x: 0, y: 0, z: 1 }),
      }),
    );
    expect(onHandle.selectionId).toBe("box-1");
    expect(onHandle.commit).toBeNull();
  });
});
