import { describe, expect, test } from "vitest";
import { parseDocument, type GeometryDocument } from "../document/index.ts";
import {
  clickSelect3d,
  escSelect3d,
  idleSelect3dState,
  moveSelect3d,
  startSelect3d,
  upSelect3d,
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
    alt: false,
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

  test("命中的不是体素（票 11 前的参数体）：不选中也不拖", () => {
    const document = doc3d([
      { id: "box-1", type: "box", x: 0, y: 0, z: 0, width: 1, depth: 1, height: 1, rotationDegY: 0, rotationDegX: 0, rotationDegZ: 0 },
    ]);
    const result = startSelect3d(
      idleSelect3dState(),
      baseContext({ document, hitId: "box-1" }),
    );

    expect(result.state).toEqual({ kind: "idle" });
    expect(result.selectionId).toBeUndefined();
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

    const altHeld = moveSelect3d(
      started.state,
      baseContext({ point: { x: 2.6, y: 0.4, z: 3.6 }, alt: true }),
    );
    expect(altHeld.preview).toEqual(expected);
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
