<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import {
  TRANSFORM_PARAM_KEYS,
  transformParamOf,
  type TransformParamKey,
  type TransformPrimitive,
} from "../document/transform-math.ts";
import {
  ANGLE_SLIDER_RANGE,
  RATIO_SLIDER_RANGE,
  normalizeAngleDeg,
  transformParamDisplayText,
} from "./transform-field.ts";
import type { SliderDomain } from "./function-curve-field.ts";
import ParamSlider from "./ParamSlider.vue";
import { useTransformParamEditing } from "./use-transform-param-editing.ts";

/**
 * 变换图元参数编辑（ADR 0022 / 票 05）：按 kind 显示字段形状——平移位移
 * 向量、旋转/位似中心、轴对称轴两端点；angleDeg 与 ratio 各配滑块
 * （复用函数曲线的 preview/release 骨架：拖动像实时转动/连续缩放、
 * 松手一步 undo）。数字输入一次一提交，键盘可达主通道；坐标字段步进
 * 0.5 沿平面参数形面板惯例，滑块字段步进与滑块一致。kind 与源 id 在
 * 面板外层只读展示（kind 由创建工具定死，先例函数曲线）。
 */

const props = defineProps<{ entry: TransformPrimitive }>();

const { t } = useI18n();

/** 滑块域：angleDeg 归一 0–360、ratio 含负比；其余字段只有数字框。 */
const SLIDER_RANGES: Partial<Record<TransformParamKey, SliderDomain>> = {
  angleDeg: ANGLE_SLIDER_RANGE,
  ratio: RATIO_SLIDER_RANGE,
};

/** 面板字段行：键 + 滑块域（null 即纯数字框）+ 步进粒度。 */
type TransformFieldRow = {
  key: TransformParamKey;
  range: SliderDomain | null;
  step: number;
};

const COORDINATE_STEP = 0.5;

const fields = computed<readonly TransformFieldRow[]>(() =>
  TRANSFORM_PARAM_KEYS[props.entry.kind].map((key) => {
    const range = SLIDER_RANGES[key] ?? null;
    return { key, range, step: range?.step ?? COORDINATE_STEP };
  }),
);

const {
  errors,
  previewParams,
  startParamPreview,
  commitParam,
  releaseSlider,
  settleSlider,
} = useTransformParamEditing(() => props.entry);

/** 展示文本统一走纯层：angleDeg 归一 0–360，全部两位小数截断。 */
function displayText(key: TransformParamKey): string {
  return transformParamDisplayText(previewParams.value, key);
}

/** 滑块柄值：angleDeg 用归一值落进 0–360 域（存储保符号，US 30），
 *  其余字段原值（拖动中的预览值跟手，柄由组件钳端点）。 */
function sliderValue(key: TransformParamKey): number {
  const value = transformParamOf(previewParams.value, key);
  return key === "angleDeg" ? normalizeAngleDeg(value) : value;
}

/** 数字输入 / 原生步进：一次一提交。空输入不当作 0 提交：保留旧值，
 *  静默回退（退化值才有内联文案）；被拒输入同样回退为当前展示值。 */
function onNumberChange(key: TransformParamKey, event: Event): void {
  const input = event.target as HTMLInputElement;
  if (input.value.trim() === "") {
    input.value = displayText(key);
    return;
  }
  commitParam(key, Number(input.value));
  // 显示层与契约对齐：提交后（或保留旧值后）按展示规则回写输入框。
  input.value = displayText(key);
}
</script>

<template>
  <div v-for="field in fields" :key="field.key" class="space-y-1">
    <div class="flex items-center gap-2">
      <label
        class="w-14 shrink-0 text-zinc-500"
        :for="`transform-${entry.id}-${field.key}`"
      >
        {{ t(`field.${field.key}`) }}
      </label>
      <ParamSlider
        v-if="field.range !== null"
        :label="t(`field.${field.key}`)"
        :value="sliderValue(field.key)"
        :range="field.range"
        @preview="(value) => startParamPreview(field.key, value)"
        @release="(raw) => releaseSlider(field.key, raw)"
        @settle="settleSlider"
      />
      <input
        :id="`transform-${entry.id}-${field.key}`"
        type="number"
        class="rounded border border-zinc-300 px-2 py-1"
        :class="field.range === null ? 'w-24' : 'w-20'"
        :step="field.step"
        :value="displayText(field.key)"
        @change="onNumberChange(field.key, $event)"
      />
    </div>
    <p
      v-if="errors[field.key] !== undefined"
      :class="field.range === null ? '' : 'pl-16'"
      class="text-xs text-red-600"
      role="alert"
    >
      {{ errors[field.key] }}
    </p>
  </div>
</template>
