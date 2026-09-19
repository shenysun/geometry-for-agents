import type { Primitive } from "../document/index.ts";

/** 翻译函数的结构形状：与 vue-i18n 的 Composer#t 兼容，测试里可注入假实现 */
export type Translate = (
  key: string,
  named?: Record<string, unknown>,
) => string;

/** 显示名基础词条 key：measure 与 functionCurve 按 kind 取词条，transform
 *  按 kind 复用工具词条（工具名即词条真源），其余类型复用 tool.<type>。 */
function baseKeyOf(primitive: Primitive): string {
  if (primitive.type === "measure") {
    return `tool.measure${primitive.kind === "area" ? "Area" : "Perimeter"}`;
  }
  if (primitive.type === "functionCurve") {
    return `tool.${primitive.kind}Function`;
  }
  if (primitive.type === "transform") {
    return `tool.${primitive.kind}`;
  }
  return `tool.${primitive.type}`;
}

/** 编号计数键：measure 与 functionCurve 按 kind 各自计数，transform 按
 *  kind 各自计数（平移、平移 1……与旋转各自独立编号），其余按类型。 */
function countKeyOf(primitive: Primitive): string {
  if (primitive.type === "measure") {
    return `measure:${primitive.kind}`;
  }
  if (primitive.type === "functionCurve") {
    return `functionCurve:${primitive.kind}`;
  }
  if (primitive.type === "transform") {
    return `transform:${primitive.kind}`;
  }
  return primitive.type;
}

/** id → 显示名：类型词条复用 tool.<type>（measure 按 kind），同类型按
 * 说明书顺序编号——首个不加号（圆），其后 objectName 插值（圆1、圆2）。
 * 展示层实时推导，不写进说明书；删除图元后重新推导即自动收紧。 */
export function displayNamesById(
  primitives: readonly Primitive[],
  t: Translate,
): ReadonlyMap<string, string> {
  const names = new Map<string, string>();
  const seenByType = new Map<string, number>();
  for (const primitive of primitives) {
    const key = countKeyOf(primitive);
    const index = seenByType.get(key) ?? 0;
    const base = t(baseKeyOf(primitive));
    names.set(
      primitive.id,
      index === 0 ? base : t("objectName", { name: base, n: index }),
    );
    seenByType.set(key, index + 1);
  }
  return names;
}
