<script setup lang="ts">
import { computed } from "vue";
import { ToggleGroupItem, ToggleGroupRoot } from "reka-ui";
import { useI18n } from "vue-i18n";
import {
  FILLS,
  withFill,
  type Fill,
  type Primitive,
} from "../document/index.ts";
import { useDocumentStore } from "../stores/document.ts";
import { useEditorStore } from "../stores/editor.ts";
import {
  isSolidPrimitive,
  type SolidPrimitive,
} from "../viewport3d/solid-commit.ts";

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

/** 平面参数形（矩形与底/高家族）数字字段目录的键 */
type PlanarFieldKey =
  | "x"
  | "y"
  | "width"
  | "height"
  | "apexOffset"
  | "skew"
  | "topWidth"
  | "topOffset"
  | "rotationDeg"
  | "startDeg"
  | "endDeg"
  | "length";

type PlanarField = {
  key: PlanarFieldKey;
  labelKey: `field.${PlanarFieldKey}`;
  step: number;
  positive: boolean;
};

const PLANAR_POSITION_FIELDS: readonly PlanarField[] = [
  { key: "x", labelKey: "field.x", step: 0.5, positive: false },
  { key: "y", labelKey: "field.y", step: 0.5, positive: false },
];

const PLANAR_ROTATION_FIELD: PlanarField = {
  key: "rotationDeg",
  labelKey: "field.rotationDeg",
  step: 15,
  positive: false,
};

/** 平面参数形类型：字段目录按类型取其子集 */
type PlanarParametric = Extract<
  Primitive,
  { type: "rectangle" | "triangle" | "parallelogram" | "trapezoid" }
>;

/** 按类型穷尽的字段目录：锚点、尺寸（正数）、家族偏移（可负）与旋转角 */
function planarFields(type: PlanarParametric["type"]): readonly PlanarField[] {
  const widthField: PlanarField = {
    key: "width",
    labelKey: "field.width",
    step: 0.5,
    positive: true,
  };
  const heightField: PlanarField = {
    key: "height",
    labelKey: "field.height",
    step: 0.5,
    positive: true,
  };
  switch (type) {
    case "rectangle":
      return [
        ...PLANAR_POSITION_FIELDS,
        widthField,
        heightField,
        PLANAR_ROTATION_FIELD,
      ];
    case "triangle":
      return [
        ...PLANAR_POSITION_FIELDS,
        widthField,
        heightField,
        { key: "apexOffset", labelKey: "field.apexOffset", step: 0.5, positive: false },
        PLANAR_ROTATION_FIELD,
      ];
    case "parallelogram":
      return [
        ...PLANAR_POSITION_FIELDS,
        widthField,
        heightField,
        { key: "skew", labelKey: "field.skew", step: 0.5, positive: false },
        PLANAR_ROTATION_FIELD,
      ];
    case "trapezoid":
      return [
        ...PLANAR_POSITION_FIELDS,
        widthField,
        { key: "topWidth", labelKey: "field.topWidth", step: 0.5, positive: true },
        heightField,
        { key: "topOffset", labelKey: "field.topOffset", step: 0.5, positive: false },
        PLANAR_ROTATION_FIELD,
      ];
  }
}

/** 按类型穷尽的字段目录：长方体/四棱锥三尺寸，圆柱/圆锥 r+height+旋转，
 * 三棱柱 base 三点单独一节，球只有位置和 r */
function solidFields(type: SolidPrimitive["type"]): readonly SolidField[] {
  switch (type) {
    case "box":
    case "pyramid":
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
    case "triangularPrism":
      return [...POSITION_FIELDS, HEIGHT_FIELD, ...ROTATION_FIELDS];
  }
}

/** 联合上按键读数字字段：字段目录按类型穷尽，读不到该键返回 null */
function numericFieldOf(
  primitive: Primitive,
  key: string,
): number | null {
  const value = (primitive as Record<string, unknown>)[key];
  return typeof value === "number" ? value : null;
}

/** 数字字段提交的校验形状：提交校验只看键与是否必须为正 */
type NumericFieldEntry = {
  key: string;
  positive: boolean;
};

