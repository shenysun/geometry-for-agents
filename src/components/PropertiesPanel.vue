<script setup lang="ts">
import { computed } from "vue";
import { ToggleGroupItem, ToggleGroupRoot } from "reka-ui";
import { useI18n } from "vue-i18n";
import {
  FILLS,
  withFill,
  type Fill,
  type Primitive,
  type Primitive2d,
} from "../document/index.ts";
import {
  formatFunctionExpression,
  functionCurveParamsOf,
} from "../document/function-curve.ts";
import { formatMeasureNumber } from "../document/measure-math.ts";
import { useDocumentStore } from "../stores/document.ts";
import { useEditorStore } from "../stores/editor.ts";
import {
  isSolidPrimitive,
  type SolidPrimitive,
} from "../viewport3d/solid-commit.ts";
import { displayNamesById } from "./display-name.ts";
import {
  validateNumericField,
  truncateToPrecision,
  truncateToInteger,
} from "./numeric-precision.ts";

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
  | "length"
  | "sides"
  | "r";

type PlanarField = {
  key: PlanarFieldKey;
  labelKey: `field.${PlanarFieldKey}`;
  step: number;
  positive: boolean;
  /** 整数约束（如正多边形边数）。 */
  integer?: boolean;
  /** 含下界（如 sides ≥ 5）。 */
  min?: number;
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
  {
    type:
      | "rectangle"
      | "triangle"
      | "parallelogram"
      | "trapezoid"
      | "regularPolygon";
  }
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
    case "regularPolygon":
      return [
        ...PLANAR_POSITION_FIELDS,
        { key: "sides", labelKey: "field.sides", step: 1, positive: true, integer: true, min: 5 },
        { key: "r", labelKey: "field.r", step: 0.5, positive: true },
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

/** 数字字段提交的校验形状：提交校验只看键与数值约束 */
type NumericFieldEntry = {
  key: string;
  positive: boolean;
  integer?: boolean;
  min?: number;
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
    (field === undefined || !field.positive || value > 0) &&
    (field === undefined || !field.integer || Number.isInteger(value)) &&
    (field === undefined || field.min === undefined || value >= field.min);
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

/** 选中图元的显示名（圆、圆1……）：随说明书与当前语言实时推导 */
const selectedName = computed(() => {
  const primitive = selected.value;
  if (primitive === null) return null;
  return (
    displayNamesById(documentStore.current.primitives, t).get(primitive.id) ??
    null
  );
});

/** 重叠填充的两源显示名（只读）：删源即级联删条目，不会出现悬空名。 */
const overlapSources = computed(() => {
  const primitive = selected.value;
  if (primitive === null || primitive.type !== "overlapFill") return null;
  const names = displayNamesById(documentStore.current.primitives, t);
  return primitive.sources.map((id) => names.get(id) ?? id);
});

/** 度量标注的源显示名与种类词条（只读）：引用关系无需拖动即可核实，
 *  数值是渲染期推导值，不设任何可编辑字段（ADR 0020）。 */
const measureInfo = computed(() => {
  const primitive = selected.value;
  if (primitive === null || primitive.type !== "measure") return null;
  const names = displayNamesById(documentStore.current.primitives, t);
  return {
    source: names.get(primitive.sourceId) ?? primitive.sourceId,
    kind: t(
      primitive.kind === "area"
        ? "tool.measureArea"
        : "tool.measurePerimeter",
    ),
  };
});

const solid = computed(() => {
  const primitive = selected.value;
  return primitive !== null && isSolidPrimitive(primitive) ? primitive : null;
});

/** 函数曲线只读信息（ADR 0021）：kind 创建时定死不可改（改 kind 等于换
 *  图元），参数的滑块/数字编辑是后续票的交付，本票只读展示种类与解析式。 */
const functionCurve = computed(() => {
  const primitive = selected.value;
  return primitive !== null && primitive.type === "functionCurve"
    ? primitive
    : null;
});

const functionCurveParams = computed(() => {
  const curve = functionCurve.value;
  if (curve === null) return [];
  switch (curve.kind) {
    case "linear":
      return [
        ["a", curve.a],
        ["b", curve.b],
      ] as const;
    case "quadratic":
      return [
        ["a", curve.a],
        ["b", curve.b],
        ["c", curve.c],
      ] as const;
    case "inverse":
      return [["k", curve.k]] as const;
  }
});

const functionCurveExpression = computed(() => {
  const curve = functionCurve.value;
  if (curve === null) return null;
  return formatFunctionExpression(functionCurveParamsOf(curve));
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
      primitive.type === "trapezoid" ||
      primitive.type === "regularPolygon")
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

/** 度数开关（ADR 0020）：勾选写 showDeg，取消移除字段回到老文档形态；
 *  数值是渲染期推导值，不设任何可编辑文字字段。 */
function onAngleShowDegChange(event: Event): void {
  const current = angle.value;
  if (current === null) return;
  const input = event.target as HTMLInputElement;
  const { showDeg: _removed, ...rest } = current;
  const next = input.checked ? { ...current, showDeg: true } : rest;
  const result = documentStore.updatePrimitive(current.id, next);
  if (!result.success) {
    input.checked = !input.checked;
  }
}


const circle = computed(() => {
  const primitive = selected.value;
  return primitive !== null && primitive.type === "circle" ? primitive : null;
});

const ring = computed(() => {
  const primitive = selected.value;
  return primitive !== null && primitive.type === "ring" ? primitive : null;
});

const arcFamily = computed(() => {
  const primitive = selected.value;
  return primitive !== null &&
    (primitive.type === "sector" ||
      primitive.type === "bow" ||
      primitive.type === "arc")
    ? primitive
    : null;
});

const ellipse = computed(() => {
  const primitive = selected.value;
  return primitive !== null && primitive.type === "ellipse" ? primitive : null;
});

/** 对应各图元的字段编辑处理函数 */
function onCircleFieldChange(
  key: "cx" | "cy" | "r",
  event: Event,
): void {
  const current = circle.value;
  if (current === null) return;
  const input = event.target as HTMLInputElement;
  const value = Number(input.value);
  const present = current[key];
  if (!Number.isFinite(value) || present === value) {
    input.value = String(present);
    return;
  }
  // cx/cy 可为负（圆心坐标），r 必须正数
  const constraints = key === "r" ? { positive: true } : {};
  const { valid, truncated } = validateNumericField(value, constraints);
  if (!valid) {
    input.value = String(present);
    return;
  }
  const result = documentStore.updatePrimitive(current.id, {
    ...current,
    [key]: truncated,
  });
  if (!result.success) {
    input.value = String(present);
  }
}

function onRingFieldChange(
  key: "cx" | "cy" | "rInner" | "rOuter",
  event: Event,
): void {
  const current = ring.value;
  if (current === null) return;
  const input = event.target as HTMLInputElement;
  const value = Number(input.value);
  const present = current[key];
  if (!Number.isFinite(value) || present === value) {
    input.value = String(present);
    return;
  }
  // cx/cy 可为负（圆心坐标），rInner/rOuter 必须正数
  const constraints = (key === "cx" || key === "cy") ? {} : { positive: true };
  const { valid, truncated } = validateNumericField(value, constraints);
  if (!valid) {
    input.value = String(present);
    return;
  }
  const result = documentStore.updatePrimitive(current.id, {
    ...current,
    [key]: truncated,
  });
  if (!result.success) {
    input.value = String(present);
  }
}

function onArcFamilyFieldChange(
  key: "cx" | "cy" | "r" | "startDeg" | "endDeg",
  event: Event,
): void {
  const current = arcFamily.value;
  if (current === null) return;
  const input = event.target as HTMLInputElement;
  const value = Number(input.value);
  const present = current[key];
  if (!Number.isFinite(value) || present === value) {
    input.value = String(present);
    return;
  }
  // cx/cy 可为负，r 必须正数，角度无约束
  const constraints = key === "r" ? { positive: true } : {};
  const { valid, truncated } = validateNumericField(value, constraints);
  if (!valid) {
    input.value = String(present);
    return;
  }
  const result = documentStore.updatePrimitive(current.id, {
    ...current,
    [key]: truncated,
  });
  if (!result.success) {
    input.value = String(present);
  }
}

function onEllipseFieldChange(
  key: "cx" | "cy" | "rx" | "ry" | "rotationDeg",
  event: Event,
): void {
  const current = ellipse.value;
  if (current === null) return;
  const input = event.target as HTMLInputElement;
  const value = Number(input.value);
  const present = current[key];
  if (!Number.isFinite(value) || present === value) {
    input.value = String(present);
    return;
  }
  // cx/cy 可为负，rx/ry 必须正数，rotationDeg 无约束
  const constraints = (key === "rx" || key === "ry") ? { positive: true } : {};
  const { valid, truncated } = validateNumericField(value, constraints);
  if (!valid) {
    input.value = String(present);
    return;
  }
  const result = documentStore.updatePrimitive(current.id, {
    ...current,
    [key]: truncated,
  });
  if (!result.success) {
    input.value = String(present);
  }
}

/** line/polygon 的顶点数组 */
const linePolygon = computed(() => {
  const primitive = selected.value;
  return primitive !== null &&
    (primitive.type === "line" || primitive.type === "polygon")
    ? primitive
    : null;
});

function onVertexChange(
  vertexIndex: number,
  axis: "x" | "y",
  event: Event,
): void {
  const current = linePolygon.value;
  if (current === null) return;
  const input = event.target as HTMLInputElement;
  const value = Number(input.value);
  const present = current.points[vertexIndex]?.[axis];
  if (!Number.isFinite(value) || present === value) {
    input.value = String(present);
    return;
  }
  const { valid, truncated } = validateNumericField(value, {});
  if (!valid) {
    input.value = String(present);
    return;
  }
  const next = {
    ...current,
    points: current.points.map((p, i) =>
      i === vertexIndex ? { ...p, [axis]: truncated } : p,
    ),
  };
  const result = documentStore.updatePrimitive(current.id, next);
  if (!result.success) {
    input.value = String(present);
  }
}

function onAddVertex(): void {
  const current = linePolygon.value;
  if (current === null) return;
  documentStore.addVertex(current.id);
}

function canRemoveVertex(count: number, type: string): boolean {
  return (type === "line" && count > 2) || (type === "polygon" && count > 3);
}

function onRemoveVertex(index: number): void {
  const current = linePolygon.value;
  if (current === null) return;
  documentStore.removeVertex(current.id, index);
}

/** label 的 text 编辑 */
const label = computed(() => {
  const primitive = selected.value;
  return primitive !== null && primitive.type === "label" ? primitive : null;
});

function onLabelTextChange(event: Event): void {
  const current = label.value;
  if (current === null) return;
  const input = event.target as HTMLInputElement;
  const text = input.value.trim();
  if (text === current.text) return;
  if (text.length === 0) {
    input.value = current.text;
    return;
  }
  const result = documentStore.updatePrimitive(current.id, {
    ...current,
    text,
  });
  if (!result.success) {
    input.value = current.text;
  }
}

/** dimension 的两个顶点 */
const dimension = computed(() => {
  const primitive = selected.value;
  return primitive !== null && primitive.type === "dimension"
    ? primitive
    : null;
});

function onDimensionPointChange(
  pointIndex: 0 | 1,
  axis: "x" | "y",
  event: Event,
): void {
  const current = dimension.value;
  if (current === null) return;
  const input = event.target as HTMLInputElement;
  const value = Number(input.value);
  const present = current.points[pointIndex][axis];
  if (!Number.isFinite(value) || present === value) {
    input.value = String(present);
    return;
  }
  const { valid, truncated } = validateNumericField(value, {});
  if (!valid) {
    input.value = String(present);
    return;
  }
  const [a, b] = current.points;
  const next = {
    ...current,
    points: [
      pointIndex === 0 ? { ...a, [axis]: truncated } : a,
      pointIndex === 1 ? { ...b, [axis]: truncated } : b,
    ],
  };
  const result = documentStore.updatePrimitive(current.id, next);
  if (!result.success) {
    input.value = String(present);
  }
}

/** voxel 的整数坐标 */
const voxel = computed(() => {
  const primitive = selected.value;
  return primitive !== null && primitive.type === "voxel" ? primitive : null;
});

function onVoxelFieldChange(key: "x" | "y" | "z", event: Event): void {
  const current = voxel.value;
  if (current === null) return;
  const input = event.target as HTMLInputElement;
  const value = Number(input.value);
  const present = current[key];
  if (!Number.isFinite(value) || present === value) {
    input.value = String(present);
    return;
  }
  const { valid, truncated } = validateNumericField(value, { integer: true });
  if (!valid) {
    input.value = String(present);
    return;
  }
  const result = documentStore.updatePrimitive(current.id, {
    ...current,
    [key]: truncated,
  });
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
    <p class="font-medium" :title="selected.id">{{ selectedName }}</p>
    <p v-if="overlapSources !== null" class="text-zinc-500">
      {{ t("field.sources") }}：{{ overlapSources.join(" ∩ ") }}
    </p>
    <div v-if="measureInfo !== null" class="space-y-1 text-zinc-500">
      <p>{{ t("field.source") }}：{{ measureInfo.source }}</p>
      <p>{{ t("field.kind") }}：{{ measureInfo.kind }}</p>
    </div>
    <div v-if="functionCurve !== null" class="space-y-1 text-zinc-500">
      <p>{{ t("field.kind") }}：{{ t(`tool.${functionCurve.kind}Function`) }}</p>
      <p v-for="([key, value]) in functionCurveParams" :key="key">
        {{ t(`field.${key}`) }}：{{ formatMeasureNumber(value) }}
      </p>
      <p>{{ functionCurveExpression }}</p>
    </div>
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
      <label class="col-span-2 flex items-center gap-2">
        <input
          type="checkbox"
          :checked="angle.showDeg === true"
          :aria-label="t('field.showDeg')"
          class="size-4 rounded border-zinc-300"
          @change="onAngleShowDegChange"
        />
        <span class="text-zinc-500">{{ t("field.showDeg") }}</span>
      </label>
    </div>
    <!-- 圆 -->
    <div v-if="circle !== null" class="grid grid-cols-2 gap-2">
      <label class="space-y-1">
        <span class="block text-zinc-500">{{ t("field.cx") }}</span>
        <input
          type="number"
          step="0.01"
          :value="circle.cx"
          :aria-label="t('field.cx')"
          class="w-full rounded border border-zinc-300 px-2 py-1"
          @change="onCircleFieldChange('cx', $event)"
        />
      </label>
      <label class="space-y-1">
        <span class="block text-zinc-500">{{ t("field.cy") }}</span>
        <input
          type="number"
          step="0.01"
          :value="circle.cy"
          :aria-label="t('field.cy')"
          class="w-full rounded border border-zinc-300 px-2 py-1"
          @change="onCircleFieldChange('cy', $event)"
        />
      </label>
      <label class="space-y-1">
        <span class="block text-zinc-500">{{ t("field.r") }}</span>
        <input
          type="number"
          step="0.01"
          :value="circle.r"
          :aria-label="t('field.r')"
          class="w-full rounded border border-zinc-300 px-2 py-1"
          @change="onCircleFieldChange('r', $event)"
        />
      </label>
    </div>

    <!-- 圆环 -->
    <div v-if="ring !== null" class="grid grid-cols-2 gap-2">
      <label class="space-y-1">
        <span class="block text-zinc-500">{{ t("field.cx") }}</span>
        <input
          type="number"
          step="0.01"
          :value="ring.cx"
          :aria-label="t('field.cx')"
          class="w-full rounded border border-zinc-300 px-2 py-1"
          @change="onRingFieldChange('cx', $event)"
        />
      </label>
      <label class="space-y-1">
        <span class="block text-zinc-500">{{ t("field.cy") }}</span>
        <input
          type="number"
          step="0.01"
          :value="ring.cy"
          :aria-label="t('field.cy')"
          class="w-full rounded border border-zinc-300 px-2 py-1"
          @change="onRingFieldChange('cy', $event)"
        />
      </label>
      <label class="space-y-1">
        <span class="block text-zinc-500">{{ t("field.rInner") }}</span>
        <input
          type="number"
          step="0.01"
          :value="ring.rInner"
          :aria-label="t('field.rInner')"
          class="w-full rounded border border-zinc-300 px-2 py-1"
          @change="onRingFieldChange('rInner', $event)"
        />
      </label>
      <label class="space-y-1">
        <span class="block text-zinc-500">{{ t("field.rOuter") }}</span>
        <input
          type="number"
          step="0.01"
          :value="ring.rOuter"
          :aria-label="t('field.rOuter')"
          class="w-full rounded border border-zinc-300 px-2 py-1"
          @change="onRingFieldChange('rOuter', $event)"
        />
      </label>
    </div>

    <!-- 扇形/弓形/弧 -->
    <div v-if="arcFamily !== null" class="grid grid-cols-2 gap-2">
      <label class="space-y-1">
        <span class="block text-zinc-500">{{ t("field.cx") }}</span>
        <input
          type="number"
          step="0.01"
          :value="arcFamily.cx"
          :aria-label="t('field.cx')"
          class="w-full rounded border border-zinc-300 px-2 py-1"
          @change="onArcFamilyFieldChange('cx', $event)"
        />
      </label>
      <label class="space-y-1">
        <span class="block text-zinc-500">{{ t("field.cy") }}</span>
        <input
          type="number"
          step="0.01"
          :value="arcFamily.cy"
          :aria-label="t('field.cy')"
          class="w-full rounded border border-zinc-300 px-2 py-1"
          @change="onArcFamilyFieldChange('cy', $event)"
        />
      </label>
      <label class="space-y-1">
        <span class="block text-zinc-500">{{ t("field.r") }}</span>
        <input
          type="number"
          step="0.01"
          :value="arcFamily.r"
          :aria-label="t('field.r')"
          class="w-full rounded border border-zinc-300 px-2 py-1"
          @change="onArcFamilyFieldChange('r', $event)"
        />
      </label>
      <label class="space-y-1">
        <span class="block text-zinc-500">{{ t("field.startDeg") }}</span>
        <input
          type="number"
          step="1"
          :value="arcFamily.startDeg"
          :aria-label="t('field.startDeg')"
          class="w-full rounded border border-zinc-300 px-2 py-1"
          @change="onArcFamilyFieldChange('startDeg', $event)"
        />
      </label>
      <label class="space-y-1">
        <span class="block text-zinc-500">{{ t("field.endDeg") }}</span>
        <input
          type="number"
          step="1"
          :value="arcFamily.endDeg"
          :aria-label="t('field.endDeg')"
          class="w-full rounded border border-zinc-300 px-2 py-1"
          @change="onArcFamilyFieldChange('endDeg', $event)"
        />
      </label>
    </div>

    <!-- 椭圆 -->
    <div v-if="ellipse !== null" class="grid grid-cols-2 gap-2">
      <label class="space-y-1">
        <span class="block text-zinc-500">{{ t("field.cx") }}</span>
        <input
          type="number"
          step="0.01"
          :value="ellipse.cx"
          :aria-label="t('field.cx')"
          class="w-full rounded border border-zinc-300 px-2 py-1"
          @change="onEllipseFieldChange('cx', $event)"
        />
      </label>
      <label class="space-y-1">
        <span class="block text-zinc-500">{{ t("field.cy") }}</span>
        <input
          type="number"
          step="0.01"
          :value="ellipse.cy"
          :aria-label="t('field.cy')"
          class="w-full rounded border border-zinc-300 px-2 py-1"
          @change="onEllipseFieldChange('cy', $event)"
        />
      </label>
      <label class="space-y-1">
        <span class="block text-zinc-500">{{ t("field.rx") }}</span>
        <input
          type="number"
          step="0.01"
          :value="ellipse.rx"
          :aria-label="t('field.rx')"
          class="w-full rounded border border-zinc-300 px-2 py-1"
          @change="onEllipseFieldChange('rx', $event)"
        />
      </label>
      <label class="space-y-1">
        <span class="block text-zinc-500">{{ t("field.ry") }}</span>
        <input
          type="number"
          step="0.01"
          :value="ellipse.ry"
          :aria-label="t('field.ry')"
          class="w-full rounded border border-zinc-300 px-2 py-1"
          @change="onEllipseFieldChange('ry', $event)"
        />
      </label>
      <label class="space-y-1">
        <span class="block text-zinc-500">{{ t("field.rotationDeg") }}</span>
        <input
          type="number"
          step="1"
          :value="ellipse.rotationDeg"
          :aria-label="t('field.rotationDeg')"
          class="w-full rounded border border-zinc-300 px-2 py-1"
          @change="onEllipseFieldChange('rotationDeg', $event)"
        />
      </label>
    </div>

    <!-- 线段/多边形顶点 -->
    <div v-if="linePolygon !== null" class="space-y-2">
      <p class="text-zinc-500">{{ t("field.vertex") }}</p>
      <div
        v-for="(point, index) in linePolygon.points"
        :key="index"
        class="grid grid-cols-3 gap-2"
      >
        <span class="col-span-3 text-zinc-400">
          {{ t("field.vertex") }} {{ index + 1 }}
        </span>
        <label class="space-y-1 col-span-1">
          <span class="block text-zinc-500">{{ t("field.x") }}</span>
          <input
            type="number"
            step="0.01"
            :value="point.x"
            :aria-label="`${t('field.vertex')} ${index + 1} X`"
            class="w-full rounded border border-zinc-300 px-2 py-1"
            @change="onVertexChange(index, 'x', $event)"
          />
        </label>
        <label class="space-y-1 col-span-1">
          <span class="block text-zinc-500">{{ t("field.y") }}</span>
          <input
            type="number"
            step="0.01"
            :value="point.y"
            :aria-label="`${t('field.vertex')} ${index + 1} Y`"
            class="w-full rounded border border-zinc-300 px-2 py-1"
            @change="onVertexChange(index, 'y', $event)"
          />
        </label>
        <button
          v-if="canRemoveVertex(linePolygon.points.length, linePolygon.type)"
          type="button"
          class="col-span-1 rounded border border-red-300 px-2 py-1 text-red-600 hover:bg-red-50"
          @click="onRemoveVertex(index)"
        >
          删除
        </button>
        <div v-else class="col-span-1"></div>
      </div>
      <button
        type="button"
        class="w-full rounded border border-zinc-300 bg-zinc-50 px-2 py-1 text-zinc-600 hover:bg-zinc-100"
        @click="onAddVertex"
      >
        + 添加顶点
      </button>
    </div>

    <!-- 标注线顶点 -->
    <div v-if="dimension !== null" class="space-y-2">
      <p class="text-zinc-500">顶点</p>
      <div v-for="(point, index) in dimension.points" :key="index" class="grid grid-cols-2 gap-2">
        <span class="col-span-2 text-zinc-400">顶点 {{ index + 1 }}</span>
        <label class="space-y-1">
          <span class="block text-zinc-500">{{ t("field.x") }}</span>
          <input
            type="number"
            step="0.01"
            :value="point.x"
            :aria-label="`顶点 ${index + 1} X`"
            class="w-full rounded border border-zinc-300 px-2 py-1"
            @change="onDimensionPointChange(index as 0 | 1, 'x', $event)"
          />
        </label>
        <label class="space-y-1">
          <span class="block text-zinc-500">{{ t("field.y") }}</span>
          <input
            type="number"
            step="0.01"
            :value="point.y"
            :aria-label="`顶点 ${index + 1} Y`"
            class="w-full rounded border border-zinc-300 px-2 py-1"
            @change="onDimensionPointChange(index as 0 | 1, 'y', $event)"
          />
        </label>
      </div>
    </div>

    <!-- label 文字 -->
    <div v-if="label !== null" class="space-y-2">
      <label class="space-y-1">
        <span class="block text-zinc-500">{{ t("field.text") }}</span>
        <input
          type="text"
          :value="label.text"
          :aria-label="t('field.text')"
          class="w-full rounded border border-zinc-300 px-2 py-1"
          @change="onLabelTextChange"
        />
      </label>
    </div>

    <!-- voxel 坐标 -->
    <div v-if="voxel !== null" class="grid grid-cols-2 gap-2">
      <label class="space-y-1">
        <span class="block text-zinc-500">{{ t("field.x") }}</span>
        <input
          type="number"
          step="1"
          :value="voxel.x"
          :aria-label="t('field.x')"
          class="w-full rounded border border-zinc-300 px-2 py-1"
          @change="onVoxelFieldChange('x', $event)"
        />
      </label>
      <label class="space-y-1">
        <span class="block text-zinc-500">{{ t("field.y") }}</span>
        <input
          type="number"
          step="1"
          :value="voxel.y"
          :aria-label="t('field.y')"
          class="w-full rounded border border-zinc-300 px-2 py-1"
          @change="onVoxelFieldChange('y', $event)"
        />
      </label>
      <label class="space-y-1">
        <span class="block text-zinc-500">{{ t("field.z") }}</span>
        <input
          type="number"
          step="1"
          :value="voxel.z"
          :aria-label="t('field.z')"
          class="w-full rounded border border-zinc-300 px-2 py-1"
          @change="onVoxelFieldChange('z', $event)"
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
