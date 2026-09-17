import { describe, expect, expectTypeOf, test } from "vitest";
import {
  angleDegreeText,
  angleSweepDeg,
  formatMeasureNumber,
  measureAreaAnchor,
  measurePerimeterAnchor,
  measureText,
  measureValue,
  type MeasureKind,
  type MeasurableShape,
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

// ---------------------------------------------------------------------------
// 面积/周长推导（ticket 02）：11 种封闭图元。锚点值全部手算/课本公式，
// 不用被测实现复算（防同义反复）。
// ---------------------------------------------------------------------------

const fill = "none" as const;

/** 3-4-5 直角三角形：底 4（局部 X）、高 3、直角顶点在 (2,0)。
 *  底/高家族锚点，也是 spec Testing Decisions 钦定的锚点。 */
const rightTriangle: MeasurableShape = {
  id: "tri-1",
  type: "triangle",
  x: 0,
  y: 0,
  width: 4,
  height: 3,
  apexOffset: 2,
  rotationDeg: 0,
  fill,
};

/** L 形凹多边形（世界点，逆时针）：面积 = 4×1 条带 + 1×2 立柱 = 6。 */
const lPolygon: MeasurableShape = {
  id: "poly-1",
  type: "polygon",
  points: [
    { x: 0, y: 0 },
    { x: 4, y: 0 },
    { x: 4, y: 1 },
    { x: 1, y: 1 },
    { x: 1, y: 3 },
    { x: 0, y: 3 },
  ],
  fill,
};

describe("多边形族：世界顶点 → 鞋带面积 / 边长和周长", () => {
  test("3-4-5 直角三角形面积 6、周长 12", () => {
    expectCloseTo(measureValue(rightTriangle, "area"), 6);
    expectCloseTo(measureValue(rightTriangle, "perimeter"), 12);
  });

  test("L 形凹多边形鞋带公式对凹形成立、顺时针取绝对值", () => {
    expectCloseTo(measureValue(lPolygon, "area"), 6);
    expectCloseTo(measureValue(lPolygon, "perimeter"), 14);
    const clockwise = {
      ...lPolygon,
      points: [...lPolygon.points].reverse(),
    } satisfies MeasurableShape;
    expectCloseTo(measureValue(clockwise, "area"), 6);
  });

  test("矩形旋转后面积周长不变（12 / 14）", () => {
    const rotated: MeasurableShape = {
      id: "rect-1",
      type: "rectangle",
      x: -5,
      y: 8,
      width: 3,
      height: 4,
      rotationDeg: 37,
      fill,
    };
    expectCloseTo(measureValue(rotated, "area"), 12);
    expectCloseTo(measureValue(rotated, "perimeter"), 14);
  });

  test("平四面积 = 底×高（与斜移无关），周长含斜边", () => {
    const shape: MeasurableShape = {
      id: "para-1",
      type: "parallelogram",
      x: 0,
      y: 0,
      width: 4,
      height: 3,
      skew: 1,
      rotationDeg: 0,
      fill,
    };
    expectCloseTo(measureValue(shape, "area"), 12);
    expectCloseTo(measureValue(shape, "perimeter"), 8 + 2 * Math.sqrt(10));
  });

  test("梯形面积 = 中位线×高，周长含两腰", () => {
    const shape: MeasurableShape = {
      id: "trap-1",
      type: "trapezoid",
      x: 0,
      y: 0,
      width: 6,
      topWidth: 4,
      height: 2,
      topOffset: 0,
      rotationDeg: 0,
      fill,
    };
    expectCloseTo(measureValue(shape, "area"), 10);
    expectCloseTo(measureValue(shape, "perimeter"), 10 + 2 * Math.sqrt(5));
  });

  test("正六边形 r=1：面积 3√3/2、周长 6（边长 = r）", () => {
    const shape: MeasurableShape = {
      id: "hex-1",
      type: "regularPolygon",
      x: 2,
      y: -1,
      sides: 6,
      r: 1,
      rotationDeg: 23,
      fill,
    };
    expectCloseTo(measureValue(shape, "area"), (3 * Math.sqrt(3)) / 2);
    expectCloseTo(measureValue(shape, "perimeter"), 6);
  });
});

describe("圆族：解析闭式与边界全长语义", () => {
  test("单位圆面积 π、周长 2π", () => {
    const shape: MeasurableShape = {
      id: "circle-1",
      type: "circle",
      cx: 3,
      cy: -4,
      r: 1,
      fill,
    };
    expectCloseTo(measureValue(shape, "area"), Math.PI);
    expectCloseTo(measureValue(shape, "perimeter"), 2 * Math.PI);
  });

  test("扇形（r=1、90°）：面积 = 扇形公式，周长 = 弧长 + 两半径（边界全长）", () => {
    const shape: MeasurableShape = {
      id: "sector-1",
      type: "sector",
      cx: 0,
      cy: 0,
      r: 1,
      startDeg: 30,
      endDeg: 120,
      fill,
    };
    expectCloseTo(measureValue(shape, "area"), Math.PI / 4);
    expectCloseTo(measureValue(shape, "perimeter"), Math.PI / 2 + 2);
  });

  test("弓形（r=1、90°）：面积 = 扇形 − 三角形，周长 = 弧长 + 弦长", () => {
    const shape: MeasurableShape = {
      id: "bow-1",
      type: "bow",
      cx: 0,
      cy: 0,
      r: 1,
      startDeg: 0,
      endDeg: 90,
      fill,
    };
    expectCloseTo(measureValue(shape, "area"), (Math.PI / 2 - 1) / 2);
    expectCloseTo(measureValue(shape, "perimeter"), Math.PI / 2 + Math.SQRT2);
  });

  test("圆环（R=2、r=1）：面积 = π(R²−r²)、周长 = 内外两圈全长", () => {
    const shape: MeasurableShape = {
      id: "ring-1",
      type: "ring",
      cx: -1,
      cy: 5,
      rInner: 1,
      rOuter: 2,
      fill,
    };
    expectCloseTo(measureValue(shape, "area"), 3 * Math.PI);
    expectCloseTo(measureValue(shape, "perimeter"), 6 * Math.PI);
  });

  test("椭圆（rx=2、ry=1）：面积 πab、周长 Ramanujan 近似、旋转不变", () => {
    const base = {
      id: "ellipse-1",
      type: "ellipse",
      cx: 0,
      cy: 0,
      rx: 2,
      ry: 1,
      fill,
    } as const;
    const rotated: MeasurableShape = { ...base, rotationDeg: 41 };
    expectCloseTo(measureValue(rotated, "area"), 2 * Math.PI);
    // 周长锚点是独立手算数值（Ramanujan 第一近似 ≈ 9.6884211，公差放宽到
    // 1e-6 与手算位数相称），不用实现公式复算——防同义反复。
    expect(
      Math.abs(measureValue(rotated, "perimeter") - 9.6884211),
    ).toBeLessThan(1e-6);
  });

  test("大弧（270°）：扇形 = 四分之三圆，弓形 = 圆减小弓形，弦按端点距离", () => {
    const majorSector: MeasurableShape = {
      id: "sector-270",
      type: "sector",
      cx: 0,
      cy: 0,
      r: 1,
      startDeg: 0,
      endDeg: 270,
      fill,
    };
    const majorBow: MeasurableShape = {
      id: "bow-270",
      type: "bow",
      cx: 0,
      cy: 0,
      r: 1,
      startDeg: 0,
      endDeg: 270,
      fill,
    };
    // 独立推导：270° 扇形是 3/4 圆（面积 3π/4，弧长 3π/2）；
    // 大弓形 = 圆 − 90° 小弓形；弦是 (1,0)–(0,−1) 两端点距离 √2。
    expectCloseTo(measureValue(majorSector, "area"), (3 * Math.PI) / 4);
    expectCloseTo(measureValue(majorSector, "perimeter"), (3 * Math.PI) / 2 + 2);
    expectCloseTo(
      measureValue(majorBow, "area"),
      Math.PI - (Math.PI / 2 - 1) / 2,
    );
    expectCloseTo(
      measureValue(majorBow, "perimeter"),
      (3 * Math.PI) / 2 + Math.SQRT2,
    );
  });

  test("退化 sweep（起止重合）保持全：扇形周长 = 两半径、弓形归零", () => {
    const degenerateSector: MeasurableShape = {
      id: "sector-0",
      type: "sector",
      cx: 0,
      cy: 0,
      r: 2,
      startDeg: 45,
      endDeg: 45,
      fill,
    };
    const degenerateBow: MeasurableShape = {
      id: "bow-0",
      type: "bow",
      cx: 0,
      cy: 0,
      r: 2,
      startDeg: 45,
      endDeg: 45,
      fill,
    };
    expectCloseTo(measureValue(degenerateSector, "area"), 0);
    expectCloseTo(measureValue(degenerateSector, "perimeter"), 4);
    expectCloseTo(measureValue(degenerateBow, "area"), 0);
    expectCloseTo(measureValue(degenerateBow, "perimeter"), 0);
  });

  test("底/高族旋转后推导值不变（梯形 90°）", () => {
    const rotated: MeasurableShape = {
      id: "trap-r",
      type: "trapezoid",
      x: 7,
      y: -3,
      width: 6,
      topWidth: 4,
      height: 2,
      topOffset: 0,
      rotationDeg: 90,
      fill,
    };
    expectCloseTo(measureValue(rotated, "area"), 10);
    expectCloseTo(measureValue(rotated, "perimeter"), 10 + 2 * Math.sqrt(5));
  });
});

describe("度量显示文本（两位去尾零、不带单位）", () => {
  test("单位圆：面积 3.14、周长 6.28", () => {
    const unitCircle: MeasurableShape = {
      id: "circle-u",
      type: "circle",
      cx: 0,
      cy: 0,
      r: 1,
      fill,
    };
    expect(measureText(unitCircle, "area")).toBe("3.14");
    expect(measureText(unitCircle, "perimeter")).toBe("6.28");
  });

  test("3-4-5 三角形取整无尾零：面积 6、周长 12", () => {
    expect(measureText(rightTriangle, "area")).toBe("6");
    expect(measureText(rightTriangle, "perimeter")).toBe("12");
  });

  test("弓形 90°：进位边界（0.285→0.29、2.985→2.99）", () => {
    const shape: MeasurableShape = {
      id: "bow-90",
      type: "bow",
      cx: 0,
      cy: 0,
      r: 1,
      startDeg: 0,
      endDeg: 90,
      fill,
    };
    expect(measureText(shape, "area")).toBe("0.29");
    expect(measureText(shape, "perimeter")).toBe("2.99");
  });
});

describe("kind: length 的类型结构预留（本期不实现）", () => {
  test("MeasureKind 含 length 槽位，可调用种类只有 area/perimeter", () => {
    expectTypeOf<MeasureKind>().toEqualTypeOf<
      "area" | "perimeter" | "length"
    >();
    // 编译期约束：measureValue 只接受已实现种类，"length" 传不进去。
    expectTypeOf<
      Parameters<typeof measureValue>[1]
    >().toEqualTypeOf<"area" | "perimeter">();
  });
});

describe("度量文本锚点（面积在源形心）", () => {
  test("圆族锚点即圆心", () => {
    const circle: MeasurableShape = { id: "c", type: "circle", cx: 3, cy: -2, r: 1, fill };
    expect(measureAreaAnchor(circle)).toEqual({ x: 3, y: -2 });
  });

  test("三角形形心随旋转走：局部 (0,1) 绕锚点转 90° 到 (-1,0)", () => {
    const triangle: MeasurableShape = {
      id: "t",
      type: "triangle",
      x: 0,
      y: 0,
      width: 3,
      height: 3,
      apexOffset: 0,
      rotationDeg: 90,
      fill,
    };
    const anchor = measureAreaAnchor(triangle);
    expectCloseTo(anchor.x, -1);
    expectCloseTo(anchor.y, 0);
  });

  test("梯形形心是面积形心，不是顶点均值", () => {
    // 下底 4、上底 2、高 2：面积形心离下底 h(2a+b)/3(a+b) = 8/9。
    const trapezoid: MeasurableShape = {
      id: "z",
      type: "trapezoid",
      x: 0,
      y: 0,
      width: 4,
      topWidth: 2,
      height: 2,
      topOffset: 0,
      rotationDeg: 0,
      fill,
    };
    const anchor = measureAreaAnchor(trapezoid);
    expectCloseTo(anchor.x, 0);
    expectCloseTo(anchor.y, 8 / 9);
  });

  test("90° 扇形形心沿平分线取解析距离", () => {
    // r=2、θ=90°：d = 4r·sin(45°)/3θ ≈ 1.2003，平分线 45°。
    const sector: MeasurableShape = {
      id: "s",
      type: "sector",
      cx: 0,
      cy: 0,
      r: 2,
      startDeg: 0,
      endDeg: 90,
      fill,
    };
    const anchor = measureAreaAnchor(sector);
    expectCloseTo(anchor.x, 0.8488263632);
    expectCloseTo(anchor.y, 0.8488263632);
  });

  test("半圆弓形形心 = 4r/3π 离圆心沿平分线", () => {
    // r=2、θ=180°：d = 8/3π ≈ 0.8488，平分线 90°（上半圆）。
    const bow: MeasurableShape = {
      id: "w",
      type: "bow",
      cx: 0,
      cy: 0,
      r: 2,
      startDeg: 0,
      endDeg: 180,
      fill,
    };
    const anchor = measureAreaAnchor(bow);
    expectCloseTo(anchor.x, 0);
    expectCloseTo(anchor.y, 8 / (3 * Math.PI));
  });
});

// ---------------------------------------------------------------------------
// 周长文本锚点（ticket 04）：源紧包围盒的上方中点（世界系 y 向上）。
// 锚点值全部手算，不用被测实现复算（防同义反复）。
// ---------------------------------------------------------------------------

describe("度量文本锚点（周长在源包围盒上方中点）", () => {
  test("圆：包络 [cx±r, cy±r]，上方中点 (cx, cy+r)", () => {
    const circle: MeasurableShape = {
      id: "c",
      type: "circle",
      cx: 3,
      cy: -2,
      r: 1,
      fill,
    };
    expect(measurePerimeterAnchor(circle)).toEqual({ x: 3, y: -1 });
  });

  test("3-4-5 三角形：锚点在底边中点，包络 [−2,2]×[0,3]，上方中点 (0,3)", () => {
    const anchor = measurePerimeterAnchor(rightTriangle);
    expectCloseTo(anchor.x, 0);
    expectCloseTo(anchor.y, 3);
  });

  test("矩形旋转 90°：紧包络随顶点旋转（3×4 → x∈±2、y∈±1.5）", () => {
    const rotated: MeasurableShape = {
      id: "rect-r",
      type: "rectangle",
      x: -5,
      y: 8,
      width: 3,
      height: 4,
      rotationDeg: 90,
      fill,
    };
    const anchor = measurePerimeterAnchor(rotated);
    expectCloseTo(anchor.x, -5);
    expectCloseTo(anchor.y, 9.5);
  });

  test("90° 扇形（0°→90°）：紧包络 [0,1]×[0,1] 含圆心与弧端点", () => {
    const sector: MeasurableShape = {
      id: "s",
      type: "sector",
      cx: 0,
      cy: 0,
      r: 1,
      startDeg: 0,
      endDeg: 90,
      fill,
    };
    const anchor = measurePerimeterAnchor(sector);
    expectCloseTo(anchor.x, 0.5);
    expectCloseTo(anchor.y, 1);
  });

  test("斜跨扇形（30°→120°）：扫过 90° 轴向极值才计入包络", () => {
    // 端点 (cos30°,sin30°)=(0.866,0.5)、(−0.5,0.866)，弧扫过 90° 极值点
    // (0,1)；圆心 (0,0)。包络 x∈[−0.5,0.866]、y∈[0,1]。
    const sector: MeasurableShape = {
      id: "s2",
      type: "sector",
      cx: 0,
      cy: 0,
      r: 1,
      startDeg: 30,
      endDeg: 120,
      fill,
    };
    const anchor = measurePerimeterAnchor(sector);
    expectCloseTo(anchor.x, (Math.cos((30 * Math.PI) / 180) - 0.5) / 2);
    expectCloseTo(anchor.y, 1);
  });

  test("90° 弓形（0°→90°）：小弓不含圆心，包络仍由弧端点决定", () => {
    const bow: MeasurableShape = {
      id: "w",
      type: "bow",
      cx: 0,
      cy: 0,
      r: 1,
      startDeg: 0,
      endDeg: 90,
      fill,
    };
    const anchor = measurePerimeterAnchor(bow);
    expectCloseTo(anchor.x, 0.5);
    expectCloseTo(anchor.y, 1);
  });

  test("大弓形（270°）含圆心：包络是整圆的包络减去小弓缺口", () => {
    // 0°→270° 大弓 = 圆 − 90° 小弓（第四象限）。圆心在弓形内，包络
    // x∈[−1,1]、y∈[−1,1]（0° 端点 (1,0)、270° 端点 (0,−1)、圆心与扫过的
    // 90°/180° 极值都在边界上）。
    const bow: MeasurableShape = {
      id: "w270",
      type: "bow",
      cx: 0,
      cy: 0,
      r: 1,
      startDeg: 0,
      endDeg: 270,
      fill,
    };
    const anchor = measurePerimeterAnchor(bow);
    expectCloseTo(anchor.x, 0);
    expectCloseTo(anchor.y, 1);
  });

  test("椭圆旋转 90°：半轴投影包络 x∈±1、y∈±2", () => {
    const rotated: MeasurableShape = {
      id: "e",
      type: "ellipse",
      cx: 0,
      cy: 0,
      rx: 2,
      ry: 1,
      rotationDeg: 90,
      fill,
    };
    const anchor = measurePerimeterAnchor(rotated);
    expectCloseTo(anchor.x, 0);
    expectCloseTo(anchor.y, 2);
  });
});
