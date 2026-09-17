import type { AnglePrimitive } from "./angle.ts";

/**
 * 度量数学纯函数层（ADR 0020）：渲染期推导值的唯一出口。
 * 数值不进契约——输入是图元的几何字段，输出是推导数值与显示文本，
 * 与 `dimension` 距离同构。面积/周长公式（measure 图元）在此扩展。
 */

/** 圆族（角/弧/扇形/弓形）的逆时针 sweep，落在 [0°,360°]。
 *  起止重合是退化点弧（0°）；差整周是整圆（360°）。角的零角/周角
 *  在契约层被拒，弧族允许退化，函数对两者保持全。 */
export function angleSweepDeg(startDeg: number, endDeg: number): number {
  if (startDeg === endDeg) return 0;
  const raw = (endDeg - startDeg) % 360;
  const sweep = raw < 0 ? raw + 360 : raw;
  return sweep === 0 ? 360 : sweep;
}

/** 统一数字格式化：两位小数四舍五入再去尾零（45、12.5、3.14），
 *  与尺寸标注线的显示完全一致；度数带 ° 后缀，面积/周长不带单位。 */
export function formatMeasureNumber(value: number): string {
  return String(Number(value.toFixed(2)));
}

/** 角的显示度数文本：推导 sweep 加 ° 后缀，随方向角实时联动。 */
export function angleDegreeText(angle: AnglePrimitive): string {
  return `${formatMeasureNumber(
    angleSweepDeg(angle.startDeg, angle.endDeg),
  )}°`;
}
