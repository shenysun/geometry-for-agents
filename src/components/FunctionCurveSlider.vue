<script setup lang="ts">
import {
  SLIDER_RANGE,
  clampToSliderRange,
  sliderReleaseCommits,
  sliderSettlesWithoutCommit,
  startSliderInteraction,
  trackSliderInput,
  type SliderInteraction,
} from "./function-curve-field.ts";

/**
 * 函数曲线参数滑块（ADR 0021 / 票 04）：属性面板与视口浮动条共用的
 * 滑块本体——同域同精度、超范围钳柄端点（数值保留）。拖动发 preview
 * （只进预览层实时重绘）、松手发 release（一次提交一步 undo），提交
 * 语义由两处共用的 useFunctionCurveParamEditing 收口。
 *
 * 零位移触碰不发 release（票 06）：越界契约值的柄钳在端点，点一下
 * 柄/轨道产生的 change 值只会是钳后值，提交它等于把越界值静默钳到
 * 端点。位移记录与收尾判定走 function-curve-field 的纯函数层；DOM
 * 值回到柄值的松手（含拖离又拖回）change 按规范不会来，pointerup
 * 发 settle 就地清算预览。
 */

const props = defineProps<{ label: string; value: number }>();

const emit = defineEmits<{
  preview: [value: number];
  release: [raw: string];
  settle: [];
}>();

/** 当前指针交互的位移记录；pointerdown 起算，change/pointerup 收尾。 */
let interaction: SliderInteraction | null = null;

function onPointerDown(): void {
  interaction = startSliderInteraction(props.value);
}

function onInput(event: Event): void {
  const value = Number((event.target as HTMLInputElement).value);
  if (interaction !== null) {
    interaction = trackSliderInput(interaction, value);
  }
  emit("preview", value);
}

function onChange(event: Event): void {
  const touchedOnly = interaction !== null && !sliderReleaseCommits(interaction);
  interaction = null;
  if (touchedOnly) return;
  emit("release", (event.target as HTMLInputElement).value);
}

function onPointerUp(event: Event): void {
  if (interaction === null) return;
  const settles = sliderSettlesWithoutCommit(
    interaction,
    Number((event.target as HTMLInputElement).value),
  );
  interaction = null;
  if (settles) emit("settle");
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
    @pointerdown="onPointerDown"
    @input="onInput"
    @change="onChange"
    @pointerup="onPointerUp"
  />
</template>
