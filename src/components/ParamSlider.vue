<script setup lang="ts">
import {
  clampToRange,
  sliderReleaseCommits,
  sliderSettlesWithoutCommit,
  startSliderInteraction,
  trackSliderInput,
  type SliderDomain,
  type SliderInteraction,
} from "./function-curve-field.ts";

/**
 * 参数滑块本体（ADR 0021 / 票 04，票 05 泛化）：属性面板与视口浮动条
 * 共用的滑块——同精度、超范围钳柄端点（数值保留）。拖动发 preview
 * （只进预览层实时重绘）、松手发 release（一次提交一步 undo），提交
 * 语义由各族共用的参数编辑 composable 收口。域（min/max/step）由调用
 * 方传入：函数曲线 [-10,10]，变换族角度 0–360、比 [-5,5]。
 *
 * 零位移触碰不发 release（票 06）：越界契约值的柄钳在端点，点一下
 * 柄/轨道产生的 change 值只会是钳后值，提交它等于把越界值静默钳到
 * 端点。位移记录与收尾判定走 function-curve-field 的纯函数层；DOM
 * 值回到柄值的松手（含拖离又拖回）change 按规范不会来，pointerup
 * 发 settle 就地清算预览。
 */

const props = defineProps<{
  label: string;
  value: number;
  range: SliderDomain;
}>();

const emit = defineEmits<{
  preview: [value: number];
  release: [raw: string];
  settle: [];
}>();

/** 当前指针交互的位移记录；pointerdown 起算，change/pointerup 收尾。 */
let interaction: SliderInteraction | null = null;

function onPointerDown(): void {
  interaction = startSliderInteraction(props.value, props.range);
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
    :min="range.min"
    :max="range.max"
    :step="range.step"
    :value="clampToRange(value, range)"
    :aria-label="`${label} slider`"
    @pointerdown="onPointerDown"
    @input="onInput"
    @change="onChange"
    @pointerup="onPointerUp"
  />
</template>
