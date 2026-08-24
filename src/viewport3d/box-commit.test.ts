import { describe, expect, test } from "vitest";
import { parseDocument, type GeometryDocument } from "../document/index.ts";
import { boxAnchorFromWorld, commitBox } from "./box-commit.ts";

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

  test("boxAnchorFromWorld 就是吸附后的底面中心", () => {
    expect(boxAnchorFromWorld({ x: 1.4, y: 0.2, z: -0.6 }, 1)).toEqual({
      x: 1,
      y: 0,
      z: -1,
    });
  });
});
