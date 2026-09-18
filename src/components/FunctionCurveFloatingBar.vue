<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import {
  FUNCTION_CURVE_PARAM_KEYS,
  formatFunctionExpression,
  type FunctionCurveParamKey,
  type FunctionCurvePrimitive,
} from "../document/function-curve.ts";
import { NUMBER_STEP } from "./function-curve-field.ts";
import FunctionCurveSlider from "./FunctionCurveSlider.vue";
import { useFunctionCurveParamEditing } from "./use-function-curve-param-editing.ts";

/**
 * 视口浮动滑块条（ADR 0021 / 票 04）：选中函数曲线时悬在视口上方，
 * 不离视口探究参数。与属性面板（03）共用 useFunctionCurveParamEditing
 * 与 FunctionCurveSlider——同一份契约字段、同规格同精度、同一条预览/
 * 提交管线，两处编辑永不打架。仅指针操作：步进按钮按普通可点击控件
 * 处理，键盘可达主通道是属性面板数字框；拖动即时重绘、松手一步 undo。
 */

const props = defineProps<{ curve: FunctionCurvePrimitive }>();

const { t } = useI18n();

const paramKeys = computed(
  () => FUNCTION_CURVE_PARAM_KEYS[props.curve.kind],
);

const {
  errors,
  previewParams,
  displayValue,
  displayText,
  startParamPreview,
  commitParam,
  releaseSlider,
  settleSlider,
} = useFunctionCurveParamEditing(() => props.curve);

/** 解析式随拖动跟手：预览活跃时格式化预览参数，松手回落契约
 *  （与属性面板的解析式行同源同更新）。 */
const expression = computed(() => formatFunctionExpression(previewParams.value));

/** 步进按钮（普通可点击控件）：一次一提交；步进落在退化值上与数字
 *  输入同款——内联报错、保留旧值，不静默钳制。 */
function onStep(key: FunctionCurveParamKey, direction: -1 | 1): void {
  commitParam(key, displayValue(key) + direction * NUMBER_STEP);
}
</script>

<template>
  <div
    class="absolute left-1/2 top-2 z-20 -translate-x-1/2 space-y-1 rounded-lg border border-zinc-200 bg-white/95 px-3 py-2 shadow-md"
    data-function-curve-bar
  >
    <p
      class="text-center font-mono text-xs text-zinc-600"
      data-function-curve-expression
    >
      {{ expression }}
    </p>
    <div v-for="key in paramKeys" :key="key" class="space-y-0.5">
      <div class="flex items-center gap-2">
        <span class="w-4 shrink-0 text-sm text-zinc-500">
          {{ t(`field.${key}`) }}
        </span>
        <button
          type="button"
          class="size-6 shrink-0 rounded border border-zinc-300 text-zinc-600 hover:bg-zinc-100"
          :aria-label="`${t(`field.${key}`)} −`"
          @click="onStep(key, -1)"
        >
          −
        </button>
        <FunctionCurveSlider
          :label="t(`field.${key}`)"
          :value="displayValue(key)"
          @preview="(value) => startParamPreview(key, value)"
          @release="(raw) => releaseSlider(key, raw)"
          @settle="settleSlider"
        />
        <button
          type="button"
          class="size-6 shrink-0 rounded border border-zinc-300 text-zinc-600 hover:bg-zinc-100"
          :aria-label="`${t(`field.${key}`)} +`"
          @click="onStep(key, 1)"
        >
          +
        </button>
        <span
          class="w-10 shrink-0 text-right font-mono text-xs tabular-nums text-zinc-600"
        >
          {{ displayText(key) }}
        </span>
      </div>
      <p
        v-if="errors[key] !== undefined"
        class="text-center text-xs text-red-600"
        role="alert"
      >
        {{ errors[key] }}
      </p>
    </div>
  </div>
</template>