/** 通用数字字段提交：非数字或非法值不写说明书，输入框回退为当前值 */
function commitNumericField(
  primitive: Primitive,
  fields: readonly NumericFieldEntry[],
  key: string,
  event: Event,
): void {
  const input = event.target as HTMLInputElement;
  const present = numericFieldOf(primitive, key);
  if (present === null) return;
  const value = Number(input.value);
  const field = fields.find((entry) => entry.key === key);
  const valid =
    Number.isFinite(value) &&
    (field === undefined || !field.positive || value > 0);
  if (!valid || present === value) {
    input.value = String(present);
    return;
  }
  const result = documentStore.updatePrimitive(primitive.id, {
    ...primitive,
    [key]: value,
  });
  if (!result.success) {
    input.value = String(present);
  }
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

const solid = computed(() => {
  const primitive = selected.value;
  return primitive !== null && isSolidPrimitive(primitive) ? primitive : null;
});

const solidFieldList = computed(() =>
  solid.value === null ? [] : solidFields(solid.value.type),
);

const planar = computed(() => {
  const primitive = selected.value;
  return primitive !== null &&
    (primitive.type === "rectangle" ||
      primitive.type === "triangle" ||
      primitive.type === "parallelogram" ||
      primitive.type === "trapezoid")
    ? primitive
    : null;
});

const planarFieldList = computed(() =>
  planar.value === null ? [] : planarFields(planar.value.type),
);

/** 角字段目录：顶点、两方向角（可负/可超 360，提交归一由契约把关）与边长 */
const ANGLE_FIELDS: readonly PlanarField[] = [
  { key: "x", labelKey: "field.x", step: 0.5, positive: false },
  { key: "y", labelKey: "field.y", step: 0.5, positive: false },
  { key: "startDeg", labelKey: "field.startDeg", step: 15, positive: false },
  { key: "endDeg", labelKey: "field.endDeg", step: 15, positive: false },
  { key: "length", labelKey: "field.length", step: 0.5, positive: true },
];

const angle = computed(() => {
  const primitive = selected.value;
  return primitive !== null && primitive.type === "angle" ? primitive : null;
});

const prism = computed(() => {
  const primitive = solid.value;
  return primitive !== null && primitive.type === "triangularPrism"
    ? primitive
    : null;
});

/** 拖开底面三点可把正三角底变成一般三角形：只动那一处几何，不可变 */
function onBasePointChange(
  index: 0 | 1 | 2,
  axis: "x" | "z",
  event: Event,
): void {
  const current = prism.value;
  if (current === null) return;
  const input = event.target as HTMLInputElement;
  const value = Number(input.value);
  const present = current.base[index][axis];
  if (!Number.isFinite(value) || present === value) {
    input.value = String(present);
    return;
  }
  const next = {
    ...current,
    base: current.base.map((point, at) =>
      at === index ? { ...point, [axis]: value } : point,
    ),
  };
  const result = documentStore.updatePrimitive(next.id, next);
  if (!result.success) {
    input.value = String(present);
  }
}

/** 非数字或非法尺寸不写说明书，输入框回退为当前值 */
function onSolidFieldChange(key: SolidFieldKey, event: Event): void {
  const current = solid.value;
  if (current === null) return;
  commitNumericField(current, solidFieldList.value, key, event);
}

/** 平面参数形字段编辑：与参数体共用数字字段提交路径，非法尺寸被契约拒绝 */
function onPlanarFieldChange(key: PlanarFieldKey, event: Event): void {
  const current = planar.value;
  if (current === null) return;
  commitNumericField(current, planarFieldList.value, key, event);
}

/** 角字段编辑：零角/周角等退化取值被契约拒绝并回退 */
function onAngleFieldChange(key: PlanarFieldKey, event: Event): void {
  const current = angle.value;
  if (current === null) return;
  commitNumericField(current, ANGLE_FIELDS, key, event);
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
    <div v-if="planar !== null" class="grid grid-cols-2 gap-2">
      <label
        v-for="field in planarFieldList"
        :key="field.key"
        class="space-y-1"
      >
        <span class="block text-zinc-500">{{ t(field.labelKey) }}</span>
        <input
          type="number"
          :step="field.step"
          :value="numericFieldOf(planar, field.key) ?? 0"
          :aria-label="t(field.labelKey)"
          class="w-full rounded border border-zinc-300 px-2 py-1"
          @change="onPlanarFieldChange(field.key, $event)"
        />
      </label>
    </div>
    <div v-if="angle !== null" class="grid grid-cols-2 gap-2">
      <label v-for="field in ANGLE_FIELDS" :key="field.key" class="space-y-1">
        <span class="block text-zinc-500">{{ t(field.labelKey) }}</span>
        <input
          type="number"
          :step="field.step"
          :value="numericFieldOf(angle, field.key) ?? 0"
          :aria-label="t(field.labelKey)"
          class="w-full rounded border border-zinc-300 px-2 py-1"
          @change="onAngleFieldChange(field.key, $event)"
        />
      </label>
    </div>
    <div v-if="prism !== null" class="space-y-2">
      <p class="text-zinc-500">{{ t("field.base") }}</p>
      <div
        v-for="(point, index) in prism.base"
        :key="index"
        class="grid grid-cols-2 gap-2"
      >
        <span class="col-span-2 text-zinc-400">
          {{ t("field.basePoint") }} {{ index + 1 }}
        </span>
        <label v-for="axis in ['x', 'z'] as const" :key="axis" class="space-y-1">
          <span class="block text-zinc-500">{{ t(`field.${axis}`) }}</span>
          <input
            type="number"
            step="0.1"
            :value="point[axis]"
            :aria-label="`${t('field.basePoint')} ${index + 1} ${t(`field.${axis}`)}`"
            class="w-full rounded border border-zinc-300 px-2 py-1"
            @change="onBasePointChange(index as 0 | 1 | 2, axis, $event)"
          />
        </label>
      </div>
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
