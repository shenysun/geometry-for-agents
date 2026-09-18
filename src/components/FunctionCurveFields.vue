<script setup lang="ts">
import { computed, ref } from "vue";
import { useI18n } from "vue-i18n";
import {
  FUNCTION_CURVE_PARAM_KEYS,
  functionCurveParamOf,
  functionCurveParamsOf,
  previewParamsOf,
  withFunctionCurveParam,
  type FunctionCurveParamKey,
  type FunctionCurvePrimitive,
} from "../document/function-curve.ts";
import { useDocumentStore } from "../stores/document.ts";
import { useEditorStore } from "../stores/editor.ts";
import {
  NUMBER_STEP,
  SLIDER_RANGE,
  clampToSliderRange,
  validateFunctionCurveParam,
} from "./function-curve-field.ts";

/**
 * 函数曲线参数编辑（ADR 0021 / 票 03）：滑块 + 数字框写同一份契约字段。
 * 滑块拖动全程走预览层（ADR 0007），松手一次提交一步 undo；数字输入
 * 一次一提交，是键盘可达的主通道。输入退化值报内联错误并保留旧值，
 * 文案指明替代路径，不静默钳制。
 */

const props = defineProps<{ curve: FunctionCurvePrimitive }>();

const documentStore = useDocumentStore();
const editor = useEditorStore();
const { t } = useI18n();

const paramKeys = computed(
  () => FUNCTION_CURVE_PARAM_KEYS[props.curve.kind],
);

type ParamKey = FunctionCurveParamKey;

/** 各参数键的内联报错文案；无错即无键。 */
const errors = ref<Partial<Record<ParamKey, string>>>({});

function clearError(
  errors: Partial<Record<ParamKey, string>>,
  key: ParamKey,
): Partial<Record<ParamKey, string>> {
  const { [key]: _removed, ...rest } = errors;
  return rest;
}

/** 拖动中的预览参数：数字框显示随预览走，松手提交后才回到契约值。 */
const previewParams = computed(() =>
  previewParamsOf(editor.functionCurvePreview, props.curve),
);

function displayValue(key: ParamKey): number {
  return functionCurveParamOf(previewParams.value, key);
}

/** 滑块拖动：新参数只进预览层，契约不动。预览刻意放行穿越退化值
 *  （US 27 扫 k 从正到负必经 0）——采样层照画，松手停在 0 才被拒。 */
function onSliderInput(key: ParamKey, event: Event): void {
  const value = Number((event.target as HTMLInputElement).value);
  errors.value = clearError(errors.value, key);
  editor.setFunctionCurvePreview({
    id: props.curve.id,
    params: functionCurveParamsOf(
      withFunctionCurveParam(props.curve, key, value),
    ),
  });
}

/** 一次提交：校验通过写契约（一步 undo），退化/非法保留旧值回退输入框。 */
function commitParam(
  key: ParamKey,
  raw: string,
  input: HTMLInputElement,
): boolean {
  const present = functionCurveParamOf(functionCurveParamsOf(props.curve), key);
  // 空输入不当作 0 提交：保留旧值，静默回退（退化值才有内联文案）。
  if (raw.trim() === "") {
    input.value = String(present);
    return false;
  }
  const validation = validateFunctionCurveParam(
    props.curve.kind,
    key,
    Number(raw),
  );
  if (validation.status === "rejected") {
    if (validation.reason === "degenerate") {
      errors.value = { ...errors.value, [key]: t(validation.errorKey) };
    }
    input.value = String(present);
    return false;
  }
  errors.value = clearError(errors.value, key);
  // 显示层与契约对齐：2.345 落 2.34，输入框也回写成 2.34。
  input.value = String(validation.value);
  if (validation.value === present) return true;
  const result = documentStore.updatePrimitive(
    props.curve.id,
    withFunctionCurveParam(props.curve, key, validation.value),
  );
  return result.success;
}

/** 滑块松手：提交一次后清预览，显示回落到契约值。 */
function onSliderChange(key: ParamKey, event: Event): void {
  const input = event.target as HTMLInputElement;
  commitParam(key, input.value, input);
  editor.setFunctionCurvePreview(null);
}

/** 数字输入 / 原生步进：一次一提交。 */
function onNumberChange(key: ParamKey, event: Event): void {
  const input = event.target as HTMLInputElement;
  commitParam(key, input.value, input);
}
</script>

<template>
  <div v-for="key in paramKeys" :key="key" class="space-y-1">
    <div class="flex items-center gap-2">
      <label
        class="w-5 shrink-0 text-zinc-500"
        :for="`curve-${curve.id}-${key}`"
      >
        {{ t(`field.${key}`) }}
      </label>
      <input
        type="range"
        class="min-w-0 flex-1 accent-indigo-600"
        :min="SLIDER_RANGE.min"
        :max="SLIDER_RANGE.max"
        :step="SLIDER_RANGE.step"
        :value="clampToSliderRange(displayValue(key))"
        :aria-label="`${t(`field.${key}`)} slider`"
        @input="onSliderInput(key, $event)"
        @change="onSliderChange(key, $event)"
      />
      <input
        :id="`curve-${curve.id}-${key}`"
        type="number"
        class="w-20 rounded border border-zinc-300 px-2 py-1"
        :step="NUMBER_STEP"
        :value="displayValue(key)"
        @change="onNumberChange(key, $event)"
      />
    </div>
    <p
      v-if="errors[key] !== undefined"
      class="pl-7 text-xs text-red-600"
      role="alert"
    >
      {{ errors[key] }}
    </p>
  </div>
</template>
