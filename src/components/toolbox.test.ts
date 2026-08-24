import { describe, expect, test } from "vitest";
import { DRAW_TOOLS } from "../viewport2d/draw-gesture.ts";
import { toolsForSpace } from "./toolbox.ts";

describe("toolsForSpace", () => {
  test("2D 目录 = 选择 + 第一期全部平面创建工具", () => {
    const ids = toolsForSpace("2d").map((tool) => tool.id);
    expect(ids).toEqual(["select", ...DRAW_TOOLS]);
  });

  test("3D 目录 = 选择 + 单位立方体 + 长方体；圆柱等参数体留给后面的票", () => {
    const ids = toolsForSpace("3d").map((tool) => tool.id);
    expect(ids).toEqual(["select", "voxel", "box"]);
  });

  test("2D 不含 voxel 与 box；3D 不含 2D 创建工具；都含 select", () => {
    const planar = toolsForSpace("2d").map((tool) => tool.id);
    const solid = toolsForSpace("3d").map((tool) => tool.id);

    expect(planar).not.toContain("voxel");
    expect(planar).not.toContain("box");
    for (const drawTool of DRAW_TOOLS) {
      expect(solid).not.toContain(drawTool);
    }
    expect(planar).toContain("select");
    expect(solid).toContain("select");
  });

  test("每项都带 i18n key 与图标数据", () => {
    for (const space of ["2d", "3d"] as const) {
      for (const tool of toolsForSpace(space)) {
        expect(tool.labelKey.startsWith("tool.")).toBe(true);
        expect(tool.icon.paths.length).toBeGreaterThan(0);
        expect(tool.icon.paths.join(" ")).toMatch(/^[\dA-Za-z ,.\-]+$/);
      }
    }
  });
});
