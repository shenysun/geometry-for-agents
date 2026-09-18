import { describe, it, expect } from "vitest";
import {
  SLIDER_RANGE,
  clampToSliderRange,
  sliderReleaseCommits,
  sliderSettlesWithoutCommit,
  startSliderInteraction,
  trackSliderInput,
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

  /** 滑块交互位移记录（票 06 PO 裁定）：提交值必须来自指针位置；
   *  零位移触碰只会复述按下时的钳后柄值，不提交——否则越界契约值
   *  （如 a=15）被一次无确认触碰静默钳到端点 10。 */
  describe("滑块交互位移记录", () => {
    it("起点为按下时钳后柄值：越界值只记端点", () => {
      expect(startSliderInteraction(15)).toEqual({ base: 10, moved: false });
      expect(startSliderInteraction(3.7)).toEqual({ base: 3.7, moved: false });
    });

    it("零位移触碰不提交：a=15 时点一下柄/轨道右段不落 10", () => {
      const touch = startSliderInteraction(15);
      expect(sliderReleaseCommits(touch)).toBe(false);
    });

    it("域内零位移同样不提交：提交同值本就是 no-op", () => {
      const touch = startSliderInteraction(3.7);
      expect(sliderReleaseCommits(touch)).toBe(false);
    });

    it("点击轨道其他位置提交：首个 input 即偏离柄值", () => {
      let interaction = startSliderInteraction(15);
      interaction = trackSliderInput(interaction, 0);
      expect(sliderReleaseCommits(interaction)).toBe(true);
    });

    it("拖离再拖回柄值也提交：位移发生过，松手值来自指针位置", () => {
      let interaction = startSliderInteraction(15);
      interaction = trackSliderInput(interaction, 9.9);
      interaction = trackSliderInput(interaction, 10);
      expect(sliderReleaseCommits(interaction)).toBe(true);
    });

    it("input 值等于柄值不改变位移标记", () => {
      let interaction = startSliderInteraction(3.7);
      interaction = trackSliderInput(interaction, 3.7);
      expect(interaction).toEqual({ base: 3.7, moved: false });
    });
  });

  /** 松手收尾：DOM 值回到柄值时 change 按规范不会再来（值自上次提交
   *  未变），预览层须就地清算——否则拖离又拖回后预览滞留，越界契约值
   *  在显示层被静默钳住。 */
  describe("sliderSettlesWithoutCommit", () => {
    it("零位移触碰：DOM 值停在柄值，就地清算", () => {
      const touch = startSliderInteraction(15);
      expect(sliderSettlesWithoutCommit(touch, 10)).toBe(true);
    });

    it("拖离未归：DOM 值偏离柄值，留给 change 提交", () => {
      const interaction = trackSliderInput(startSliderInteraction(15), 0);
      expect(sliderSettlesWithoutCommit(interaction, 0)).toBe(false);
    });

    it("拖离又拖回柄值：change 不发（值未变），就地清算", () => {
      let interaction = startSliderInteraction(15);
      interaction = trackSliderInput(interaction, 9.9);
      expect(sliderSettlesWithoutCommit(interaction, 10)).toBe(true);
    });
  });
});
