import { describe, expect, test } from "vitest";
import { DRAW_TOOLS } from "../viewport2d/draw-gesture.ts";
import { SOLID_TOOLS } from "../viewport3d/solid-commit.ts";
import { catalogForSpace } from "./toolbox.ts";

describe("catalogForSpace（分组目录）", () => {
  test("2D：选择置顶单列，五组组序与各组成员整表钉死", () => {
    const { select, groups } = catalogForSpace("2d");

    expect(select.id).toBe("select");
    expect(groups.map((group) => group.id)).toEqual([
      "linesAndArcs",
      "straightShapes",
      "curvedShapes",
      "measurement",
      "special",
    ]);
    expect(groups.map((group) => group.tools.map((tool) => tool.id))).toEqual([
      ["line", "arc"],
      [
        "polygon",
        "rectangle",
        "square",
        "triangle",
        "parallelogram",
        "trapezoid",
        "regularPolygon",
      ],
      [
        "circle",
        "sector",
        "bow",
        "ring",
        "ellipse",
        "linearFunction",
        "quadraticFunction",
        "inverseFunction",
      ],
      ["angle", "dimension", "label", "measureArea", "measurePerimeter"],
      ["overlapFill", "translate", "rotate", "dilate", "reflect"],
    ]);
  });

  test("3D：选择置顶单列，两组组序与各组成员整表钉死", () => {
    const { select, groups } = catalogForSpace("3d");

    expect(select.id).toBe("select");
    expect(groups.map((group) => group.id)).toEqual([
      "voxels",
      "parametricSolids",
    ]);
    expect(groups.map((group) => group.tools.map((tool) => tool.id))).toEqual([
      ["voxel"],
      ["box", "cylinder", "cone", "sphere", "pyramid", "triangularPrism"],
    ]);
  });

  test("选择工具出现在置顶段，且不出现在任何分组里", () => {
    for (const space of ["2d", "3d"] as const) {
      const { select, groups } = catalogForSpace(space);

      expect(select.id).toBe("select");
      for (const group of groups) {
        expect(group.tools.map((tool) => tool.id)).not.toContain("select");
      }
    }
  });

  test("2D 全部创建工具恰好各归一组：无遗漏、无重复", () => {
    const grouped = catalogForSpace("2d").groups.flatMap((group) =>
      group.tools.map((tool) => tool.id),
    );

    expect(grouped.length).toBe(new Set(grouped).size);
    expect([...grouped].sort()).toEqual(
      [
        ...new Set([
          ...DRAW_TOOLS,
          "overlapFill",
          "measureArea",
          "measurePerimeter",
          "translate",
          "rotate",
          "dilate",
          "reflect",
        ]),
      ].sort(),
    );
  });

  test("3D 全部创建工具恰好各归一组：无遗漏、无重复", () => {
    const grouped = catalogForSpace("3d").groups.flatMap((group) =>
      group.tools.map((tool) => tool.id),
    );

    expect(grouped.length).toBe(new Set(grouped).size);
    expect([...grouped].sort()).toEqual(
      [...new Set(["voxel", ...SOLID_TOOLS])].sort(),
    );
  });

  test("2D 不含 voxel 与 3D 参数体工具；3D 不含 2D 创建工具", () => {
    const planar = [
      catalogForSpace("2d").select.id,
      ...catalogForSpace("2d").groups.flatMap((group) =>
        group.tools.map((tool) => tool.id),
      ),
    ];
    const solid = [
      catalogForSpace("3d").select.id,
      ...catalogForSpace("3d").groups.flatMap((group) =>
        group.tools.map((tool) => tool.id),
      ),
    ];

    for (const solidTool of ["voxel", ...SOLID_TOOLS]) {
      expect(planar).not.toContain(solidTool);
    }
    for (const drawTool of DRAW_TOOLS) {
      expect(solid).not.toContain(drawTool);
    }
  });

  test("每个分组带合法组名 key（toolGroup.前缀且与类别 id 对应），每个工具条目带 tool. 前缀 key 与图标数据", () => {
    for (const space of ["2d", "3d"] as const) {
      const { select, groups } = catalogForSpace(space);

      expect(select.labelKey).toBe(`tool.${select.id}`);
      expect(select.icon.paths.length).toBeGreaterThan(0);
      for (const group of groups) {
        expect(group.labelKey).toBe(`toolGroup.${group.id}`);
        for (const tool of group.tools) {
          expect(tool.labelKey.startsWith("tool.")).toBe(true);
          expect(tool.icon.paths.length).toBeGreaterThan(0);
          expect(tool.icon.paths.join(" ")).toMatch(/^[\dA-Za-z ,.\-]+$/);
        }
      }
    }
  });

  test("目录不产出空组（空组不渲染标题的机制保障）", () => {
    for (const space of ["2d", "3d"] as const) {
      for (const group of catalogForSpace(space).groups) {
        expect(group.tools.length).toBeGreaterThan(0);
      }
    }
  });
});
