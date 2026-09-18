import { formatMeasureNumber } from "./measure-math.ts";
import type { Point2 } from "./snap.ts";
import type { FunctionCurvePrimitive } from "./parse-document.ts";

/** 契约图元类型经本模块转出：函数曲线的一切（参数、预览、图元）从这里进。 */
export type { FunctionCurvePrimitive };

/**
 * 函数曲线纯函数层（ADR 0021）：求值/采样/解析式格式化的唯一收口，
 * 接缝形态与 measure-math 的度量数学层完全同构——无副作用、不触碰契约、
 * 不依赖视口实例。将来加三角函数 kind 只是在此处加枚举值与公式的单点增量。
 */

/** 契约图元 → 纯函数参数：剥掉 id/type 单点取出形状真源，渲染、命中、
 *  选中预览与属性面板共用这一处。 */
export function functionCurveParamsOf(
  primitive: FunctionCurvePrimitive,
): FunctionCurveParams {
  const { id: _id, type: _type, ...params } = primitive;
  return params;
}

/** 三种规范参数形式；退化取值（linear/quadratic a=0、inverse k=0）
 *  被契约层挡住，本层不处理病态分支。 */
export type FunctionCurveParams =
  | { kind: "linear"; a: number; b: number }
  | { kind: "quadratic"; a: number; b: number; c: number }
  | { kind: "inverse"; k: number };

/** kind 判别键的字面量联合：契约 schema 与工具目录共用。 */
export type FunctionCurveKind = FunctionCurveParams["kind"];

/** 参数键的字面量联合：各 kind 取其子集（见 FUNCTION_CURVE_PARAM_KEYS）。 */
export type FunctionCurveParamKey = "a" | "b" | "c" | "k";

/** 按 kind 穷尽的参数目录：属性面板渲染控件、参数读写助手共用。 */
export const FUNCTION_CURVE_PARAM_KEYS: Readonly<
  Record<FunctionCurveKind, readonly FunctionCurveParamKey[]>
> = {
  linear: ["a", "b"],
  quadratic: ["a", "b", "c"],
  inverse: ["k"],
};

/** 滑块拖动中的参数预览（ADR 0007）：属性面板写、视口预览层读，
 *  松手一次提交后清空——哪条曲线、带哪组参数。 */
export type FunctionCurvePreview = {
  id: string;
  params: FunctionCurveParams;
};

/** 联合上按键读参数：目录保证键属于该 kind，读不到不会发生。 */
export function functionCurveParamOf(
  params: FunctionCurveParams,
  key: FunctionCurveParamKey,
): number {
  switch (params.kind) {
    case "linear":
      return key === "b" ? params.b : params.a;
    case "quadratic":
      return key === "a" ? params.a : key === "b" ? params.b : params.c;
    case "inverse":
      return params.k;
  }
}

/** 按键写参数返回新图元（不可变）：预览与提交共用，kind 不变。 */
export function withFunctionCurveParam(
  curve: FunctionCurvePrimitive,
  key: FunctionCurveParamKey,
  value: number,
): FunctionCurvePrimitive {
  switch (curve.kind) {
    case "linear":
      return key === "b" ? { ...curve, b: value } : { ...curve, a: value };
    case "quadratic":
      return key === "a"
        ? { ...curve, a: value }
        : key === "b"
          ? { ...curve, b: value }
          : { ...curve, c: value };
    case "inverse":
      return { ...curve, k: value };
  }
}

/** 预览活跃时取预览参数，否则取契约参数：面板显示与解析式跟手共用。 */
export function previewParamsOf(
  preview: FunctionCurvePreview | null,
  curve: FunctionCurvePrimitive,
): FunctionCurveParams {
  return preview !== null && preview.id === curve.id
    ? preview.params
    : functionCurveParamsOf(curve);
}

/** 创建缺省参数（y = x / y = x² / y = 1/x）：spec 钉死 a=1、b=0、c=0、k=1。
 *  三工具单击提交与属性面板缺省展示共用这一处。 */
export function defaultFunctionCurveParams(
  kind: FunctionCurveKind,
): FunctionCurveParams {
  switch (kind) {
    case "linear":
      return { kind, a: 1, b: 0 };
    case "quadratic":
      return { kind, a: 1, b: 0, c: 0 };
    case "inverse":
      return { kind, k: 1 };
  }
}

/** 采样视口：可见世界 x 范围 + 视图变换的投影输入（渲染层从
 *  ViewTransform 与画布尺寸拼出，本层不 import 视口模块以保 document
 *  分层）。scale 是每世界单位的屏幕像素；heightWorld 是可见世界高度，
 *  断线阈值 = 2 × heightWorld。 */
export type FunctionCurveViewport = {
  xMin: number;
  xMax: number;
  scale: number;
  heightWorld: number;
};

/** 屏幕空间采样间隔（每 2px 一点）——缩放等级变化时平滑度恒定，
 *  每帧采样点数上界 = 视口宽 / 2。 */
const SCREEN_STEP_PX = 2;

/** 各 kind 的解析式求值（y = f(x)；inverse 在 x=0 无定义，
 *  调用方已按支剔除渐近线点）。 */
