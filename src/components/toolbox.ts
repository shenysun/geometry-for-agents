import type { EditorTool } from "../stores/editor.ts";
import { DRAW_TOOLS, type DrawTool } from "../viewport2d/draw-gesture.ts";
import { SOLID_TOOLS } from "../viewport3d/solid-commit.ts";

/** 工具箱里可点选的工具 id，就是编辑器当前工具去掉「未拿工具」 */
export type ToolboxToolId = Exclude<EditorTool, null>;

/** 内联 SVG 图标：16×16 描边 path，currentColor 上色 */
export type ToolboxIcon = {
  readonly paths: readonly string[];
};

export type ToolboxTool = {
  readonly id: ToolboxToolId;
  readonly labelKey: `tool.${ToolboxToolId}`;
  readonly icon: ToolboxIcon;
};

const ICONS: Record<ToolboxToolId, ToolboxIcon> = {
  select: { paths: ["M4 2l7.5 6.4-3.4.3 1.9 4-1.9.9-1.9-4L4 12z"] },
  line: {
    paths: [
      "M3 13L13 3",
      "M4 11.5a1.5 1.5 0 1 0 3 0a1.5 1.5 0 1 0-3 0",
      "M10.5 4.5a1.5 1.5 0 1 0 3 0a1.5 1.5 0 1 0-3 0",
    ],
  },
  polygon: { paths: ["M8 2.5l5.2 3.8-2 6.2H4.8l-2-6.2z"] },
  rectangle: { paths: ["M3 4.5h10v7H3z"] },
  square: { paths: ["M4.5 4.5h7v7h-7z"] },
  triangle: { paths: ["M8 3l5 9.5H3z"] },
  parallelogram: { paths: ["M4.5 11.5l2-7h8l-2 7z"] },
  trapezoid: { paths: ["M4.5 11.5l1.6-7h4l1.6 7z"] },
  angle: {
    paths: ["M3 12L13 4", "M3 12h9", "M7 12A4 4 0 0 0 6.1 9.5"],
  },
  regularPolygon: { paths: ["M8 2.5l5.2 3.8-2 6.2H4.8l-2-6.2z"] },
  dimension: {
    paths: [
      "M2.5 11.5h11",
      "M4.5 9.5l-2 2 2 2",
      "M11.5 9.5l2 2-2 2",
      "M6 8.5h4v3H6z",
    ],
  },
  circle: { paths: ["M3 8a5 5 0 1 0 10 0a5 5 0 1 0-10 0"] },
  sector: { paths: ["M8 13L4 9a6 6 0 0 1 8.5-3.5z"] },
  bow: { paths: ["M3 11a5.2 5.2 0 0 1 10 0z"] },
  arc: { paths: ["M3 12a7 7 0 0 1 10-5"] },
  ring: {
    paths: [
      "M3 8a5 5 0 1 0 10 0a5 5 0 1 0-10 0",
      "M6.5 8a1.5 1.5 0 1 0 3 0a1.5 1.5 0 1 0-3 0",
    ],
  },
  ellipse: { paths: ["M2.5 8a5.5 3.5 0 1 0 11 0a5.5 3.5 0 1 0-11 0"] },
  label: { paths: ["M5 12L8 4l3 8", "M6 9.5h4"] },
  overlapFill: {
    // 两交叠圆 + 交集处斜线：引用式阴影的直白图示。
    paths: [
      "M3.5 7a3.5 3.5 0 1 0 7 0a3.5 3.5 0 1 0-7 0",
      "M5.5 7a3.5 3.5 0 1 0 7 0a3.5 3.5 0 1 0-7 0",
      "M6.8 4.6l2.4 2.4",
      "M6 6.2l1.6 1.6",
    ],
  },
  voxel: {
    paths: ["M8 2l5 2.8v6.4L8 14l-5-2.8V4.8z", "M3 4.8L8 7.6l5-2.8", "M8 7.6V14"],
  },
  box: {
    paths: ["M2 6.5L10 3.5L14 5L6 8z", "M2 6.5V11.5L6 13.5V8", "M14 5V10L6 13.5"],
  },
  cylinder: {
    paths: [
      "M3 5a5 2 0 1 0 10 0a5 2 0 1 0-10 0",
      "M3 5v6",
      "M13 5v6",
      "M3 11a5 2 0 0 0 10 0",
    ],
  },
  cone: {
    paths: ["M8 2L3 11.5", "M8 2l5 9.5", "M3 11.5a5 1.8 0 0 0 10 0"],
  },
  sphere: {
    paths: [
      "M3 8a5 5 0 1 0 10 0a5 5 0 1 0-10 0",
      "M3.2 8a4.8 2.1 0 0 0 9.6 0",
    ],
  },
  pyramid: {
    paths: ["M8 2.5L13.5 11.5L8 13.5L2.5 11.5z", "M8 2.5L8 13.5"],
  },
  triangularPrism: {
    paths: [
      "M2.5 11L7.5 3.5V11z",
      "M7.5 3.5l5 1.5",
      "M7.5 11l5 1.5",
      "M12.5 5V12.5",
    ],
  },
};

/** 每个空间列出的工具次序：选择永远第一，创建工具跟在后面 */
const TOOLS_PER_SPACE: Record<"2d" | "3d", readonly ToolboxToolId[]> = {
  // 2D：选择 + 全部平面创建工具 + 重叠填充拾取（ADR 0019，二期图元）
  "2d": ["select", ...DRAW_TOOLS, "overlapFill"],
  // 3D：选择 + 单位立方体 + 全部参数体（名单与放置提交共用 SOLID_TOOLS）
  "3d": ["select", "voxel", ...SOLID_TOOLS],
};

/** 工具目录纯函数：输入空间，返回该空间工具箱应列出的工具 */
export function toolsForSpace(space: "2d" | "3d"): readonly ToolboxTool[] {
  return TOOLS_PER_SPACE[space].map((id) => ({
    id,
    labelKey: `tool.${id}`,
    icon: ICONS[id],
  }));
}
