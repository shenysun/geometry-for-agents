import { truncateToPrecision } from "./numeric-precision.ts";
import type {
  FunctionCurveKind,
  FunctionCurveParamKey,
} from "../document/function-curve.ts";

/**
 * 函数曲线参数字段（ADR 0021 / 票 03）：属性面板滑块 + 数字框共用的
 * 纯校验层——两位小数截断、退化值拒绝（文案键指明替代路径）、滑块域
 * 钳端点。输入域宽于滑块域是 PO 认可的明确设计：超范围数值保留在
 * 契约里，只有滑块柄贴端点。
 */

/** 滑块域 [-10, 10]、步长 0.1，含负数（k 可为负、双曲线落二三象限）。 */
export const SLIDER_RANGE = { min: -10, max: 10, step: 0.1 } as const;

/** 数字输入的步进粒度与滑块一致，键盘可达主通道一次一提交。 */
export const NUMBER_STEP = 0.1;

/** 滑块柄钳端点：数值本身不动，只把柄的位置夹进滑块域。 */
export function clampToSliderRange(value: number): number {
  return Math.min(SLIDER_RANGE.max, Math.max(SLIDER_RANGE.min, value));
}

/** 退化首项（kind, 键）→ 报错文案键：文案指明替代路径，不静默钳制。 */
const DEGENERATE_ERROR_KEYS: Partial<
  Record<`${FunctionCurveKind}:${string}`, string>
> = {
  "linear:a": "paramError.linearA",
  "quadratic:a": "paramError.quadraticA",
  "inverse:k": "paramError.inverseK",
};

export type FunctionCurveParamValidation =
  | { status: "ok"; value: number }
  | { status: "rejected"; reason: "not-number" }
  | { status: "rejected"; reason: "degenerate"; errorKey: string };

/** 参数提交校验：截断到两位小数后查退化（一次/二次 a=0、反比例 k=0）。
 *  非首项（b、c）的 0 是合法值，由契约层正常收下。 */
export function validateFunctionCurveParam(
  kind: FunctionCurveKind,
  key: FunctionCurveParamKey,
  value: number,
): FunctionCurveParamValidation {
  if (!Number.isFinite(value)) {
    return { status: "rejected", reason: "not-number" };
  }
  const truncated = truncateToPrecision(value);
  const errorKey = DEGENERATE_ERROR_KEYS[`${kind}:${key}`];
  if (truncated === 0 && errorKey !== undefined) {
    return { status: "rejected", reason: "degenerate", errorKey };
  }
  return { status: "ok", value: truncated };
}