function evaluate(params: FunctionCurveParams, x: number): number {
  switch (params.kind) {
    case "linear":
      return params.a * x + params.b;
    case "quadratic":
      return params.a * x * x + params.b * x + params.c;
    case "inverse":
      return params.k / x;
  }
}

/** 闭区间 [from, to] 上等间隔采样：间隔数向上取整到屏幕 2px 上界内，
 *  x=0 点（inverse 渐近线）按开区间语义剔除。 */
function sampleInterval(
  params: FunctionCurveParams,
  from: number,
  to: number,
  viewport: FunctionCurveViewport,
): Point2[] {
  const intervals = Math.max(
    1,
    Math.ceil(((to - from) * viewport.scale) / SCREEN_STEP_PX),
  );
  const points: Point2[] = [];
  for (let i = 0; i <= intervals; i++) {
    const x = from + ((to - from) * i) / intervals;
    if (params.kind === "inverse" && x === 0) continue;
    points.push({ x, y: evaluate(params, x) });
  }
  return points;
}

/** 断线规则：相邻采样点 y 跳变超过视口高度两倍即断开线段（渐近线附近
 *  不出现贴 y 轴伪影竖线）；断出的孤立单点不构成绘制段，弃去。 */
function breakAtJumps(
  points: readonly Point2[],
  viewport: FunctionCurveViewport,
): Point2[][] {
  const threshold = 2 * viewport.heightWorld;
  const segments: Point2[][] = [];
  let current: Point2[] = [];
  for (const point of points) {
    const jump =
      current.length === 0
        ? 0
        : Math.abs(point.y - current[current.length - 1].y);
    if (jump > threshold) {
      if (current.length >= 2) segments.push(current);
      current = [];
    }
    current.push(point);
  }
  if (current.length >= 2) segments.push(current);
  return segments;
}

/** 采样折线分段（世界坐标，直供渲染与命中）：linear 视口 x 两端各求
 *  一点直连不采样；quadratic 连续单段；inverse 按 x<0 / x>0 两支各自
 *  采样、互不相连，渐近线本身不产出任何绘制段。 */
export function sampleFunctionCurve(
  params: FunctionCurveParams,
  viewport: FunctionCurveViewport,
): Point2[][] {
  switch (params.kind) {
    case "linear":
      return [
        [
          { x: viewport.xMin, y: evaluate(params, viewport.xMin) },
          { x: viewport.xMax, y: evaluate(params, viewport.xMax) },
        ],
      ];
    case "quadratic":
      return breakAtJumps(
        sampleInterval(params, viewport.xMin, viewport.xMax, viewport),
        viewport,
      );
    case "inverse": {
      const branches: [number, number][] = [];
      if (viewport.xMin < 0) branches.push([viewport.xMin, Math.min(viewport.xMax, 0)]);
      if (viewport.xMax > 0) branches.push([Math.max(viewport.xMin, 0), viewport.xMax]);
      return branches.flatMap(([from, to]) =>
        breakAtJumps(sampleInterval(params, from, to, viewport), viewport),
      );
    }
  }
}

/** 变量项（x² / x）的系数字符串：系数 1 省略（y = x² 不写 y = 1x²）、
 *  -1 只留负号（y = -x）；常数项（sym 为空串）不省略 1。 */
function coefficientText(coef: number, sym: string): string {
  const magnitude = formatMeasureNumber(Math.abs(coef));
  const sign = coef < 0 ? "-" : "";
  if (sym !== "" && Math.abs(coef) === 1) return `${sign}${sym}`;
  return `${sign}${magnitude}${sym}`;
}

/** 按解析式习惯拼接各项：首项负号内联（y = -2x²），后续项用
 *  “ + ” / “ - ” 分隔（y = -2x² + 3x - 4）。零系数项已在上游剔除。 */
function joinTerms(terms: { coef: number; sym: string }[]): string {
  return terms
    .map((term, index) => {
      if (index === 0) return coefficientText(term.coef, term.sym);
      const sign = term.coef < 0 ? "-" : "+";
      return `${sign} ${coefficientText(Math.abs(term.coef), term.sym)}`;
    })
    .join(" ");
}

/** 解析式格式化：把 {kind, 参数} 转成「y = 2x + 1」式人读解析式——
 *  Prompt 投影与属性面板共用一处。系数 1 省略、0 项省略
 *  （y = x² + 1 不写 y = x² + 0x + 1）、负号规范（y = -x + 1）、
 *  反比例写作 y = k/x 形；数字遵守仓库统一两位小数精度。 */
export function formatFunctionExpression(params: FunctionCurveParams): string {
  switch (params.kind) {
    case "linear":
      return `y = ${joinTerms([
        { coef: params.a, sym: "x" },
        ...(params.b !== 0 ? [{ coef: params.b, sym: "" }] : []),
      ])}`;
    case "quadratic":
      return `y = ${joinTerms([
        { coef: params.a, sym: "x²" },
        ...(params.b !== 0 ? [{ coef: params.b, sym: "x" }] : []),
        ...(params.c !== 0 ? [{ coef: params.c, sym: "" }] : []),
      ])}`;
    case "inverse":
      return `y = ${coefficientText(params.k, "")}/x`;
  }
}
