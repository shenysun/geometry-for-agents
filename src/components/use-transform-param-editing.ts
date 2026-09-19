import { computed, ref } from "vue";
import { useI18n } from "vue-i18n";
import {
  previewTransformParamsOf,
  transformParamOf,
  transformParamsOf,
  withTransformParam,
  type TransformParamKey,
  type TransformParams,
  type TransformPrimitive,
} from "../document/transform-math.ts";
import { useDocumentStore } from "../stores/document.ts";
import { useEditorStore } from "../stores/editor.ts";
import { validateTransformParam } from "./transform-field.ts";

/**
 * 变换图元参数编辑共享逻辑（ADR 0022 / 票 05）：与
 * useFunctionCurveParamEditing 同构的 preview/release 骨架——滑块拖动
 * 只进预览层（像实时转动/连续缩放，动态性由滑块承担、替代时间轴），
 * 松手一次提交一步 undo；数字输入一次一提交。退化值内联报错、保留
 * 旧值、文案指明替代，不静默钳制。
 */

/** 一次提交的结果：committed 带截断后的落契值（显示层回写对齐），
 *  kept 表示契约未动（保留旧值，退化时已挂内联文案）。 */
export type TransformParamCommit =
  | { status: "committed"; value: number }
  | { status: "kept" };

export function useTransformParamEditing(
  entry: () => TransformPrimitive,
) {
  const documentStore = useDocumentStore();
  const editor = useEditorStore();
  const { t } = useI18n();

  /** 各参数键的内联报错文案；无错即无键。 */
  const errors = ref<Partial<Record<TransformParamKey, string>>>({});

  function clearError(
    errors: Partial<Record<TransformParamKey, string>>,
    key: TransformParamKey,
  ): Partial<Record<TransformParamKey, string>> {
    const { [key]: _removed, ...rest } = errors;
    return rest;
  }

  /** 拖动中的预览参数：显示随预览走，松手提交后才回到契约值。 */
  const previewParams = computed<TransformParams>(() =>
    previewTransformParamsOf(editor.transformPreview, entry()),
  );

  function displayValue(key: TransformParamKey): number {
    return transformParamOf(previewParams.value, key);
  }

  /** 滑块拖动：新参数只进预览层，契约不动。预览刻意放行穿越退化值
   *  （角度扫过 0°、比扫过 0/1 的连续过程即时可见）——像照画，
   *  松手停在退化值才被拒。 */
  function startParamPreview(key: TransformParamKey, value: number): void {
    const current = entry();
    errors.value = clearError(errors.value, key);
    editor.setTransformPreview({
      id: current.id,
      params: transformParamsOf(withTransformParam(current, key, value)),
    });
  }

  /** 一次提交：校验通过写契约（一步 undo），退化/非法保留旧值。 */
  function commitParam(
    key: TransformParamKey,
    value: number,
  ): TransformParamCommit {
    const current = entry();
    const validation = validateTransformParam(current, key, value);
    if (validation.status === "rejected") {
      if (validation.reason === "degenerate") {
        errors.value = { ...errors.value, [key]: t(validation.errorKey) };
      }
      return { status: "kept" };
    }
    errors.value = clearError(errors.value, key);
    const present = transformParamOf(transformParamsOf(current), key);
    if (validation.value !== present) {
      const result = documentStore.updatePrimitive(
        current.id,
        withTransformParam(current, key, validation.value),
      );
      if (!result.success) return { status: "kept" };
    }
    return { status: "committed", value: validation.value };
  }

  /** 滑块松手：提交一次后清预览，显示回落到契约值。 */
  function releaseSlider(key: TransformParamKey, raw: string): void {
    commitParam(key, Number(raw));
    editor.setTransformPreview(null);
  }

  /** 滑块收尾（无提交路径）：零位移触碰、拖离又拖回柄值的松手 change
   *  不会来，预览层就地清算——否则显示滞留预览值。 */
  function settleSlider(): void {
    editor.setTransformPreview(null);
  }

  return {
    errors,
    previewParams,
    displayValue,
    startParamPreview,
    commitParam,
    releaseSlider,
    settleSlider,
  };
}
