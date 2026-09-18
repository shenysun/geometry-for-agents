<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import {
  FUNCTION_CURVE_PARAM_KEYS,
  functionCurveParamOf,
  functionCurveParamsOf,
  type FunctionCurveParamKey,
  type FunctionCurvePrimitive,
} from "../document/function-curve.ts";
import { NUMBER_STEP } from "./function-curve-field.ts";
import FunctionCurveSlider from "./FunctionCurveSlider.vue";
import { useFunctionCurveParamEditing } from "./use-function-curve-param-editing.ts";

/**
 * 函数曲线参数编辑（ADR 0021 / 票 03）：滑块 + 数字框写同一份契约字段。
 * 滑块拖动全程走预览层（ADR 0007），松手一次提交一步 undo；数字输入
 * 一次一提交，是键盘可达的主通道。参数读写与视口浮动条共用
 * useFunctionCurveParamEditing，滑块本体共用 FunctionCurveSlider——
 * 两处同源，编辑永不打架。
 */

const props = defineProps<{ curve: FunctionCurvePrimitive }>();

const { t } = useI18n();

const paramKeys = computed(
  () => FUNCTION_CURVE_PARAM_KEYS[props.curve.kind],
);

const {
  errors,
  displayValue,
  displayText,
  startParamPreview,
  commitParam,
  releaseSlider,
  settleSlider,
} = useFunctionCurveParamEditing(() => props.curve);

/** 数字输入 / 原生步进：一次一提交。空输入不当作 0 提交：保留旧值，
 *  静默回退（退化值才有内联文案）；被拒输入同样回退为当前值。 */
function onNumberChange(key: FunctionCurveParamKey, event: Event): void {
  const input = event.target as HTMLInputElement;
  const present = functionCurveParamOf(functionCurveParamsOf(props.curve), key);
  if (input.value.trim() === "") {
    input.value = String(present);
    return;
  }
  const outcome = commitParam(key, Number(input.value));
  // 显示层与契约对齐：2.345 落 2.34，输入框也回写成 2.34。
  input.value =
    outcome.status === "committed"
      ? String(outcome.value)
      : String(present);
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
      <FunctionCurveSlider
        :label="t(`field.${key}`)"
        :value="displayValue(key)"
        @preview="(value) => startParamPreview(key, value)"
        @release="(raw) => releaseSlider(key, raw)"
        @settle="settleSlider"
      />
      <input
        :id="`curve-${curve.id}-${key}`"
        type="number"
        class="w-20 rounded border border-zinc-300 px-2 py-1"
        :step="NUMBER_STEP"
        :value="displayText(key)"
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
