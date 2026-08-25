import { describe, it, expect } from "vitest";
import {
  truncateToPrecision,
  truncateToInteger,
  validateNumericField,
} from "./numeric-precision.ts";

describe("numeric-precision", () => {
  describe("truncateToPrecision", () => {
    it("截断到两位小数", () => {
      expect(truncateToPrecision(3.756)).toBe(3.75);
      expect(truncateToPrecision(3.754)).toBe(3.75);
      expect(truncateToPrecision(3.749)).toBe(3.74);
    });

    it("正确处理负数", () => {
      expect(truncateToPrecision(-3.756)).toBe(-3.75);
      expect(truncateToPrecision(-3.754)).toBe(-3.75);
    });

    it("整数保持不变", () => {
      expect(truncateToPrecision(5)).toBe(5);
      expect(truncateToPrecision(-3)).toBe(-3);
    });

    it("一位小数不变", () => {
      expect(truncateToPrecision(3.7)).toBe(3.7);
      expect(truncateToPrecision(0.1)).toBe(0.1);
    });

    it("零", () => {
      expect(truncateToPrecision(0)).toBe(0);
      expect(truncateToPrecision(0.001)).toBe(0);
    });

    it("支持自定义小数位数", () => {
      expect(truncateToPrecision(3.456, 1)).toBe(3.4);
      expect(truncateToPrecision(3.456, 3)).toBe(3.456);
    });
  });

  describe("truncateToInteger", () => {
    it("截断到整数", () => {
      expect(truncateToInteger(3.75)).toBe(3);
      expect(truncateToInteger(3.2)).toBe(3);
      expect(truncateToInteger(3.99)).toBe(3);
    });

    it("负数截断向零", () => {
      expect(truncateToInteger(-3.75)).toBe(-3);
      expect(truncateToInteger(-3.99)).toBe(-3);
    });

    it("整数不变", () => {
      expect(truncateToInteger(5)).toBe(5);
    });
  });

  describe("validateNumericField", () => {
    it("有限数值通过", () => {
      const result = validateNumericField(3.756, {});
      expect(result.valid).toBe(true);
      expect(result.truncated).toBe(3.75);
    });

    it("正数约束", () => {
      // 0.001 截断后是 0，失败
      const truncatedToZero = validateNumericField(0.001, { positive: true });
      expect(truncatedToZero.valid).toBe(false);
      expect(truncatedToZero.truncated).toBe(0);

      // 1.5 截断后是 1.5，通过
      const valid = validateNumericField(1.5, { positive: true });
      expect(valid.valid).toBe(true);
      expect(valid.truncated).toBe(1.5);

      const invalid = validateNumericField(0, { positive: true });
      expect(invalid.valid).toBe(false);

      const negative = validateNumericField(-1.5, { positive: true });
      expect(negative.valid).toBe(false);
    });

    it("整数约束且截断", () => {
      const result = validateNumericField(3.75, { integer: true });
      expect(result.valid).toBe(true);
      expect(result.truncated).toBe(3);
      expect(Number.isInteger(result.truncated)).toBe(true);
    });

    it("下界约束", () => {
      const valid = validateNumericField(5, { min: 5 });
      expect(valid.valid).toBe(true);

      const invalid = validateNumericField(4.99, { min: 5 });
      expect(invalid.valid).toBe(false);
    });

    it("组合约束：sides ≥ 5 个", () => {
      const valid = validateNumericField(5.99, { integer: true, min: 5 });
      expect(valid.valid).toBe(true);
      expect(valid.truncated).toBe(5);

      const invalid = validateNumericField(4.5, { integer: true, min: 5 });
      expect(invalid.valid).toBe(false);
    });

    it("NaN 与无穷拒绝", () => {
      expect(validateNumericField(NaN, {}).valid).toBe(false);
      expect(validateNumericField(Infinity, {}).valid).toBe(false);
      expect(validateNumericField(-Infinity, {}).valid).toBe(false);
    });
  });
});
