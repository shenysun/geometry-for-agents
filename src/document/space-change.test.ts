import { describe, expect, test } from "vitest";
import { parseDocument, planSpaceChange } from "./index.ts";
import type { GeometryDocument } from "./index.ts";

function mustParse(input: unknown): GeometryDocument {
  const result = parseDocument(input);
  if (!result.success) {
    throw new Error(result.error);
  }
  return result.document;
}

const empty2d = (): GeometryDocument =>
  mustParse({ version: 1, space: "2d", underlay: null, primitives: [] });

const empty3d = (): GeometryDocument =>
  mustParse({ version: 1, space: "3d", underlay: null, primitives: [] });

describe("planSpaceChange", () => {
  test("is a no-op when the requested space is already current", () => {
    expect(planSpaceChange(empty2d(), "2d")).toBe("noop");
    expect(planSpaceChange(empty3d(), "3d")).toBe("noop");
  });

  test("applies immediately when the 说明书 has no 图元", () => {
    expect(planSpaceChange(empty2d(), "3d")).toBe("apply");
    expect(planSpaceChange(empty3d(), "2d")).toBe("apply");
  });

  test("requires confirm-clear when 图元 exist and refuses silent conversion", () => {
    const withLine = mustParse({
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
      ],
    });
    const withVoxel = mustParse({
      version: 1,
      space: "3d",
      underlay: null,
      primitives: [{ id: "voxel-1", type: "voxel", x: 0, y: 0, z: 0 }],
    });

    expect(planSpaceChange(withLine, "3d")).toBe("confirm-clear");
    expect(planSpaceChange(withVoxel, "2d")).toBe("confirm-clear");
    expect(planSpaceChange(withLine, "2d")).toBe("noop");
  });
});
