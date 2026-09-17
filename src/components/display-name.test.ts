import { describe, expect, test } from "vitest";
import type { Primitive } from "../document/index.ts";
import { displayNamesById, type Translate } from "./display-name.ts";

/** 只含推导所需字段的合法图元夹具：显示名只读 id 与 type */
function circle(id: string): Primitive {
  return { id, type: "circle", cx: 0, cy: 0, r: 1, fill: "none" };
}

function line(id: string): Primitive {
  return {
    id,
    type: "line",
    points: [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
    ],
  };
}

function triangle(id: string): Primitive {
  return {
    id,
    type: "triangle",
    x: 0,
    y: 0,
    width: 2,
    height: 1,
    apexOffset: 0,
    rotationDeg: 0,
    fill: "none",
  };
}

/** 独立于实现的假翻译：词条表 + objectName 无空格拼接（zh 格式） */
const zhT: Translate = (key, named) => {
  if (key === "objectName") {
    return `${named?.name}${named?.n}`;
  }
  const words: Record<string, string> = {
    "tool.circle": "圆",
    "tool.line": "线段",
    "tool.triangle": "三角形",
  };
  return words[key] ?? key;
};

describe("displayNamesById", () => {
  test("同类型按说明书顺序编号：首个不加号，其后 1、2；类型各自计数", () => {
    const primitives = [
      circle("c0"),
      line("l0"),
      circle("c1"),
      triangle("t0"),
      line("l1"),
    ];
    const names = displayNamesById(primitives, zhT);

    expect(names.get("c0")).toBe("圆");
    expect(names.get("l0")).toBe("线段");
    expect(names.get("c1")).toBe("圆1");
    expect(names.get("t0")).toBe("三角形");
    expect(names.get("l1")).toBe("线段1");
  });

  test("删除中间同类图元后重新推导，序号自动收紧不留空洞", () => {
    const before = [circle("c0"), circle("c1"), circle("c2")];
    expect(displayNamesById(before, zhT).get("c2")).toBe("圆2");

    // 操作员删掉 c1，剩下的数组重新推导：圆、圆1
    const after = [circle("c0"), circle("c2")];
    const names = displayNamesById(after, zhT);
    expect(names.get("c0")).toBe("圆");
    expect(names.get("c2")).toBe("圆1");
  });
});

/** measure 图元夹具：显示名只读 id、type 与 kind */
function measure(id: string, kind: "area" | "perimeter"): Primitive {
  return { id, type: "measure", sourceId: "c0", kind };
}

const measureZhT: Translate = (key, named) => {
  if (key === "objectName") {
    return `${named?.name}${named?.n}`;
  }
  const words: Record<string, string> = {
    "tool.circle": "圆",
    "tool.measureArea": "面积标注",
    "tool.measurePerimeter": "周长标注",
  };
  return words[key] ?? key;
};

describe("displayNamesById：度量标注按 kind 取词条", () => {
  test("area 与 perimeter 各取各的词条，同类各自编号（首个不加号）", () => {
    const primitives = [
      circle("c0"),
      measure("m0", "area"),
      measure("m1", "perimeter"),
      measure("m2", "area"),
    ];
    const names = displayNamesById(primitives, measureZhT);

    expect(names.get("m0")).toBe("面积标注");
    expect(names.get("m1")).toBe("周长标注");
    expect(names.get("m2")).toBe("面积标注1");
  });
});
