import type { EditorTool } from "../stores/editor.ts";

/** 按键事件里快捷键关心的部分；Pick 使测试不必构造完整 KeyboardEvent。 */
export type ShortcutEvent = Pick<
  KeyboardEvent,
  "key" | "shiftKey" | "metaKey" | "ctrlKey" | "altKey"
>;

/** ADR 0018 键位表：单键 → 工具，按空间分表，表里没有的键即不属于该空间。 */
const SINGLE_KEY_SHORTCUTS: Record<"2d" | "3d", Record<string, EditorTool>> = {
  "2d": {
    v: "select",
    l: "line",
    r: "rectangle",
    o: "ellipse",
    c: "circle",
    a: "arc",
    s: "sector",
    t: "label",
    d: "dimension",
    g: "angle",
    p: "polygon",
    n: "regularPolygon",
    z: "trapezoid",
    f: "overlapFill",
    m: "measureArea",
  },
  "3d": {
    v: "select",
    b: "voxel",
  },
};

/** Shift+键 → 同族变体；表里没有的组合回退到单键。 */
const SHIFT_COMBOS: Record<"2d" | "3d", Record<string, EditorTool>> = {
  "2d": {
    r: "square",
    c: "ring",
    a: "bow",
    t: "triangle",
    p: "parallelogram",
    m: "measurePerimeter",
  },
  "3d": {
    b: "box",
  },
};

export function toolFromShortcut(
  event: ShortcutEvent,
  space: "2d" | "3d",
): EditorTool | null {
  // Shift 之外 的修饰键归浏览器快捷键与既有职责（如 Alt 暂时不落格）。
  if (event.metaKey || event.ctrlKey || event.altKey) {
    return null;
  }
  const key = event.key.toLowerCase();
  if (event.shiftKey) {
    return SHIFT_COMBOS[space][key] ?? SINGLE_KEY_SHORTCUTS[space][key] ?? null;
  }
  return SINGLE_KEY_SHORTCUTS[space][key] ?? null;
}

/** 键盘快捷键不得打断文字输入：输入框、文本域、可编辑元素内不触发。 */
export function isTypingTarget(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    (target instanceof HTMLElement && target.isContentEditable)
  );
}
