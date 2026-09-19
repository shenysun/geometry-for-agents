import { describe, expect, test } from "vitest";
import {
  ANGLE_SLIDER_RANGE,
  RATIO_SLIDER_RANGE,
  normalizeAngleDeg,
  validateTransformParam,
} from "./transform-field.ts";
import { clampToRange } from "./function-curve-field.ts";
import { TRANSFORM_PARAM_KEYS } from "../document/transform-math.ts";
import type { TransformPrimitive } from "../document/parse-document.ts";

/** 四 kind 的代表性契约条目（参数已合法，作校验的「当前值」底）。 */
const entryOf = {
  translate: (dx: number, dy: number): TransformPrimitive => ({
    id: "t1",
    type: "transform",
    sourceId: "s1",
    kind: "translate",
    dx,
    dy,
  }),
  rotate: (
    centerX: number,
    centerY: number,
    angleDeg: number,
  ): TransformPrimitive => ({
    id: "t1",
    type: "transform",
    sourceId: "s1",
    kind: "rotate",
    centerX,
    centerY,
    angleDeg,
  }),
  reflect: (
    x1: number,
    y1: number,
    x2: number,
    y2: number,
  ): TransformPrimitive => ({
    id: "t1",
    type: "transform",
    sourceId: "s1",
    kind: "reflect",
    x1,
    y1,
    x2,
    y2,
  }),
  dilate: (
    centerX: number,
    centerY: number,
    ratio: number,
  ): TransformPrimitive => ({
    id: "t1",
    type: "transform",
    sourceId: "s1",
    kind: "dilate",
    centerX,
    centerY,
    ratio,
  }),
};

describe("TRANSFORM_PARAM_KEYS：四 kind 字段形状", () => {
  test("translate 是位移向量 dx/dy", () => {
    expect(TRANSFORM_PARAM_KEYS.translate).toEqual(["dx", "dy"]);
  });

  test("rotate 是中心加角度", () => {
    expect(TRANSFORM_PARAM_KEYS.rotate).toEqual([
      "centerX",
      "centerY",
      "angleDeg",
    ]);
  });

  test("reflect 是轴两端点", () => {
    expect(TRANSFORM_PARAM_KEYS.reflect).toEqual(["x1", "y1", "x2", "y2"]);
  });

  test("dilate 是中心加比", () => {
    expect(TRANSFORM_PARAM_KEYS.dilate).toEqual([
      "centerX",
      "centerY",
      "ratio",
    ]);
  });
});

describe("normalizeAngleDeg：显示归一 0–360，存储保符号", () => {
  test.each([
    [-90, 270],
    [-360, 0],
    [0, 0],
    [90, 90],
    [360, 0],
    [450, 90],
    [720, 0],
    [-45, 315],
  ])("%p° 显示为 %p°", (stored, displayed) => {
    expect(normalizeAngleDeg(stored)).toBe(displayed);
  });
});

describe("clampToRange：柄钳端点、数值语义不变", () => {
  test("角度滑块域 0–360：越界值钳端点", () => {
    expect(ANGLE_SLIDER_RANGE).toEqual({ min: 0, max: 360, step: 1 });
    expect(clampToRange(-30, ANGLE_SLIDER_RANGE)).toBe(0);
    expect(clampToRange(180, ANGLE_SLIDER_RANGE)).toBe(180);
    expect(clampToRange(400, ANGLE_SLIDER_RANGE)).toBe(360);
  });

  test("比滑块域 [-5, 5]：负比可达", () => {
    expect(RATIO_SLIDER_RANGE).toEqual({ min: -5, max: 5, step: 0.1 });
    expect(clampToRange(-3, RATIO_SLIDER_RANGE)).toBe(-3);
    expect(clampToRange(9, RATIO_SLIDER_RANGE)).toBe(5);
  });
});

