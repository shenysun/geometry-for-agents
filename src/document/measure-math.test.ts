import { describe, expect, test } from "vitest";
import {
  angleDegreeText,
  angleSweepDeg,
  formatMeasureNumber,
} from "./measure-math.ts";
import type { AnglePrimitive } from "./angle.ts";

function expectCloseTo(actual: number, expected: number): void {
  expect(Math.abs(actual - expected)).toBeLessThan(1e-9);
}

const angle = (startDeg: number, endDeg: number): AnglePrimitive => ({
  id: "angle-1",
  type: "angle",
  x: 0,
  y: 0,
  startDeg,
  endDeg,
  length: 4,
});

describe("角的推导度数（sweep）", () => {
  test("起止方向角的逆时针 sweep", () => {
    expectCloseTo(angleSweepDeg(0, 45), 45);
    expectCloseTo(angleSweepDeg(30, 120), 90);
    // 跨 0°：350° 转到 10° 是 20°，不是 340°
    expectCloseTo(angleSweepDeg(350, 10), 20);
  });

  test("负方向角与超 360 的取值先归一", () => {
    // 0° 逆时针转到 -90°（即 270°）是 270°
    expectCloseTo(angleSweepDeg(0, -90), 270);
    expectCloseTo(angleSweepDeg(-30, 30), 60);
    // 差整周（契约层拒绝零角/周角，函数保持全）按 360°
    expectCloseTo(angleSweepDeg(10, 370), 360);
  });

  test("起止重合是退化点弧（弧族允许，渲染为零跨度）", () => {
    expectCloseTo(angleSweepDeg(50, 50), 0);
  });
});

describe("统一数字格式化（两位小数去尾零）", () => {
  test("整数与一位小数去尾零", () => {
    expect(formatMeasureNumber(45)).toBe("45");
    expect(formatMeasureNumber(12.5)).toBe("12.5");
    expect(formatMeasureNumber(3.1)).toBe("3.1");
  });

  test("两位小数与进位边界", () => {
    expect(formatMeasureNumber(3.14159)).toBe("3.14");
    // 第三位进位：12.345 → 12.35，0.999 → 1
    expect(formatMeasureNumber(12.345)).toBe("12.35");
    expect(formatMeasureNumber(0.999)).toBe("1");
    expect(formatMeasureNumber(2.5)).toBe("2.5");
  });
});

describe("角的显示度数文本", () => {
  test("推导值加 ° 后缀（spec US-5 的三个锚点）", () => {
    expect(angleDegreeText(angle(0, 45))).toBe("45°");
    expect(angleDegreeText(angle(0, 12.5))).toBe("12.5°");
    expect(angleDegreeText(angle(0, 3.14159))).toBe("3.14°");
  });

  test("进位边界收敛为整数度", () => {
    expect(angleDegreeText(angle(0, 0.999))).toBe("1°");
  });

  test("跨 0° 的角取逆时针 sweep", () => {
    expect(angleDegreeText(angle(350, 10))).toBe("20°");
  });
});
