import { describe, expect, test } from "vitest";
import { parseDocument } from "../document/index.ts";
import { commitVoxel } from "./voxel-commit.ts";

function empty3d() {
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
