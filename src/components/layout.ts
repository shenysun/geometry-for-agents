import { Orientation, type SerializedDockview } from "dockview-vue";

/** 五块面板的 id：工具箱、对象列表、视口、属性面板、垫图 */
export const PANEL_IDS = [
  "toolbox",
  "object-list",
  "viewport",
  "properties",
  "underlay",
] as const;

export type PanelId = (typeof PANEL_IDS)[number];

/** 视口永不可关 */
export const VIEWPORT_PANEL_ID = "viewport";

/** 可以关掉再从顶栏开回来的四块面板 */
export const CLOSABLE_PANEL_IDS = [
  "toolbox",
  "object-list",
  "properties",
  "underlay",
] as const;

export type ClosablePanelId = (typeof CLOSABLE_PANEL_IDS)[number];

/** 面板 id → i18n 标题 key，标签页与顶栏勾选共用 */
export const PANEL_TITLE_KEYS: Record<PanelId, string> = {
  toolbox: "panel.toolbox",
  "object-list": "panel.objectList",
  viewport: "panel.viewport",
  properties: "panel.properties",
  underlay: "panel.underlay",
};

/** 本机 localStorage 的快照键；布局只存在这台浏览器里 */
export const LAYOUT_STORAGE_KEY = "geometry-helpers.layout.v1";

export type LayoutSnapshot = SerializedDockview;

type GridNode = { type: unknown; data: unknown };
type LeafGroup = { views?: unknown; activeView?: unknown; id?: unknown };

/**
 * 出厂摆法：左列上工具箱下对象列表，中视口，右列上属性面板下垫图。
 * 每次返回独立对象，调用方可以放心改。
 */
export function factoryLayoutSnapshot(): LayoutSnapshot {
  return {
    grid: {
      root: {
        type: "branch",
        data: [
          {
            type: "leaf",
            data: { id: "left", views: ["toolbox", "object-list"], activeView: "toolbox" },
            size: 240,
          },
          {
            type: "leaf",
            data: { id: "center", views: [VIEWPORT_PANEL_ID], activeView: VIEWPORT_PANEL_ID },
            size: 600,
          },
          {
            type: "leaf",
            data: { id: "right", views: ["properties", "underlay"], activeView: "properties" },
            size: 320,
          },
        ],
      },
      height: 0,
      width: 0,
      orientation: Orientation.HORIZONTAL,
    },
    panels: {
      toolbox: { id: "toolbox", contentComponent: "toolbox" },
      "object-list": { id: "object-list", contentComponent: "object-list", minimumWidth: 180 },
      viewport: { id: VIEWPORT_PANEL_ID, contentComponent: VIEWPORT_PANEL_ID },
      properties: { id: "properties", contentComponent: "properties" },
      underlay: { id: "underlay", contentComponent: "underlay" },
    },
    activeGroup: "center",
  };
}

/**
 * 把 localStorage 里的原始值修成可用快照：
 * 损坏、无法解析、结构不合法、引用未知面板 → 出厂快照；
 * 合法但缺视口 → 在第一个叶子组里补回视口（视口永不可关）。
 */
export function sanitizeLayoutSnapshot(raw: unknown): LayoutSnapshot {
  if (typeof raw !== "string" || raw.trim() === "") return factoryLayoutSnapshot();

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return factoryLayoutSnapshot();
  }
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    return factoryLayoutSnapshot();
  }

  const candidate = parsed as Partial<LayoutSnapshot>;
  const panels = candidate.panels;
  if (
    panels === undefined ||
    typeof panels !== "object" ||
    Array.isArray(panels) ||
    !isBranchNode(candidate.grid?.root)
  ) {
    return factoryLayoutSnapshot();
  }

  const leaves = collectLeaves(candidate.grid?.root as GridNode);
  if (leaves.length === 0) return factoryLayoutSnapshot();

  const knownPanelIds = new Set<string>(PANEL_IDS);
  for (const group of leaves) {
    if (!Array.isArray(group.views)) return factoryLayoutSnapshot();
    for (const panelId of group.views) {
      // 名单外的面板 id（旧版本遗留等）一律视为损坏
      if (typeof panelId !== "string" || !knownPanelIds.has(panelId) || !(panelId in panels)) {
        return factoryLayoutSnapshot();
      }
    }
  }

  const referenced = new Set(leaves.flatMap((group) => group.views as string[]));
  if (referenced.has(VIEWPORT_PANEL_ID)) {
    return candidate as LayoutSnapshot;
  }

  // 快照缺视口：补进第一个叶子组，保住操作员其余摆法
  const firstGroup = leaves[0];
  (firstGroup.views as string[]).push(VIEWPORT_PANEL_ID);
  if (firstGroup.activeView === undefined) {
    firstGroup.activeView = VIEWPORT_PANEL_ID;
  }
  panels[VIEWPORT_PANEL_ID] = { id: VIEWPORT_PANEL_ID, contentComponent: VIEWPORT_PANEL_ID };
  return candidate as LayoutSnapshot;
}

function isBranchNode(node: unknown): node is GridNode {
  return (
    typeof node === "object" &&
    node !== null &&
    (node as GridNode).type === "branch" &&
    Array.isArray((node as GridNode).data)
  );
}

/** 深度优先收集树里全部叶子组的 data（原地引用，便于补回时写入） */
function collectLeaves(node: GridNode): LeafGroup[] {
  const groups: LeafGroup[] = [];
  function visit(current: GridNode): void {
    if (current.type === "leaf") {
      const group = current.data;
      if (typeof group === "object" && group !== null) groups.push(group as LeafGroup);
      return;
    }
    if (Array.isArray(current.data)) {
      for (const child of current.data) {
        if (typeof child === "object" && child !== null) visit(child as GridNode);
      }
    }
  }
  visit(node);
  return groups;
}
