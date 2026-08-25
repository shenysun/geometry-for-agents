import type { Primitive } from "../document/index.ts";

/** 翻译函数的结构形状：与 vue-i18n 的 Composer#t 兼容，测试里可注入假实现 */
export type Translate = (
  key: string,
  named?: Record<string, unknown>,
) => string;

/** id → 显示名：类型词条复用 tool.<type>，同类型按说明书顺序编号——
 * 首个不加号（圆），其后 objectName 插值（圆1、圆2）。展示层实时推导，
 * 不写进说明书；删除图元后重新推导即自动收紧。 */
export function displayNamesById(
  primitives: readonly Primitive[],
  t: Translate,
): ReadonlyMap<string, string> {
  const names = new Map<string, string>();
  const seenByType = new Map<Primitive["type"], number>();
  for (const primitive of primitives) {
    const index = seenByType.get(primitive.type) ?? 0;
    const base = t(`tool.${primitive.type}`);
    names.set(
      primitive.id,
      index === 0 ? base : t("objectName", { name: base, n: index }),
    );
    seenByType.set(primitive.type, index + 1);
  }
  return names;
}
