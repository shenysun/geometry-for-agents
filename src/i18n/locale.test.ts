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

    i18n.global.locale.value = "en";
    expect(i18n.global.t("objectList.empty")).toMatch(/empty/i);
    expect(i18n.global.t("objectList.empty")).not.toMatch(/[\u4e00-\u9fff]/);
    expect(i18n.global.t("file.open")).toBe("Open");
    expect(i18n.global.t("history.undo")).toBe("Undo");
    expect(i18n.global.t("tool.line")).toBe("Line");
    expect(i18n.global.t("tool.polygon")).toBe("Polygon");
    expect(i18n.global.t("tool.line")).not.toMatch(/[\u4e00-\u9fff]/);
  });
});
