<script setup lang="ts">
import { SLIDER_RANGE, clampToSliderRange } from "./function-curve-field.ts";

/**
 * 函数曲线参数滑块（ADR 0021 / 票 04）：属性面板与视口浮动条共用的
 * 滑块本体——同域同精度、超范围钳柄端点（数值保留）。拖动发 preview
 * （只进预览层实时重绘）、松手发 release（一次提交一步 undo），提交
 * 语义由两处共用的 useFunctionCurveParamEditing 收口。
 */

defineProps<{ label: string; value: number }>();

const emit = defineEmits<{
  preview: [value: number];
  release: [raw: string];
}>();

function onInput(event: Event): void {
  emit("preview", Number((event.target as HTMLInputElement).value));
}

function onChange(event: Event): void {
  emit("release", (event.target as HTMLInputElement).value);
}
</script>

<template>
  <input
    type="range"
    class="min-w-0 flex-1 accent-indigo-600"
    :min="SLIDER_RANGE.min"
    :max="SLIDER_RANGE.max"
    :step="SLIDER_RANGE.step"
    :value="clampToSliderRange(value)"
    :aria-label="`${label} slider`"
    @input="onInput"
    @change="onChange"
  />
</template>
