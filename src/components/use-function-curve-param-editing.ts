import { computed, ref } from "vue";
import { useI18n } from "vue-i18n";
import {
  functionCurveParamOf,
  functionCurveParamsOf,
  previewParamsOf,
  withFunctionCurveParam,
  type FunctionCurveParamKey,
  type FunctionCurveParams,
  type FunctionCurvePrimitive,
} from "../document/function-curve.ts";
import { useDocumentStore } from "../stores/document.ts";
import { useEditorStore } from "../stores/editor.ts";
import { validateFunctionCurveParam } from "./function-curve-field.ts";
import { truncateToPrecision } from "./numeric-precision.ts";

/**
 * 函数曲线参数编辑共享逻辑（ADR 0021 / 票 04）：属性面板与视口浮动条
 * 两处同源——同一份预览通道、同一条提交管线、同款退化报错。两处 UI
 * 只管摆控件，参数读写全部走这里，所以两处编辑永不打架：一边拖动，
 * 另一边的滑块柄与数值跟着同一份预览走。
 */

/** 一次提交的结果：committed 带截断后的落契值（显示层回写对齐），
 *  kept 表示契约未动（保留旧值，退化时已挂内联文案）。 */
export type ParamCommit =
  | { status: "committed"; value: number }
  | { status: "kept" };

export function useFunctionCurveParamEditing(
  curve: () => FunctionCurvePrimitive,
) {
  const documentStore = useDocumentStore();
  const editor = useEditorStore();
  const { t } = useI18n();

  /** 各参数键的内联报错文案；无错即无键。 */
  const errors = ref<Partial<Record<FunctionCurveParamKey, string>>>({});

  function clearError(
    errors: Partial<Record<FunctionCurveParamKey, string>>,
    key: FunctionCurveParamKey,
  ): Partial<Record<FunctionCurveParamKey, string>> {
    const { [key]: _removed, ...rest } = errors;
    return rest;
  }

  /** 拖动中的预览参数：显示随预览走，松手提交后才回到契约值。 */
  const previewParams = computed<FunctionCurveParams>(() =>
    previewParamsOf(editor.functionCurvePreview, curve()),
  );

  function displayValue(key: FunctionCurveParamKey): number {
    return functionCurveParamOf(previewParams.value, key);
  }

  /** 展示值：拖动中的预览也按仓库统一两位小数呈现（US 10），不带
   *  0.30000000000000004 之类的浮点尾巴；契约值本就截断过。 */
  function displayText(key: FunctionCurveParamKey): string {
    return String(truncateToPrecision(displayValue(key)));
  }

  /** 滑块拖动：新参数只进预览层，契约不动。预览刻意放行穿越退化值
   *  （US 27 扫 k 从正到负必经 0）——采样层照画，松手停在 0 才被拒。 */
  function startParamPreview(key: FunctionCurveParamKey, value: number): void {
    const current = curve();
    errors.value = clearError(errors.value, key);
    editor.setFunctionCurvePreview({
      id: current.id,
      params: functionCurveParamsOf(
        withFunctionCurveParam(current, key, value),
      ),
    });
  }

  /** 一次提交：校验通过写契约（一步 undo），退化/非法保留旧值。 */
  function commitParam(
    key: FunctionCurveParamKey,
    value: number,
  ): ParamCommit {
    const current = curve();
    const validation = validateFunctionCurveParam(current.kind, key, value);
    if (validation.status === "rejected") {
      if (validation.reason === "degenerate") {
        errors.value = { ...errors.value, [key]: t(validation.errorKey) };
      }
      return { status: "kept" };
    }
    errors.value = clearError(errors.value, key);
    const present = functionCurveParamOf(functionCurveParamsOf(current), key);
    if (validation.value !== present) {
      const result = documentStore.updatePrimitive(
        current.id,
        withFunctionCurveParam(current, key, validation.value),
      );
      if (!result.success) return { status: "kept" };
    }
    return { status: "committed", value: validation.value };
  }

  /** 滑块松手：提交一次后清预览，显示回落到契约值。 */
  function releaseSlider(key: FunctionCurveParamKey, raw: string): void {
    commitParam(key, Number(raw));
    editor.setFunctionCurvePreview(null);
  }

  return {
    errors,
    previewParams,
    displayValue,
    displayText,
    startParamPreview,
    commitParam,
    releaseSlider,
  };
}
