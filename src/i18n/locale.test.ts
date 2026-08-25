import { describe, expect, test } from "vitest";
import { createAppI18n } from "./index.ts";
import { localeFromLanguages } from "./locale.ts";

describe("localeFromLanguages", () => {
  test("maps en* to en", () => {
    expect(localeFromLanguages(["en"])).toBe("en");
    expect(localeFromLanguages(["en-GB", "fr"])).toBe("en");
  });

  test("maps zh* to zh", () => {
    expect(localeFromLanguages(["zh"])).toBe("zh");
    expect(localeFromLanguages(["zh-TW"])).toBe("zh");
  });

  test("falls back to zh when browser language is neither en nor zh", () => {
    expect(localeFromLanguages(["de-DE"])).toBe("zh");
    expect(localeFromLanguages([])).toBe("zh");
  });
});

describe("createAppI18n", () => {
  test("default locale follows browser language", () => {
    const english = createAppI18n(["en-US"]);
    expect(english.global.locale.value).toBe("en");

    const chinese = createAppI18n(["zh-CN"]);
    expect(chinese.global.locale.value).toBe("zh");

    const other = createAppI18n(["ko-KR"]);
    expect(other.global.locale.value).toBe("zh");
  });

  test("manual locale switch changes interface copy not 说明书 field names", () => {
    const i18n = createAppI18n(["zh-CN"]);
    expect(i18n.global.t("objectList.empty")).toMatch(/空/);
    expect(i18n.global.t("file.open")).toBe("打开");
    expect(i18n.global.t("history.undo")).toBe("撤销");
    expect(i18n.global.t("tool.line")).toBe("线段");
    expect(i18n.global.t("tool.polygon")).toBe("多边形");
    expect(i18n.global.t("tool.circle")).toBe("圆");
    expect(i18n.global.t("fill.hatch")).toBe("阴影");
    expect(i18n.global.t("space.confirm")).toBe("清空并切换");

    i18n.global.locale.value = "en";
    expect(i18n.global.t("objectList.empty")).toMatch(/empty/i);
    expect(i18n.global.t("objectList.empty")).not.toMatch(/[\u4e00-\u9fff]/);
    expect(i18n.global.t("file.open")).toBe("Open");
    expect(i18n.global.t("history.undo")).toBe("Undo");
    expect(i18n.global.t("tool.line")).toBe("Line");
    expect(i18n.global.t("tool.polygon")).toBe("Polygon");
    expect(i18n.global.t("tool.circle")).toBe("Circle");
    expect(i18n.global.t("fill.hatch")).toBe("Hatch");
    expect(i18n.global.t("space.confirm")).toBe("Clear and switch");
    expect(i18n.global.t("tool.line")).not.toMatch(/[\u4e00-\u9fff]/);
  });

  test("\u77e9\u5f62\u5de5\u5177\u540d\u4e0e\u65cb\u8f6c\u89d2\u5b57\u6bb5\u5728\u4e24\u79cd\u8bed\u8a00\u4e0b\u90fd\u6709\u6587\u6848", () => {
    const i18n = createAppI18n(["zh-CN"]);
    expect(i18n.global.t("tool.rectangle")).toBe("\u77e9\u5f62");
    expect(i18n.global.t("field.rotationDeg")).toBe("\u65cb\u8f6c\uff08\u5ea6\uff09");

    i18n.global.locale.value = "en";
    expect(i18n.global.t("tool.rectangle")).toBe("Rectangle");
    expect(i18n.global.t("field.rotationDeg")).toBe("Rotation (deg)");
  });

  test("\u5e95/\u9ad8\u5bb6\u65cf\u5de5\u5177\u4e0e\u5b57\u6bb5\u5728\u4e24\u79cd\u8bed\u8a00\u4e0b\u90fd\u6709\u6587\u6848", () => {
    const i18n = createAppI18n(["zh-CN"]);
    expect(i18n.global.t("tool.square")).toBe("\u6b63\u65b9\u5f62");
    expect(i18n.global.t("tool.triangle")).toBe("\u4e09\u89d2\u5f62");
    expect(i18n.global.t("tool.parallelogram")).toBe("\u5e73\u884c\u56db\u8fb9\u5f62");
    expect(i18n.global.t("tool.trapezoid")).toBe("\u68af\u5f62");
    expect(i18n.global.t("field.apexOffset")).toBe("\u9876\u70b9\u504f\u79fb");
    expect(i18n.global.t("field.skew")).toBe("\u659c\u79fb");
    expect(i18n.global.t("field.topWidth")).toBe("\u4e0a\u5e95");
    expect(i18n.global.t("field.topOffset")).toBe("\u4e0a\u5e95\u504f\u79fb");

    i18n.global.locale.value = "en";
    expect(i18n.global.t("tool.square")).toBe("Square");
    expect(i18n.global.t("tool.triangle")).toBe("Triangle");
    expect(i18n.global.t("tool.parallelogram")).toBe("Parallelogram");
    expect(i18n.global.t("tool.trapezoid")).toBe("Trapezoid");
    expect(i18n.global.t("field.apexOffset")).toBe("Apex offset");
    expect(i18n.global.t("field.skew")).toBe("Skew");
    expect(i18n.global.t("field.topWidth")).toBe("Top base");
    expect(i18n.global.t("field.topOffset")).toBe("Top offset");
  });

  test("角工具与字段在两种语言下都有文案", () => {
    const i18n = createAppI18n(["zh-CN"]);
    expect(i18n.global.t("tool.angle")).toBe("角");
    expect(i18n.global.t("field.startDeg")).toBe("起始角");
    expect(i18n.global.t("field.endDeg")).toBe("终止角");
    expect(i18n.global.t("field.length")).toBe("边长");

    i18n.global.locale.value = "en";
    expect(i18n.global.t("tool.angle")).toBe("Angle");
    expect(i18n.global.t("field.startDeg")).toBe("Start angle");
    expect(i18n.global.t("field.endDeg")).toBe("End angle");
    expect(i18n.global.t("field.length")).toBe("Side length");
  });

  test("正多边形工具与字段在两种语言下都有文案", () => {
    const i18n = createAppI18n(["zh-CN"]);
    expect(i18n.global.t("tool.regularPolygon")).toBe("正多边形");
    expect(i18n.global.t("field.sides")).toBe("边数");
    expect(i18n.global.t("field.r")).toBe("半径 r");

    i18n.global.locale.value = "en";
    expect(i18n.global.t("tool.regularPolygon")).toBe("Regular polygon");
    expect(i18n.global.t("field.sides")).toBe("Sides");
    expect(i18n.global.t("field.r")).toBe("Radius (r)");
  });

  test("标注线工具在两种语言下都有文案", () => {
    const i18n = createAppI18n(["zh-CN"]);
    expect(i18n.global.t("tool.dimension")).toBe("标注线");

    i18n.global.locale.value = "en";
    expect(i18n.global.t("tool.dimension")).toBe("Dimension line");
  });

  test("显示名编号模板在两种语言下都有文案：zh 不留空格，en 留空格", () => {
    const i18n = createAppI18n(["zh-CN"]);
    expect(i18n.global.t("objectName", { name: "圆", n: 1 })).toBe("圆1");

    i18n.global.locale.value = "en";
    expect(i18n.global.t("objectName", { name: "Circle", n: 2 })).toBe(
      "Circle 2",
    );
  });
});
