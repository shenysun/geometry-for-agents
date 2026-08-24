import { describe, expect, test } from "vitest";
import {
  CLOSABLE_PANEL_IDS,
  PANEL_IDS,
  VIEWPORT_PANEL_ID,
  factoryLayoutSnapshot,
  sanitizeLayoutSnapshot,
  type LayoutSnapshot,
} from "./layout.ts";

/** 收集快照里每个叶子组的 views，按出现顺序 */
function leafViewsOf(snapshot: LayoutSnapshot): string[][] {
  const groups: string[][] = [];
  function visit(node: unknown): void {
    if (node === null || typeof node !== "object") return;
    const current = node as { type?: unknown; data?: unknown };
    if (current.type === "leaf") {
      const group = current.data as { views?: unknown } | undefined;
      groups.push(Array.isArray(group?.views) ? (group.views as string[]) : []);
      return;
    }
    if (Array.isArray(current.data)) {
      for (const child of current.data) visit(child);
    }
  }
  visit(snapshot.grid.root);
  return groups;
}

function allViewsOf(snapshot: LayoutSnapshot): string[] {
  return leafViewsOf(snapshot).flat();
}

/** 根 branch 的子节点（序列化里 data 是「组或子树数组」的联合） */
function rootChildrenOf(snapshot: LayoutSnapshot): unknown[] {
  return Array.isArray(snapshot.grid.root.data) ? snapshot.grid.root.data : [];
}

describe("factoryLayoutSnapshot", () => {
  test("出厂是五块全开的三列摆法", () => {
    const snapshot = factoryLayoutSnapshot();
    const views = allViewsOf(snapshot);

    expect([...views].sort()).toEqual([...PANEL_IDS].sort());
    // 左列上工具箱下对象列表，右列上属性下垫图
    expect(leafViewsOf(snapshot)).toEqual([
      ["toolbox", "object-list"],
      [VIEWPORT_PANEL_ID],
      ["properties", "underlay"],
    ]);
  });

  test("每次调用返回独立对象，改它不污染出厂", () => {
    const first = factoryLayoutSnapshot();
    first.panels.toolbox.contentComponent = "mutated";

    expect(factoryLayoutSnapshot().panels.toolbox.contentComponent).toBe("toolbox");
  });

  test("可关名单不含视口", () => {
    expect(CLOSABLE_PANEL_IDS).not.toContain(VIEWPORT_PANEL_ID);
    expect(PANEL_IDS).toContain(VIEWPORT_PANEL_ID);
  });
});

describe("sanitizeLayoutSnapshot", () => {
  test("无法解析或空白的字符串回出厂快照", () => {
    for (const bad of ["", "   ", "not-json", "{oops", "null", "42", '"str"', "[]", "[1,2]"]) {
      expect(sanitizeLayoutSnapshot(bad)).toEqual(factoryLayoutSnapshot());
    }
  });

  test("非字符串输入回出厂快照", () => {
    expect(sanitizeLayoutSnapshot(undefined)).toEqual(factoryLayoutSnapshot());
    expect(sanitizeLayoutSnapshot(null)).toEqual(factoryLayoutSnapshot());
    expect(sanitizeLayoutSnapshot(123)).toEqual(factoryLayoutSnapshot());
    expect(sanitizeLayoutSnapshot({ grid: {} })).toEqual(factoryLayoutSnapshot());
  });

  test("结构不合法（root 非 branch、缺 panels、引用未知面板）回出厂快照", () => {
    const noBranch = JSON.stringify({
      grid: { root: { type: "leaf", data: { views: [], id: "g" } }, height: 0, width: 0, orientation: "HORIZONTAL" },
      panels: {},
    });
    expect(sanitizeLayoutSnapshot(noBranch)).toEqual(factoryLayoutSnapshot());

    const noPanels = JSON.stringify({
      grid: { root: { type: "branch", data: [] }, height: 0, width: 0, orientation: "HORIZONTAL" },
    });
    expect(sanitizeLayoutSnapshot(noPanels)).toEqual(factoryLayoutSnapshot());

    const unknownPanel = JSON.stringify({
      grid: {
        root: {
          type: "branch",
          data: [{ type: "leaf", data: { id: "g", views: ["mystery"] }, size: 100 }],
        },
        height: 0,
        width: 0,
        orientation: "HORIZONTAL",
      },
      panels: { mystery: { id: "mystery", contentComponent: "mystery" } },
    });
    expect(sanitizeLayoutSnapshot(unknownPanel)).toEqual(factoryLayoutSnapshot());
  });

  test("缺视口记录的快照引用回出厂", () => {
    const snapshot = factoryLayoutSnapshot();
    const broken = { ...snapshot, panels: { ...snapshot.panels } };
    delete (broken.panels as Record<string, unknown>)[VIEWPORT_PANEL_ID];

    expect(sanitizeLayoutSnapshot(JSON.stringify(broken))).toEqual(factoryLayoutSnapshot());
  });

  test("含视口的合法快照原样往返", () => {
    const snapshot = factoryLayoutSnapshot();

    expect(sanitizeLayoutSnapshot(JSON.stringify(snapshot))).toEqual(snapshot);
  });

  test("快照缺视口时补回视口，其余摆法保留", () => {
    const snapshot = factoryLayoutSnapshot();
    // 模拟操作员关掉右列与视口后只剩左列的摆法
    const leftOnly = {
      ...snapshot,
      grid: {
        ...snapshot.grid,
        root: { ...snapshot.grid.root, data: [rootChildrenOf(snapshot)[0]] },
      },
      panels: {
        toolbox: snapshot.panels.toolbox,
        "object-list": snapshot.panels["object-list"],
      },
    };

    const sanitized = sanitizeLayoutSnapshot(JSON.stringify(leftOnly));

    const views = allViewsOf(sanitized);
    expect(views).toContain(VIEWPORT_PANEL_ID);
    // 操作员剩下的工具箱、对象列表摆法不被清掉
    expect(views).toContain("toolbox");
    expect(views).toContain("object-list");
    expect(sanitized.panels[VIEWPORT_PANEL_ID]).toBeDefined();
  });

  test("空树（没有叶子组）回出厂快照", () => {
    const emptyTree = JSON.stringify({
      grid: {
        root: { type: "branch", data: [{ type: "branch", data: [] }] },
        height: 0,
        width: 0,
        orientation: "HORIZONTAL",
      },
      panels: {},
    });

    expect(sanitizeLayoutSnapshot(emptyTree)).toEqual(factoryLayoutSnapshot());
  });
});
