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

/** 通用滑块域的两端（票 05 起滑块本体与变换族共用，各自带 step）。 */
export type SliderRange = { readonly min: number; readonly max: number };

/** 滑块域全三元（两端 + 步进）：ParamSlider 的域入参形状，各族自带。 */
export type SliderDomain = SliderRange & { readonly step: number };

/** 数字输入的步进粒度与滑块一致，键盘可达主通道一次一提交。 */
export const NUMBER_STEP = 0.1;

/** 滑块柄钳端点：数值本身不动，只把柄的位置夹进滑块域。 */
export function clampToSliderRange(value: number): number {
  return clampToRange(value, SLIDER_RANGE);
}

/** 任意滑块域的柄钳端点（clampToSliderRange 的域参数化形态）。 */
export function clampToRange(value: number, range: SliderRange): number {
  return Math.min(range.max, Math.max(range.min, value));
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

/** 一次滑块交互的指针位移记录（票 06）：base 为指针按下时的钳后柄值，
 *  moved 表示交互中是否出现过指针驱动的取值变化（input 值偏离 base）。 */
export type SliderInteraction = {
  readonly base: number;
  readonly moved: boolean;
};

/** 指针按下起算一次交互：越界契约值（如 a=15）的柄钳在端点 10；变换族
 *  滑块传入自己的域（默认仍是函数曲线域，既有调用不动）。 */
export function startSliderInteraction(
  displayValue: number,
  range: SliderRange = SLIDER_RANGE,
): SliderInteraction {
  return { base: clampToRange(displayValue, range), moved: false };
}

/** 交互中每个 input 值过一遍：偏离过柄值即记为有位移。 */
export function trackSliderInput(
  interaction: SliderInteraction,
  value: number,
): SliderInteraction {
  return value === interaction.base
    ? interaction
    : { ...interaction, moved: true };
}

/** 零位移触碰不提交（票 06 PO 裁定）：无位移时 change 值只会复述按下
 *  时的钳后柄值，提交它恰是「越界值整体钳到端点」的禁路；域内时提交
 *  同值本就是 no-op，一并不提交。真实拖动（产生过位移）照常提交——
 *  松手值来自指针位置，停在端点是合法滑块语义。 */
export function sliderReleaseCommits(interaction: SliderInteraction): boolean {
  return interaction.moved;
}

/** 松手收尾判定（票 06）：DOM 值已回到柄值时，change 按规范不会再来
 *  （值自上次提交未变）——零位移触碰与拖离又拖回同归此类，预览层须
 *  就地清算、交互就地收尾，显示回落契约值；DOM 值偏离柄值则留给
 *  change 提交（松手值来自指针位置，合法滑块语义）。 */
export function sliderSettlesWithoutCommit(
  interaction: SliderInteraction,
  domValue: number,
): boolean {
  return domValue === interaction.base;
}
