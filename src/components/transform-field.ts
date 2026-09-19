import { truncateToPrecision } from "./numeric-precision.ts";
import {
  transformParamOf,
  type TransformParamKey,
  type TransformParams,
} from "../document/transform-math.ts";
import type { TransformPrimitive } from "../document/parse-document.ts";

/**
 * 变换图元参数字段（ADR 0022 / 票 05）：属性面板数字框与滑块共用的纯
 * 校验层——两位小数截断、退化值拒绝（文案键指明替代，不静默钳制）、
 * 滑块域钳端点、角度显示归一。接缝形态与 function-curve-field 同构
 * （ADR 0021 先例）：退化判定比函数曲线多一档语境——translate 的零向量
 * 与 reflect 的轴端点重合都是跨字段退化，校验要带上契约条目的现值。
 */

/** 角度滑块域 0–360°、步长 1°：显示归一后落在域内（US 30），拖动扫过
 *  整圈；0 与 360 都是端点，预览放行穿越、松手停在整周才被拒。 */
export const ANGLE_SLIDER_RANGE = { min: 0, max: 360, step: 1 } as const;

/** 比滑块域 [-5, 5]、步长 0.1：负比可达（异侧位似），连续扫过 0 与 1
 *  （预览放行，松手停在退化值才被拒）。输入域宽于滑块域：超范围数值
 *  保留在契约里，只有滑块柄贴端点。 */
export const RATIO_SLIDER_RANGE = { min: -5, max: 5, step: 0.1 } as const;

/** 角度显示归一 0–360°（US 30）：存储保符号（正为逆时针、负值原样），
 *  归一只发生在显示层——面板读数符合数学惯例，契约值不动。 */
export function normalizeAngleDeg(value: number): number {
  return ((value % 360) + 360) % 360;
}

export type TransformParamValidation =
  | { status: "ok"; value: number }
  | { status: "rejected"; reason: "not-number" }
  | { status: "rejected"; reason: "degenerate"; errorKey: string };

/** 参数提交校验：截断到两位小数后查退化（像与源重合即无意义，规则与
 *  契约层 refine 同款）。中心/轴端点坐标任意值合法；退化只看——平移
 *  零向量（结合条目另一分量）、旋转角 360° 整倍数、位似比 0 或 1、
 *  轴两端点重合（结合条目另一端坐标）。 */
export function validateTransformParam(
  entry: TransformPrimitive,
  key: TransformParamKey,
  value: number,
): TransformParamValidation {
  if (!Number.isFinite(value)) {
    return { status: "rejected", reason: "not-number" };
  }
  const truncated = truncateToPrecision(value);
  switch (entry.kind) {
    case "translate":
      if (
        (key === "dx" || key === "dy") &&
        truncated === 0 &&
        truncateToPrecision(key === "dx" ? entry.dy : entry.dx) === 0
      ) {
        return {
          status: "rejected",
          reason: "degenerate",
          errorKey: "paramError.translateZero",
        };
      }
      break;
    case "rotate":
      if (key === "angleDeg" && truncated % 360 === 0) {
        return {
          status: "rejected",
          reason: "degenerate",
          errorKey: "paramError.rotateZero",
        };
      }
      break;
    case "reflect":
      if (movesEndpointOntoOther(entry, key, truncated)) {
        return {
          status: "rejected",
          reason: "degenerate",
          errorKey: "paramError.reflectAxis",
        };
      }
      break;
    case "dilate":
      if (key === "ratio" && (truncated === 0 || truncated === 1)) {
        return {
          status: "rejected",
          reason: "degenerate",
          errorKey: "paramError.dilateRatio",
        };
      }
      break;
  }
  return { status: "ok", value: truncated };
}

/** 轴端点退化的跨字段判定：把截断后的新坐标代回，看这一端是否整个撞上
 *  另一端（单坐标相等不退化——竖直/水平轴是常见题面）。 */
function movesEndpointOntoOther(
  entry: Extract<TransformPrimitive, { kind: "reflect" }>,
  key: TransformParamKey,
  truncated: number,
): boolean {
  switch (key) {
    case "x1":
      return truncated === entry.x2 && entry.y1 === entry.y2;
    case "y1":
      return entry.x1 === entry.x2 && truncated === entry.y2;
    case "x2":
      return truncated === entry.x1 && entry.y1 === entry.y2;
    case "y2":
      return entry.x1 === entry.x2 && truncated === entry.y1;
    default:
      return false;
  }
}

/** 面板字段的展示文本：angleDeg 归一到 0–360 再截断，其余直接截断
 *  （拖动中的预览值同样处理，不带浮点尾巴）。 */
export function transformParamDisplayText(
  params: TransformParams,
  key: TransformParamKey,
): string {
  const value = transformParamOf(params, key);
  return String(
    truncateToPrecision(key === "angleDeg" ? normalizeAngleDeg(value) : value),
  );
}
