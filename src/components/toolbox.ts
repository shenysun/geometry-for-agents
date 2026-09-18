import type { EditorTool } from "../stores/editor.ts";
import { DRAW_TOOLS, type DrawTool } from "../viewport2d/draw-gesture.ts";
import {
  SOLID_TOOLS,
  type SolidToolId,
} from "../viewport3d/solid-commit.ts";

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
  // 函数曲线族：坐标轴（原点在左下的 L 形）+ 各自的解析图像。
  linearFunction: { paths: ["M2.5 2.5v11h11", "M4.5 11.5L12 4"] },
  quadraticFunction: { paths: ["M2.5 2.5v11h11", "M3.5 4.5Q8.5 14 13 5.5"] },
  inverseFunction: {
    paths: ["M2.5 2.5v11h11", "M5.5 3q-2.6 5 0 10", "M10.5 3q2.6 5 0 10"],
  },
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
  measureArea: {
    // 封闭形 + 形心处数值点：面积标注在源形心的直白图示。
    paths: ["M3 4.5h10v7H3z", "M7.25 8a0.75 0.75 0 1 0 1.5 0a0.75 0.75 0 1 0-1.5 0"],
  },
  measurePerimeter: {
    // 封闭形 + 上沿外侧的标注线：周长文本在源包围盒上方的直白图示。
    paths: ["M3 5.5h10v6.5H3z", "M4.5 2.5h7"],
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

/** 2D 分组小节 id，数组序即组序（spec toolbox-categories 钉死：线与弧→直边→曲线→度量→特殊） */
const GROUP_ORDER_2D = [
  "linesAndArcs",
  "straightShapes",
  "curvedShapes",
  "measurement",
  "special",
] as const;

/** 3D 分组小节 id：体素→参数体 */
const GROUP_ORDER_3D = ["voxels", "parametricSolids"] as const;

export type ToolGroupId2d = (typeof GROUP_ORDER_2D)[number];
export type ToolGroupId3d = (typeof GROUP_ORDER_3D)[number];
export type ToolGroupId = ToolGroupId2d | ToolGroupId3d;

/** 分组小节：类别 id + 组名词条 key（前缀独立于 tool.）+ 组内工具 */
export type ToolGroupSection = {
  readonly id: ToolGroupId;
  readonly labelKey: `toolGroup.${ToolGroupId}`;
  readonly tools: readonly ToolboxTool[];
};

/** 工具箱目录：选择工具单列置顶，创建工具归入分组小节 */
export type ToolboxCatalog = {
  readonly select: ToolboxTool;
  readonly groups: readonly ToolGroupSection[];
};

/** 2D 拾取工具 id（重叠填充 + 度量标注族）：目录与分组共用的收拢类型，
 *  新增拾取工具时只 widen 这一处。 */
type PickToolId = "overlapFill" | "measureArea" | "measurePerimeter";

/** 2D 创建工具全集：全部平面绘制工具 + 拾取工具族（ADR 0019 / 0020） */
const CREATION_TOOLS_2D: readonly (DrawTool | PickToolId)[] = [
  ...DRAW_TOOLS,
  "overlapFill",
  "measureArea",
  "measurePerimeter",
];

/** 3D 创建工具全集：单位立方体 + 全部参数体（名单与放置提交共用 SOLID_TOOLS） */
const CREATION_TOOLS_3D: readonly ("voxel" | SolidToolId)[] = [
  "voxel",
  ...SOLID_TOOLS,
];

/**
 * 2D 创建工具 → 分组。穷尽 Record：新增 DrawTool 不归类、组序数组删组导致类别消失，
 * 都在这里编译报错，从机制上杜绝「新工具落不进组」。
 */
const GROUP_BY_2D_TOOL: Record<
  DrawTool | PickToolId,
  ToolGroupId2d
> = {
  line: "linesAndArcs",
  arc: "linesAndArcs",
  polygon: "straightShapes",
  rectangle: "straightShapes",
  square: "straightShapes",
  triangle: "straightShapes",
  parallelogram: "straightShapes",
  trapezoid: "straightShapes",
  regularPolygon: "straightShapes",
  circle: "curvedShapes",
  sector: "curvedShapes",
  bow: "curvedShapes",
  ring: "curvedShapes",
  ellipse: "curvedShapes",
  linearFunction: "curvedShapes",
  quadraticFunction: "curvedShapes",
  inverseFunction: "curvedShapes",
  angle: "measurement",
  dimension: "measurement",
  label: "measurement",
  overlapFill: "special",
  measureArea: "measurement",
  measurePerimeter: "measurement",
};

/** 3D 创建工具 → 分组，穷尽 Record 同上 */
const GROUP_BY_3D_TOOL: Record<"voxel" | SolidToolId, ToolGroupId3d> = {
  voxel: "voxels",
  box: "parametricSolids",
  cylinder: "parametricSolids",
  cone: "parametricSolids",
  sphere: "parametricSolids",
  pyramid: "parametricSolids",
  triangularPrism: "parametricSolids",
};

function toolEntry(id: ToolboxToolId): ToolboxTool {
  return { id, labelKey: `tool.${id}`, icon: ICONS[id] };
}

/**
 * 按组序聚合创建工具：组内次序沿用创建工具全集的既有次序（分组纯增益、零重排）。
 * 空组不产出——渲染层因此永远不会为空组画标题（防御性规则，按构造当前不会触发）。
 */
function groupedSections<T extends ToolboxToolId, G extends ToolGroupId>(
  groupOrder: readonly G[],
  groupByTool: Record<T, G>,
  creationTools: readonly T[],
): ToolGroupSection[] {
  return groupOrder
    .map((id) => ({
      id,
      labelKey: `toolGroup.${id}` as const,
      tools: creationTools
        .filter((tool) => groupByTool[tool] === id)
        .map(toolEntry),
    }))
    .filter((group) => group.tools.length > 0);
}

/** 工具目录纯函数：输入空间，返回该空间工具箱的选择段与分组小节 */
export function catalogForSpace(space: "2d" | "3d"): ToolboxCatalog {
  return {
    select: toolEntry("select"),
    groups:
      space === "2d"
        ? groupedSections(GROUP_ORDER_2D, GROUP_BY_2D_TOOL, CREATION_TOOLS_2D)
        : groupedSections(GROUP_ORDER_3D, GROUP_BY_3D_TOOL, CREATION_TOOLS_3D),
  };
}
