import { describe, expect, test } from "vitest";
import {
  formatFunctionExpression,
  sampleFunctionCurve,
  type FunctionCurveParams,
  type FunctionCurveViewport,
} from "./function-curve.ts";
import type { Point2 } from "./snap.ts";

/** 采样点对已知解析式的独立真源（worked example），不复算被测公式。 */
function expectPoint(actual: Point2, x: number, y: number): void {
  expect(actual.x).toBeCloseTo(x, 10);
  expect(actual.y).toBeCloseTo(y, 10);
}

/** 采样 x 网格按等分浮点累进，匹配一律走容差而非逐位相等。 */
const hasX = (points: readonly Point2[], x0: number): boolean =>
  points.some((p) => Math.abs(p.x - x0) < 1e-9);

/** 断线不变式：任何输出段内相邻点 y 跳变不超过视口高度两倍。 */
function expectBreakInvariant(segments: Point2[][], heightWorld: number): void {
  const threshold = 2 * heightWorld;
  for (const points of segments) {
    for (let i = 1; i < points.length; i++) {
      expect(Math.abs(points[i].y - points[i - 1].y)).toBeLessThanOrEqual(
        threshold,
      );
    }
  }
}

/** x ∈ [-4,4]、scale=50（宽 400px）、可见高 8 世界单位的常规视口。 */
const makeViewport = (
  overrides: Partial<FunctionCurveViewport> = {},
): FunctionCurveViewport => ({
  xMin: -4,
  xMax: 4,
  heightWorld: 8,
  scale: 50,
  ...overrides,
});

describe("linear 采样：视口两端各一点直连", () => {
  const params: FunctionCurveParams = { kind: "linear", a: 2, b: 1 };

  test("单段输出，恰两端点，值走解析式", () => {
    const segments = sampleFunctionCurve(params, makeViewport());
    expect(segments).toHaveLength(1);
    expect(segments[0]).toHaveLength(2);
    expectPoint(segments[0][0], -4, -7);
    expectPoint(segments[0][1], 4, 9);
  });

  test("平移后端点跟随可见范围重算", () => {
    const segments = sampleFunctionCurve(params, makeViewport({ xMin: -3, xMax: 7 }));
    expectPoint(segments[0][0], -3, -5);
    expectPoint(segments[0][1], 7, 15);
  });
});

describe("quadratic 采样：屏幕空间每 2px 一点、连续单段", () => {
  const params: FunctionCurveParams = { kind: "quadratic", a: 1, b: 0, c: 0 };

  test("连续单段，端点与顶点值正确", () => {
    const segments = sampleFunctionCurve(params, makeViewport());
    expect(segments).toHaveLength(1);
    const points = segments[0];
    expectPoint(points[0], -4, 16);
    // 宽 400px / 每 2px 一点 → 200 段间隔、201 点，x=0 恰在第 100 点
    expect(points).toHaveLength(201);
    expectPoint(points[100], 0, 0);
    expectPoint(points[200], 4, 16);
  });

  test("缩放等级变化时点数上界恒为视口宽 / 2", () => {
    // 上界 = 视口宽/2 个间隔 + 1 个端点：缩到 200px → 100 间隔、101 点
    const zoomedOut = sampleFunctionCurve(params, makeViewport({ scale: 25 }))[0];
    expect(zoomedOut.length).toBe(101);
    // 放大到 4000px → 2000 间隔、2001 点，不随缩放膨胀超界
    const zoomedIn = sampleFunctionCurve(params, makeViewport({ scale: 500 }))[0];
    expect(zoomedIn.length).toBeLessThanOrEqual(2001);
  });

  test("相邻点屏幕间距不超过 2px（平滑度恒定）", () => {
    const points = sampleFunctionCurve(params, makeViewport())[0];
    for (let i = 1; i < points.length; i++) {
      expect((points[i].x - points[i - 1].x) * 50).toBeLessThanOrEqual(
        2 + 1e-9,
      );
    }
  });
});

