import {
  hitTest,
  measurable2dTypes,
  type GeometryDocument,
  type HitPoint,
  type MeasurePrimitive,
} from "../document/index.ts";
import type { ImplementedMeasureKind } from "../document/measure-math.ts";

/** 度量标注条目：源 id + 度量种类，数值不进说明书（ADR 0020 引用式）。 */
export type MeasureEntry = MeasurePrimitive;

export type PickMeasureRejection = "not-measurable";

export type PickMeasureContext = {
  document: GeometryDocument;
  point: HitPoint;
  tolerance: number;
  /** 新条目的 id，与绘制手势同例由调用方生成。 */
  id: string;
};

export type PickMeasureResult = {
  /** 拾取成功时待提交的条目。 */
  commit: MeasureEntry | null;
  /** 成功时的新选中（画完即回选择由组件层换工具完成）。 */
  selectionId?: string;
  rejection: PickMeasureRejection | null;
};

/**
 * 度量标注工具的一次点击：点白名单封闭图元即挂上一条标注。契约拒绝
 * （ADR 0020 白名单）：笔画族、点名、尺寸标注线、角、重叠填充、measure
 * 自身与任何 3D 图元；拒绝不提交、工具不切。空点忽略。度量是单步拾取
 * （区别于重叠填充的两步），无中间状态。
 */
export function clickPickMeasure(
  ctx: PickMeasureContext,
  kind: ImplementedMeasureKind,
): PickMeasureResult {
  const doc = ctx.document;
  if (doc.space !== "2d") {
    return { commit: null, rejection: null };
  }
  const hit = hitTest(doc, ctx.point, ctx.tolerance);
  if (hit === null) {
    return { commit: null, rejection: null };
  }
  if (!measurable2dTypes.has(hit.type)) {
    return { commit: null, rejection: "not-measurable" };
  }
  const entry: MeasureEntry = {
    id: ctx.id,
    type: "measure",
    sourceId: hit.id,
    kind,
  };
  return { commit: entry, selectionId: ctx.id, rejection: null };
}