describe("validateTransformParam：退化拒绝带文案键，两位小数截断", () => {
  test("translate：单分量为 0 合法，零向量拒绝", () => {
    const entry = entryOf.translate(3, 5);
    expect(validateTransformParam(entry, "dx", 0)).toEqual({
      status: "ok",
      value: 0,
    });
    const zeroDy = entryOf.translate(3, 0);
    expect(validateTransformParam(zeroDy, "dx", 0)).toEqual({
      status: "rejected",
      reason: "degenerate",
      errorKey: "paramError.translateZero",
    });
  });

  test("translate：输入截断成零向量时拒绝（0.004 → 0）", () => {
    const zeroDy = entryOf.translate(3, 0);
    expect(validateTransformParam(zeroDy, "dx", 0.004)).toEqual({
      status: "rejected",
      reason: "degenerate",
      errorKey: "paramError.translateZero",
    });
  });

  test("translate：旧分量按同一精度截断后比对（手写 JSON 的 0.004 视作 0）", () => {
    const nearZeroDy = { ...entryOf.translate(3, 5), dy: 0.004 };
    expect(validateTransformParam(nearZeroDy, "dx", 0)).toEqual({
      status: "rejected",
      reason: "degenerate",
      errorKey: "paramError.translateZero",
    });
  });

  test("translate：正常输入截断两位小数", () => {
    const entry = entryOf.translate(3, 5);
    expect(validateTransformParam(entry, "dx", 2.345)).toEqual({
      status: "ok",
      value: 2.34,
    });
  });

  test("rotate：0° 与 ±整周拒绝，负角与非整周合法保符号", () => {
    const entry = entryOf.rotate(1, 2, 90);
    for (const degenerate of [0, 360, -360, 720]) {
      expect(validateTransformParam(entry, "angleDeg", degenerate)).toEqual({
        status: "rejected",
        reason: "degenerate",
        errorKey: "paramError.rotateZero",
      });
    }
    expect(validateTransformParam(entry, "angleDeg", -45)).toEqual({
      status: "ok",
      value: -45,
    });
    expect(validateTransformParam(entry, "angleDeg", 90.004)).toEqual({
      status: "ok",
      value: 90,
    });
  });

  test("rotate：角度截断成整周时拒绝（360.004 → 360）", () => {
    const entry = entryOf.rotate(1, 2, 90);
    expect(validateTransformParam(entry, "angleDeg", 360.004)).toEqual({
      status: "rejected",
      reason: "degenerate",
      errorKey: "paramError.rotateZero",
    });
  });

  test("rotate：中心字段任意值合法", () => {
    const entry = entryOf.rotate(1, 2, 90);
    expect(validateTransformParam(entry, "centerX", -4.567)).toEqual({
      status: "ok",
      value: -4.56,
    });
    expect(validateTransformParam(entry, "centerY", 0)).toEqual({
      status: "ok",
      value: 0,
    });
  });

  test("reflect：端点重合拒绝（改任一坐标撞上另一端）", () => {
    const entry = entryOf.reflect(0, 0, 3, 0);
    expect(validateTransformParam(entry, "x2", 0)).toEqual({
      status: "rejected",
      reason: "degenerate",
      errorKey: "paramError.reflectAxis",
    });
    const vertical = entryOf.reflect(2, -1, 2, 4);
    expect(validateTransformParam(vertical, "y1", 4)).toEqual({
      status: "rejected",
      reason: "degenerate",
      errorKey: "paramError.reflectAxis",
    });
  });

  test("reflect：单坐标相等、端点不重合合法", () => {
    const entry = entryOf.reflect(0, 1, 3, 0);
    expect(validateTransformParam(entry, "x1", 3)).toEqual({
      status: "ok",
      value: 3,
    });
  });

  test("dilate：比 0 或 1 拒绝（含截断命中），负比合法", () => {
    const entry = entryOf.dilate(0, 0, 2);
    for (const degenerate of [0, 1, 0.004, 1.004]) {
      expect(validateTransformParam(entry, "ratio", degenerate)).toEqual({
        status: "rejected",
        reason: "degenerate",
        errorKey: "paramError.dilateRatio",
      });
    }
    expect(validateTransformParam(entry, "ratio", -1.5)).toEqual({
      status: "ok",
      value: -1.5,
    });
  });
});
