import { describe, expect, test } from "vitest";
import { isTypingTarget, toolFromShortcut } from "./tool-shortcuts.ts";

/** 测试用按键事件：未写的修饰键默认未按下。 */
function key(
  key: string,
  modifiers: {
    shift?: boolean;
    meta?: boolean;
    ctrl?: boolean;
    alt?: boolean;
  } = {},
): Parameters<typeof toolFromShortcut>[0] {
  return {
    key,
    shiftKey: modifiers.shift ?? false,
    metaKey: modifiers.meta ?? false,
    ctrlKey: modifiers.ctrl ?? false,
    altKey: modifiers.alt ?? false,
  };
}

describe("toolFromShortcut", () => {
  test("V 切换到选择工具，2D 与 3D 都生效", () => {
    expect(toolFromShortcut(key("v"), "2d")).toBe("select");
    expect(toolFromShortcut(key("v"), "3d")).toBe("select");
  });

  test.each([
    ["l", "line"],
    ["r", "rectangle"],
    ["o", "ellipse"],
    ["c", "circle"],
    ["a", "arc"],
    ["s", "sector"],
    ["t", "label"],
    ["d", "dimension"],
    ["g", "angle"],
    ["p", "polygon"],
    ["n", "regularPolygon"],
    ["z", "trapezoid"],
    ["f", "overlapFill"],
    // M 归平移、E 归旋转（ADR 0022 键位裁决，ADR 0018 表已补行）：度量
    // 标注工具让出 M/Shift+M、暂无单键（点工具箱），补键待 PO 复核。
    ["m", "translate"],
    ["e", "rotate"],
  ] as const)("2D 单键 %s → %s", (pressed, tool) => {
    expect(toolFromShortcut(key(pressed), "2d")).toBe(tool);
  });

  test.each([
    ["R", "square"],
    ["C", "ring"],
    ["A", "bow"],
    ["T", "triangle"],
    ["P", "parallelogram"],
    // Shift+E 位似（票 03）：Shift 同族规则——E 是旋转变体族之根。
    ["E", "dilate"],
  ] as const)("2D Shift+%s → %s（同族变体）", (pressed, tool) => {
    expect(toolFromShortcut(key(pressed, { shift: true }), "2d")).toBe(tool);
  });

  test("函数曲线三键：Q 二次函数、H 反比例函数、Shift+L 一次函数（ADR 0018）", () => {
    expect(toolFromShortcut(key("q"), "2d")).toBe("quadraticFunction");
    expect(toolFromShortcut(key("h"), "2d")).toBe("inverseFunction");
    expect(toolFromShortcut(key("L", { shift: true }), "2d")).toBe(
      "linearFunction",
    );
  });

  test("Shift 组合未定义时回退到单键：Shift+O 仍是椭圆", () => {
    expect(toolFromShortcut(key("O", { shift: true }), "2d")).toBe("ellipse");
  });

  test("3D：B → 体素，Shift+B → 长方体", () => {
    expect(toolFromShortcut(key("b"), "3d")).toBe("voxel");
    expect(toolFromShortcut(key("B", { shift: true }), "3d")).toBe("box");
  });

  test("不属于当前空间的键返回 null：2D 按 B、3D 按 R", () => {
    expect(toolFromShortcut(key("b"), "2d")).toBeNull();
    expect(toolFromShortcut(key("r"), "3d")).toBeNull();
  });

  test("没有键位的键返回 null", () => {
    expect(toolFromShortcut(key("x"), "2d")).toBeNull();
    expect(toolFromShortcut(key("x"), "3d")).toBeNull();
  });

  test("Meta/Ctrl/Alt 组合键属于浏览器或既有职责，不切工具", () => {
    expect(toolFromShortcut(key("r", { meta: true }), "2d")).toBeNull();
    expect(toolFromShortcut(key("l", { ctrl: true }), "2d")).toBeNull();
    expect(toolFromShortcut(key("c", { alt: true }), "2d")).toBeNull();
  });
});

describe("isTypingTarget", () => {
  test("输入框、文本域、可编辑元素里不触发快捷键", () => {
    const input = document.createElement("input");
    const textarea = document.createElement("textarea");
    const editable = document.createElement("div");
    editable.contentEditable = "true";
    expect(isTypingTarget(input)).toBe(true);
    expect(isTypingTarget(textarea)).toBe(true);
    expect(isTypingTarget(editable)).toBe(true);
  });

  test("普通元素与空目标不是输入目标", () => {
    const div = document.createElement("div");
    expect(isTypingTarget(div)).toBe(false);
    expect(isTypingTarget(null)).toBe(false);
  });
});
