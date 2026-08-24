import { describe, expect, test } from "vitest";
import { parseDocument, type GeometryDocument } from "../document/index.ts";
import { commitVoxel, translateVoxel } from "./voxel-commit.ts";

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

function empty3d() {
  return doc3d([]);
}

describe("commitVoxel", () => {
  test("commits a voxel whose min corner is integers only", () => {
    const commit = commitVoxel(
      empty3d(),
      { x: 1.4, y: 0.2, z: -0.5 },
      "voxel-1",
    );

    expect(commit).toEqual({
      id: "voxel-1",
      type: "voxel",
      x: 1,
      y: 0,
      z: -1,
    });
    expect(Number.isInteger(commit?.x)).toBe(true);
    expect(Number.isInteger(commit?.y)).toBe(true);
    expect(Number.isInteger(commit?.z)).toBe(true);
  });

  test("does not write a second voxel into an occupied cell", () => {
    const first = commitVoxel(empty3d(), { x: 0.2, y: 0.1, z: 0.9 }, "voxel-1");
    expect(first).not.toBeNull();
    if (first === null) return;

    const occupied = parseDocument({
      version: 1,
      space: "3d",
      underlay: null,
      primitives: [first],
    });
    if (!occupied.success) {
      throw new Error(occupied.error);
    }

    expect(commitVoxel(occupied.document, { x: 0.8, y: 0.4, z: 0.1 }, "voxel-2")).toBeNull();
  });

  test("refuses to commit a voxel into a 2d 说明书", () => {
    const parsed = parseDocument({
      version: 1,
      space: "2d",
      underlay: null,
      primitives: [],
    });
    if (!parsed.success) {
      throw new Error(parsed.error);
    }

    expect(commitVoxel(parsed.document, { x: 0, y: 0, z: 0 }, "voxel-1")).toBeNull();
  });
});

describe("translateVoxel", () => {
  test("整格平移返回新角体素，原体素对象不被改动", () => {
    const document = doc3d([
      { id: "voxel-1", type: "voxel", x: 0, y: 0, z: 0 },
      { id: "voxel-2", type: "voxel", x: 5, y: 0, z: 0 },
    ]);

    const moved = translateVoxel(document, "voxel-1", { x: 2, y: 1, z: -1 });

    expect(moved).toEqual({
      id: "voxel-1",
      type: "voxel",
      x: 2,
      y: 1,
      z: -1,
    });
    expect(document.primitives[0]).toEqual({
      id: "voxel-1",
      type: "voxel",
      x: 0,
      y: 0,
      z: 0,
    });
  });

  test("非整数位移按整数格取整：格 1/2、关与 Alt 都写不出半格体素", () => {
    const document = doc3d([
      { id: "voxel-1", type: "voxel", x: 0, y: 0, z: 0 },
    ]);

    const moved = translateVoxel(document, "voxel-1", {
      x: 0.4,
      y: 0.6,
      z: 0.5,
    });

    expect(moved).toEqual({
      id: "voxel-1",
      type: "voxel",
      x: 0,
      y: 1,
      z: 1,
    });
    expect(Number.isInteger(moved?.x)).toBe(true);
    expect(Number.isInteger(moved?.y)).toBe(true);
    expect(Number.isInteger(moved?.z)).toBe(true);
  });

  test("目标格已被其它体素占用则拒绝", () => {
    const document = doc3d([
      { id: "voxel-1", type: "voxel", x: 0, y: 0, z: 0 },
      { id: "voxel-2", type: "voxel", x: 1, y: 0, z: 0 },
    ]);

    expect(
      translateVoxel(document, "voxel-1", { x: 1, y: 0, z: 0 }),
    ).toBeNull();
  });

  test("平移回自己原格不算占用：零位移拒绝", () => {
    const document = doc3d([
      { id: "voxel-1", type: "voxel", x: 0, y: 0, z: 0 },
    ]);

    expect(
      translateVoxel(document, "voxel-1", { x: 0, y: 0, z: 0 }),
    ).toBeNull();
  });

  test("未知 id 与 2D 说明书都拒绝", () => {
    const document = doc3d([
      { id: "voxel-1", type: "voxel", x: 0, y: 0, z: 0 },
    ]);
    expect(
      translateVoxel(document, "voxel-9", { x: 1, y: 0, z: 0 }),
    ).toBeNull();

    const parsed = parseDocument({
      version: 1,
      space: "2d",
      underlay: null,
      primitives: [],
    });
    if (!parsed.success) {
      throw new Error(parsed.error);
    }
    expect(
      translateVoxel(parsed.document, "voxel-1", { x: 1, y: 0, z: 0 }),
    ).toBeNull();
  });
});
