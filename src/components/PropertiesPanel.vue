<script setup lang="ts">
import { computed } from "vue";
import { ToggleGroupItem, ToggleGroupRoot } from "reka-ui";
import { useI18n } from "vue-i18n";
import { FILLS, withFill, type Fill, type Primitive } from "../document/index.ts";
import { useDocumentStore } from "../stores/document.ts";
import { useEditorStore } from "../stores/editor.ts";

type BoxPrimitive = Extract<Primitive, { type: "box" }>;
type BoxFieldKey = keyof Omit<BoxPrimitive, "id" | "type">;

/** 长方体在属性面板暴露的数字字段：位置（底面中心）+ 三尺寸 + 三欧拉角 */
const BOX_FIELDS: readonly {
  key: BoxFieldKey;
  labelKey: `field.${BoxFieldKey}`;
  step: number;
  positive: boolean;
}[] = [
  { key: "x", labelKey: "field.x", step: 0.5, positive: false },
  { key: "y", labelKey: "field.y", step: 0.5, positive: false },
  { key: "z", labelKey: "field.z", step: 0.5, positive: false },
  { key: "width", labelKey: "field.width", step: 0.5, positive: true },
  { key: "depth", labelKey: "field.depth", step: 0.5, positive: true },
  { key: "height", labelKey: "field.height", step: 0.5, positive: true },
  { key: "rotationDegY", labelKey: "field.rotationDegY", step: 15, positive: false },
  { key: "rotationDegX", labelKey: "field.rotationDegX", step: 15, positive: false },
  { key: "rotationDegZ", labelKey: "field.rotationDegZ", step: 15, positive: false },
];

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

const box = computed(() => {
  const primitive = selected.value;
  return primitive !== null && primitive.type === "box" ? primitive : null;
});

/** 非数字或非法尺寸不写说明书，输入框回退为当前值 */
function onBoxFieldChange(key: BoxFieldKey, event: Event): void {
  const current = box.value;
  if (current === null) return;
  const input = event.target as HTMLInputElement;
  const value = Number(input.value);
  const field = BOX_FIELDS.find((entry) => entry.key === key);
  const valid =
    Number.isFinite(value) && (field === undefined || !field.positive || value > 0);
  if (!valid || current[key] === value) {
    input.value = String(current[key]);
    return;
  }
  const next: BoxPrimitive = { ...current, [key]: value };
  const result = documentStore.updatePrimitive(next.id, next);
  if (!result.success) {
    input.value = String(current[key]);
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
    <div v-if="box !== null" class="grid grid-cols-2 gap-2">
      <label v-for="field in BOX_FIELDS" :key="field.key" class="space-y-1">
        <span class="block text-zinc-500">{{ t(field.labelKey) }}</span>
        <input
          type="number"
          :step="field.step"
          :value="box[field.key]"
          :aria-label="t(field.labelKey)"
          class="w-full rounded border border-zinc-300 px-2 py-1"
          @change="onBoxFieldChange(field.key, $event)"
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
