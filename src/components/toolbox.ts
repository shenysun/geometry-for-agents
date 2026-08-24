import type { EditorTool } from "../stores/editor.ts";
import { DRAW_TOOLS, type DrawTool } from "../viewport2d/draw-gesture.ts";

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
  voxel: {
    paths: ["M8 2l5 2.8v6.4L8 14l-5-2.8V4.8z", "M3 4.8L8 7.6l5-2.8", "M8 7.6V14"],
  },
};

/** 每个空间列出的工具次序：选择永远第一，创建工具跟在后面 */
const TOOLS_PER_SPACE: Record<"2d" | "3d", readonly ToolboxToolId[]> = {
  // 2D：选择 + 第一期全部平面创建工具
  "2d": ["select", ...DRAW_TOOLS],
  // 3D：选择 + 单位立方体；参数体是后面的票
  "3d": ["select", "voxel"],
};

/** 工具目录纯函数：输入空间，返回该空间工具箱应列出的工具 */
export function toolsForSpace(space: "2d" | "3d"): readonly ToolboxTool[] {
  return TOOLS_PER_SPACE[space].map((id) => ({
    id,
    labelKey: `tool.${id}`,
    icon: ICONS[id],
  }));
}
