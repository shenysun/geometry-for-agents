import { describe, expect, test } from "vitest";
import { DRAW_TOOLS } from "../viewport2d/draw-gesture.ts";
import { toolsForSpace } from "./toolbox.ts";

describe("toolsForSpace", () => {
  test("2D 目录 = 选择 + 第一期全部平面创建工具", () => {
    const ids = toolsForSpace("2d").map((tool) => tool.id);
    expect(ids).toEqual(["select", ...DRAW_TOOLS]);
  });

  test("3D 目录 = 选择 + 单位立方体 + 全部参数体（长方体、圆柱、圆锥、球、四棱锥、三棱柱）", () => {
    const ids = toolsForSpace("3d").map((tool) => tool.id);
    expect(ids).toEqual([
      "select",
      "voxel",
      "box",
      "cylinder",
      "cone",
      "sphere",
      "pyramid",
      "triangularPrism",
    ]);
  });

  test("2D 不含 voxel 与 3D 参数体工具；3D 不含 2D 创建工具；都含 select", () => {
    const planar = toolsForSpace("2d").map((tool) => tool.id);
    const solid = toolsForSpace("3d").map((tool) => tool.id);

    for (const solidTool of [
      "voxel",
      "box",
      "cylinder",
      "cone",
      "sphere",
      "pyramid",
      "triangularPrism",
    ]) {
      expect(planar).not.toContain(solidTool);
    }
    for (const drawTool of DRAW_TOOLS) {
      expect(solid).not.toContain(drawTool);
    }
    expect(planar).toContain("select");
    expect(solid).toContain("select");
  });

  test("2D 目录含 rectangle 且紧跟 polygon（与线段/多边形相邻），3D 不含", () => {
    const planar = toolsForSpace("2d").map((tool) => tool.id);
    const solid = toolsForSpace("3d").map((tool) => tool.id);

    expect(planar).toContain("rectangle");
    expect(planar.indexOf("rectangle")).toBe(planar.indexOf("polygon") + 1);
    expect(solid).not.toContain("rectangle");
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
