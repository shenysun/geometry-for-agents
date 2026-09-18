import { describe, it, expect } from "vitest";
import {
  SLIDER_RANGE,
  clampToSliderRange,
  validateFunctionCurveParam,
} from "./function-curve-field.ts";

/** 属性面板参数字段（numeric-precision 同构）：截断、退化报错、钳端点。 */
describe("function-curve-field", () => {
  describe("clampToSliderRange", () => {
    it("域内原样返回", () => {
      expect(clampToSliderRange(0)).toBe(0);
      expect(clampToSliderRange(3.7)).toBe(3.7);
      expect(clampToSliderRange(-10)).toBe(-10);
      expect(clampToSliderRange(10)).toBe(10);
    });

    it("超范围钳到端点：数值保留在数字框，滑块柄贴端", () => {
      expect(clampToSliderRange(25)).toBe(SLIDER_RANGE.max);
      expect(clampToSliderRange(-30)).toBe(SLIDER_RANGE.min);
      expect(clampToSliderRange(10.05)).toBe(SLIDER_RANGE.max);
    });
  });

  describe("validateFunctionCurveParam：截断到两位小数", () => {
    it("超两位小数截断后通过", () => {
      const a = validateFunctionCurveParam("linear", "a", 2.345);
      expect(a).toEqual({ status: "ok", value: 2.34 });

      const k = validateFunctionCurveParam("inverse", "k", -0.129);
      expect(k).toEqual({ status: "ok", value: -0.12 });
    });

    it("非有限数值拒绝", () => {
      for (const bad of [NaN, Infinity, -Infinity]) {
        expect(validateFunctionCurveParam("linear", "b", bad)).toEqual({
          status: "rejected",
          reason: "not-number",
        });
      }
    });
  });

  describe("validateFunctionCurveParam：退化值拒绝并给出文案键", () => {
    it("一次 a=0 → linearA（画水平线请用直线工具）", () => {
      expect(validateFunctionCurveParam("linear", "a", 0)).toEqual({
        status: "rejected",
        reason: "degenerate",
        errorKey: "paramError.linearA",
      });
      // 0.004 截断后为 0：同样按退化拒绝，不静默钳制。
      expect(validateFunctionCurveParam("linear", "a", 0.004)).toEqual({
        status: "rejected",
        reason: "degenerate",
        errorKey: "paramError.linearA",
      });
    });

    it("二次 a=0 → quadraticA（降为一次函数）", () => {
      expect(validateFunctionCurveParam("quadratic", "a", 0)).toEqual({
        status: "rejected",
        reason: "degenerate",
        errorKey: "paramError.quadraticA",
      });
    });

    it("反比例 k=0 → inverseK（y = 0/x 无定义）", () => {
      expect(validateFunctionCurveParam("inverse", "k", 0)).toEqual({
        status: "rejected",
        reason: "degenerate",
        errorKey: "paramError.inverseK",
      });
    });

    it("非首项参数可为 0：b、c 的 0 是合法值", () => {
      expect(validateFunctionCurveParam("linear", "b", 0)).toEqual({
        status: "ok",
        value: 0,
      });
      expect(validateFunctionCurveParam("quadratic", "c", 0)).toEqual({
        status: "ok",
        value: 0,
      });
      expect(validateFunctionCurveParam("quadratic", "b", 0)).toEqual({
        status: "ok",
        value: 0,
      });
    });
  });
});
