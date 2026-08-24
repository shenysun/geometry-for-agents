<script setup lang="ts">
import { computed } from "vue";
import { ToggleGroupItem, ToggleGroupRoot } from "reka-ui";
import { useI18n } from "vue-i18n";
import { FILLS, withFill, type Fill, type Primitive } from "../document/index.ts";
import { useDocumentStore } from "../stores/document.ts";
import { useEditorStore } from "../stores/editor.ts";
import type { SolidPrimitive } from "../viewport3d/solid-commit.ts";

/** 参数体数字字段目录的键：位置、尺寸与三欧拉角（各类型取其子集） */
type SolidFieldKey =
  | "x"
  | "y"
  | "z"
  | "r"
  | "width"
  | "depth"
  | "height"
  | "rotationDegY"
  | "rotationDegX"
  | "rotationDegZ";

type SolidField = {
  key: SolidFieldKey;
  labelKey: `field.${SolidFieldKey}`;
  step: number;
  positive: boolean;
};

const POSITION_FIELDS: readonly SolidField[] = [
  { key: "x", labelKey: "field.x", step: 0.5, positive: false },
  { key: "y", labelKey: "field.y", step: 0.5, positive: false },
  { key: "z", labelKey: "field.z", step: 0.5, positive: false },
];

const ROTATION_FIELDS: readonly SolidField[] = [
  { key: "rotationDegY", labelKey: "field.rotationDegY", step: 15, positive: false },
  { key: "rotationDegX", labelKey: "field.rotationDegX", step: 15, positive: false },
  { key: "rotationDegZ", labelKey: "field.rotationDegZ", step: 15, positive: false },
];

const RADIUS_FIELD: SolidField = {
  key: "r",
  labelKey: "field.r",
  step: 0.5,
  positive: true,
};

const HEIGHT_FIELD: SolidField = {
  key: "height",
  labelKey: "field.height",
  step: 0.5,
  positive: true,
};

/** 按类型穷尽的字段目录：长方体三尺寸，圆柱/圆锥 r+height+旋转，球只有位置和 r */
function solidFields(type: SolidPrimitive["type"]): readonly SolidField[] {
  switch (type) {
    case "box":
      return [
        ...POSITION_FIELDS,
        { key: "width", labelKey: "field.width", step: 0.5, positive: true },
        { key: "depth", labelKey: "field.depth", step: 0.5, positive: true },
        HEIGHT_FIELD,
        ...ROTATION_FIELDS,
      ];
    case "cylinder":
    case "cone":
      return [...POSITION_FIELDS, RADIUS_FIELD, HEIGHT_FIELD, ...ROTATION_FIELDS];
    case "sphere":
      return [...POSITION_FIELDS, RADIUS_FIELD];
  }
}

/** 联合上按键读数字字段：字段目录按类型穷尽，读不到该键返回 null */
function numericFieldOf(
  primitive: SolidPrimitive,
  key: SolidFieldKey,
): number | null {
  const value = (primitive as Record<string, unknown>)[key];
  return typeof value === "number" ? value : null;
}

/** 字段目录按类型穷尽，键与数字值成对出现；联合上收窄交给这一处 */
function withNumericField(
  primitive: SolidPrimitive,
  key: SolidFieldKey,
  value: number,
): SolidPrimitive {
  return { ...primitive, [key]: value };
}

const documentStore = useDocumentStore();
const editor = useEditorStore();
const { t } = useI18n();

const selected = computed(() => {
  const id = editor.selectionId;
  if (id === null) return null;
  return (
    documentStore.current.primitives.find((primitive) => primitive.id === id) ??
    null
  );
});

const solid = computed<SolidPrimitive | null>(() => {
  const primitive = selected.value;
  if (primitive === null) return null;
  return (
    primitive.type === "box" ||
    primitive.type === "cylinder" ||
    primitive.type === "cone" ||
    primitive.type === "sphere"
      ? primitive
      : null
  );
});

const solidFieldList = computed(() =>
  solid.value === null ? [] : solidFields(solid.value.type),
);

/** 非数字或非法尺寸不写说明书，输入框回退为当前值 */
function onSolidFieldChange(key: SolidFieldKey, event: Event): void {
  const current = solid.value;
  if (current === null) return;
  const present = numericFieldOf(current, key);
  if (present === null) return;
  const input = event.target as HTMLInputElement;
  const value = Number(input.value);
  const field = solidFieldList.value.find((entry) => entry.key === key);
  const valid =
    Number.isFinite(value) && (field === undefined || !field.positive || value > 0);
  if (!valid || present === value) {
    input.value = String(present);
    return;
  }
  const next = withNumericField(current, key, value);
  const result = documentStore.updatePrimitive(next.id, next);
  if (!result.success) {
    input.value = String(present);
  }
}

const fill = computed((): Fill | null => {
  const primitive = selected.value;
  if (primitive === null || !("fill" in primitive)) return null;
  return primitive.fill;
});

function onFillChange(value: string | string[] | undefined): void {
  if (value !== "none" && value !== "solid" && value !== "hatch") return;
  const primitive = selected.value;
  if (primitive === null) return;
  if ("fill" in primitive && primitive.fill === value) return;
  const next = withFill(primitive, value);
  if (next === null) return;
  documentStore.updatePrimitive(next.id, next);
}
</script>

<template>
  <div
    v-if="selected !== null"
    class="h-full space-y-3 overflow-auto px-3 py-3 text-sm"
  >
    <p class="font-medium">{{ selected.type }} · {{ selected.id }}</p>
    <div v-if="solid !== null" class="grid grid-cols-2 gap-2">
      <label v-for="field in solidFieldList" :key="field.key" class="space-y-1">
        <span class="block text-zinc-500">{{ t(field.labelKey) }}</span>
        <input
          type="number"
          :step="field.step"
          :value="numericFieldOf(solid, field.key) ?? 0"
          :aria-label="t(field.labelKey)"
          class="w-full rounded border border-zinc-300 px-2 py-1"
          @change="onSolidFieldChange(field.key, $event)"
        />
      </label>
    </div>
    <div v-if="fill !== null">
      <p class="mb-1 text-zinc-500">{{ t("fill.label") }}</p>
      <ToggleGroupRoot
        type="single"
        :model-value="fill"
        class="inline-flex rounded-md border border-zinc-300 p-0.5"
        :aria-label="t('fill.label')"
        @update:model-value="onFillChange"
      >
        <ToggleGroupItem
          v-for="code in FILLS"
          :key="code"
          :value="code"
          class="rounded px-2 py-1 text-sm data-[state=on]:bg-zinc-800 data-[state=on]:text-white"
        >
          {{ t(`fill.${code}`) }}
        </ToggleGroupItem>
      </ToggleGroupRoot>
    </div>
  </div>
  <p v-else class="px-3 text-sm text-zinc-600">{{ t("properties.empty") }}</p>
</template>