describe("inverse 采样：两支互不相连、渐近线不产段", () => {
  const params: FunctionCurveParams = { kind: "inverse", k: 1 };

  test("两支各成一段，x=0 不出现，段内无跨支连线", () => {
    const segments = sampleFunctionCurve(params, makeViewport());
    expect(segments).toHaveLength(2);
    const [negative, positive] = segments;
    expect(negative.every((p) => p.x < 0)).toBe(true);
    expect(positive.every((p) => p.x > 0)).toBe(true);
    expect(
      [...negative, ...positive].every((p) => p.x !== 0),
    ).toBe(true);
    // 支内端点值走解析式：x=-4 → y=-0.25
    expectPoint(negative[0], -4, -0.25);
    expectPoint(positive[positive.length - 1], 4, 0.25);
  });

  test("视口整在左半平面时只有负支", () => {
    const segments = sampleFunctionCurve(
      params,
      makeViewport({ xMin: -6, xMax: -1 }),
    );
    expect(segments).toHaveLength(1);
    expect(segments[0].every((p) => p.x < 0)).toBe(true);
  });

  test("断线规则：y 跳变超两倍视口高度的相邻点分属不同段", () => {
    // 紧阈值（可见高 2 → 阈值 4）：x=-0.12→-0.08 的跳变 12.5−8.33≈4.17 越界
    const tight = sampleFunctionCurve(params, makeViewport({ heightWorld: 2 }));
    expectBreakInvariant(tight, 2);
    expect(hasX(tight.flat(), -0.08)).toBe(false);
    // 宽阈值（可见高 8 → 阈值 16）下同一对点相连
    const loose = sampleFunctionCurve(params, makeViewport());
    expectBreakInvariant(loose, 8);
    expect(hasX(loose[0], -0.08)).toBe(true);
    // 断出的孤立单点不成绘制段
    for (const points of tight) {
      expect(points.length).toBeGreaterThanOrEqual(2);
    }
  });
});

describe("确定性：同参数同视口输出逐点相等", () => {
  test.each(["linear", "quadratic", "inverse"] as const)("kind=%s", (kind) => {
    const params: FunctionCurveParams =
      kind === "linear"
        ? { kind, a: 2, b: 1 }
        : kind === "quadratic"
          ? { kind, a: 1, b: -2, c: 3 }
          : { kind, k: -2 };
    const first = sampleFunctionCurve(params, makeViewport());
    const second = sampleFunctionCurve(params, makeViewport());
    expect(second).toEqual(first);
  });
});

describe("解析式格式化矩阵", () => {
  test("linear：系数 1 省略、b=0 省略、负号规范", () => {
    expect(formatFunctionExpression({ kind: "linear", a: 1, b: 0 })).toBe(
      "y = x",
    );
    expect(formatFunctionExpression({ kind: "linear", a: 2, b: 1 })).toBe(
      "y = 2x + 1",
    );
    expect(formatFunctionExpression({ kind: "linear", a: -1, b: 3 })).toBe(
      "y = -x + 3",
    );
    expect(formatFunctionExpression({ kind: "linear", a: 2, b: -3 })).toBe(
      "y = 2x - 3",
    );
    expect(formatFunctionExpression({ kind: "linear", a: 0.5, b: 0 })).toBe(
      "y = 0.5x",
    );
  });

  test("quadratic：y = x² 不写 y = 1x²，b/c 为 0 项省略", () => {
    expect(formatFunctionExpression({ kind: "quadratic", a: 1, b: 0, c: 0 })).toBe(
      "y = x²",
    );
    expect(formatFunctionExpression({ kind: "quadratic", a: 1, b: 0, c: 1 })).toBe(
      "y = x² + 1",
    );
    expect(
      formatFunctionExpression({ kind: "quadratic", a: 1, b: -2, c: 0 }),
    ).toBe("y = x² - 2x");
    expect(
      formatFunctionExpression({ kind: "quadratic", a: -2, b: 3, c: -4 }),
    ).toBe("y = -2x² + 3x - 4");
  });

  test("inverse：y = k/x 形，负号规范", () => {
    expect(formatFunctionExpression({ kind: "inverse", k: 1 })).toBe("y = 1/x");
    expect(formatFunctionExpression({ kind: "inverse", k: -2 })).toBe(
      "y = -2/x",
    );
    expect(formatFunctionExpression({ kind: "inverse", k: 0.5 })).toBe(
      "y = 0.5/x",
    );
  });

  test("全部数字遵守两位小数精度（去尾零）", () => {
    expect(
      formatFunctionExpression({ kind: "quadratic", a: 1.234, b: 0, c: 2 }),
    ).toBe("y = 1.23x² + 2");
  });
});
