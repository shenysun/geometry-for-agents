import * as z from "zod";

const primitiveId = z.string().min(1);

const point2Schema = z.strictObject({
  x: z.number(),
  y: z.number(),
});

const fillSchema = z.enum(["none", "solid", "hatch"]);

const center2d = {
  id: primitiveId,
  cx: z.number(),
  cy: z.number(),
};

const disk2d = {
  ...center2d,
  r: z.number().positive(),
};

const sweep2d = {
  ...disk2d,
  startDeg: z.number(),
  endDeg: z.number(),
};

const lineSchema = z.strictObject({
  id: primitiveId,
  type: z.literal("line"),
  points: z.array(point2Schema).min(2),
});

const polygonSchema = z.strictObject({
  id: primitiveId,
  type: z.literal("polygon"),
  points: z.array(point2Schema).min(3),
  fill: fillSchema,
});

// 参数化矩形：(x,y) 是矩形中心（与圆/椭圆锚点一致），width 沿 X、height 沿 Y。
const rectangleSchema = z.strictObject({
  id: primitiveId,
  type: z.literal("rectangle"),
  x: z.number(),
  y: z.number(),
  width: z.number().positive(),
  height: z.number().positive(),
  // 沿椭圆先例：缺省 0 即轴对齐（ADR 0015：变换直写几何）。
  rotationDeg: z.number().default(0),
  fill: fillSchema,
});

// 底/高家族（ADR 0017）：锚点是底边中点，底沿局部 X，高沿局部 +Y，
// 旋转绕锚点。apexOffset/topOffset 是上顶相对底边中点的 X 偏移（0 = 等腰）。
const triangleSchema = z.strictObject({
  id: primitiveId,
  type: z.literal("triangle"),
  x: z.number(),
  y: z.number(),
  width: z.number().positive(),
  height: z.number().positive(),
  apexOffset: z.number(),
  rotationDeg: z.number().default(0),
  fill: fillSchema,
});

// 平四斜移为零即矩形：refine 拒绝，一形一表。
const parallelogramSchema = z
  .strictObject({
    id: primitiveId,
    type: z.literal("parallelogram"),
    x: z.number(),
    y: z.number(),
    width: z.number().positive(),
    height: z.number().positive(),
    skew: z.number(),
    rotationDeg: z.number().default(0),
    fill: fillSchema,
  })
  .refine((shape) => shape.skew !== 0, {
    message: "skew must be nonzero (a zero-skew parallelogram is a rectangle)",
    path: ["skew"],
  });

// 梯形锚点是下底中点；上底与下底等长即平四/矩形：refine 拒绝。
const trapezoidSchema = z
  .strictObject({
    id: primitiveId,
    type: z.literal("trapezoid"),
    x: z.number(),
    y: z.number(),
    width: z.number().positive(),
    topWidth: z.number().positive(),
    height: z.number().positive(),
    topOffset: z.number(),
    rotationDeg: z.number().default(0),
    fill: fillSchema,
  })
  .refine((shape) => shape.topWidth !== shape.width, {
    message: "topWidth must differ from width (equal bases are a parallelogram)",
    path: ["topWidth"],
  });

/** 角（笔画族）：无 fill；起止重合/差整周被拒（周角用圆 + 两条线拼）。 */
const angleSchema = z
  .strictObject({
    id: primitiveId,
    type: z.literal("angle"),
    x: z.number(),
    y: z.number(),
    startDeg: z.number(),
    endDeg: z.number(),
    length: z.number().positive(),
  })
  .refine(
    (angle) => {
      if (angle.startDeg === angle.endDeg) return false;
      const sweep = (angle.endDeg - angle.startDeg) % 360;
      return sweep !== 0;
    },
    {
      message:
        "startDeg and endDeg must span a nonzero, non-full sweep (0° at +X, counterclockwise)",
      path: ["endDeg"],
    },
  );

// 正多边形（ADR 0017）：中心即外接圆心；sides ≥ 5（等边三角形与正方形
// 各有唯一规范表达）；缺省朝向平底——一条边平行局部 X 且在下方。
const regularPolygonSchema = z.strictObject({
  id: primitiveId,
  type: z.literal("regularPolygon"),
  x: z.number(),
  y: z.number(),
  sides: z.number().int().min(5),
  r: z.number().positive(),
  rotationDeg: z.number().default(0),
  fill: fillSchema,
});

// 尺寸标注线（笔画族）：定长二元组，两点不重合；显示数字是两点距离的
// 推导值，不进契约（无 text 字段、无单位）。
const dimensionSchema = z
  .strictObject({
    id: primitiveId,
    type: z.literal("dimension"),
    points: z.tuple([point2Schema, point2Schema]),
  })
  .refine(
    (dimension) => {
      const [a, b] = dimension.points;
      return a.x !== b.x || a.y !== b.y;
    },
    {
      message: "the two points must not coincide (zero length)",
      path: ["points"],
    },
  );

const circleSchema = z.strictObject({
  ...disk2d,
  type: z.literal("circle"),
  fill: fillSchema,
});

const sectorSchema = z.strictObject({
  ...sweep2d,
  type: z.literal("sector"),
  fill: fillSchema,
});

const bowSchema = z.strictObject({
  ...sweep2d,
  type: z.literal("bow"),
  fill: fillSchema,
});

const arcSchema = z.strictObject({
  ...sweep2d,
  type: z.literal("arc"),
});

const ringSchema = z
  .strictObject({
    ...center2d,
    type: z.literal("ring"),
    rInner: z.number().positive(),
    rOuter: z.number().positive(),
    fill: fillSchema,
  })
  .refine((ring) => ring.rInner < ring.rOuter, {
    message: "rInner must be less than rOuter",
    path: ["rInner"],
  });

const ellipseSchema = z.strictObject({
  ...center2d,
  type: z.literal("ellipse"),
  rx: z.number().positive(),
  ry: z.number().positive(),
  // 旧说明书没有旋转角：缺省 0 即轴对齐。
  rotationDeg: z.number().default(0),
  fill: fillSchema,
});

const labelSchema = z.strictObject({
  id: primitiveId,
  type: z.literal("label"),
  x: z.number(),
  y: z.number(),
  text: z.string().min(1),
});

// 重叠填充（ADR 0019 引用式）：两源 id + 一份填充样式，不存几何——交集是
// 渲染期的推导值。相交性不进 schema：创建后源被拖开，条目合法保留（渲染为空）。
// 源必须存在且属可填充封闭族，由 documentSchema 的 superRefine 跨条目校验。
const overlapFillSchema = z
  .strictObject({
    id: primitiveId,
    type: z.literal("overlapFill"),
    sources: z.tuple([primitiveId, primitiveId]),
    fill: fillSchema,
  })
  .refine((entry) => entry.sources[0] !== entry.sources[1], {
    message: "the two sources must be distinct primitives",
    path: ["sources"],
  });

const voxelSchema = z.strictObject({
  id: primitiveId,
  type: z.literal("voxel"),
  x: z.int(),
  y: z.int(),
  z: z.int(),
});

// 站立参数体的三个欧拉角（度），合成顺序 Y→X→Z；0 = 底面朝下。
const solidRotation = {
  rotationDegY: z.number(),
  rotationDegX: z.number(),
  rotationDegZ: z.number(),
};

const boxSchema = z.strictObject({
  id: primitiveId,
  type: z.literal("box"),
  // (x,y,z) 是底面中心：y 为底面高度，height 沿 +Y。
  x: z.number(),
  y: z.number(),
  z: z.number(),
  width: z.number().positive(),
  depth: z.number().positive(),
  height: z.number().positive(),
  ...solidRotation,
});

// 圆柱与圆锥同构：底面圆心即底面中心，r 是半径，height 沿 +Y。
const cylinderSchema = z.strictObject({
  id: primitiveId,
  type: z.literal("cylinder"),
  x: z.number(),
  y: z.number(),
  z: z.number(),
  r: z.number().positive(),
  height: z.number().positive(),
  ...solidRotation,
});

const coneSchema = z.strictObject({
  id: primitiveId,
  type: z.literal("cone"),
  x: z.number(),
  y: z.number(),
  z: z.number(),
  r: z.number().positive(),
  height: z.number().positive(),
  ...solidRotation,
});

// 球无旋转字段：strictObject 拒绝多余的 rotationDeg*。
const sphereSchema = z.strictObject({
  id: primitiveId,
  type: z.literal("sphere"),
  // (x,y,z) 是球心。
  x: z.number(),
  y: z.number(),
  z: z.number(),
  r: z.number().positive(),
});

// 四棱锥：底面是 width×depth 的矩形（默认正方形），顶点在底面中心上方 height。
const pyramidSchema = z.strictObject({
  id: primitiveId,
  type: z.literal("pyramid"),
  x: z.number(),
  y: z.number(),
  z: z.number(),
  width: z.number().positive(),
  depth: z.number().positive(),
  height: z.number().positive(),
  ...solidRotation,
});

// 三棱柱底面三点在局部 XZ（默认边长 1 的正三角形、形心在局部原点）。
const prismBasePointSchema = z.strictObject({
  x: z.number(),
  z: z.number(),
});

const triangularPrismSchema = z.strictObject({
  id: primitiveId,
  type: z.literal("triangularPrism"),
  x: z.number(),
  y: z.number(),
  z: z.number(),
  height: z.number().positive(),
  base: z.tuple([
    prismBasePointSchema,
    prismBasePointSchema,
    prismBasePointSchema,
  ]),
  ...solidRotation,
});

const twoDPrimitiveSchema = z.discriminatedUnion("type", [
  lineSchema,
  polygonSchema,
  rectangleSchema,
  triangleSchema,
  parallelogramSchema,
  trapezoidSchema,
  regularPolygonSchema,
  angleSchema,
  dimensionSchema,
  circleSchema,
  sectorSchema,
  bowSchema,
  arcSchema,
  ringSchema,
  ellipseSchema,
  labelSchema,
  overlapFillSchema,
]);

const threeDPrimitiveSchema = z.discriminatedUnion("type", [
  voxelSchema,
  boxSchema,
  cylinderSchema,
  coneSchema,
  sphereSchema,
  pyramidSchema,
  triangularPrismSchema,
]);

const underlaySchema = z
  .strictObject({
    url: z.httpUrl().optional(),
    opacity: z.number().min(0).max(1),
    x: z.number(),
    y: z.number(),
    scale: z.number().positive(),
  })
  .nullable();

const documentFields = {
  version: z.literal(1),
  underlay: underlaySchema,
};

const document2dSchema = z.strictObject({
  ...documentFields,
  space: z.literal("2d"),
  primitives: z.array(twoDPrimitiveSchema),
});

const document3dSchema = z.strictObject({
  ...documentFields,
  space: z.literal("3d"),
  primitives: z.array(threeDPrimitiveSchema),
});

export const documentSchema = z
  .discriminatedUnion("space", [document2dSchema, document3dSchema])
  .superRefine((document, ctx) => {
    const seen = new Set<string>();
    for (const [index, primitive] of document.primitives.entries()) {
      if (seen.has(primitive.id)) {
        ctx.addIssue({
          code: "custom",
          message: `duplicate primitive id "${primitive.id}"`,
          path: ["primitives", index, "id"],
        });
      }
      seen.add(primitive.id);
    }
    // overlapFill 的源是跨条目引用：必须指向已存在的可填充封闭图元。
    // 悬空即拒——删源必须级联删条目（removePrimitive 依赖此约束兜底）。
    const byId = new Map(
      document.primitives.map((primitive) => [primitive.id, primitive] as const),
    );
    for (const [index, primitive] of document.primitives.entries()) {
      if (primitive.type !== "overlapFill") continue;
      for (const [slot, sourceId] of primitive.sources.entries()) {
        const source = byId.get(sourceId);
        if (source === undefined) {
          ctx.addIssue({
            code: "custom",
            message: `overlapFill "${primitive.id}" references missing primitive "${sourceId}"`,
            path: ["primitives", index, "sources", slot],
          });
          continue;
        }
        if (!fillable2dTypes.has(source.type)) {
          ctx.addIssue({
            code: "custom",
            message: `overlapFill "${primitive.id}" source "${sourceId}" (${source.type}) is not a fillable closed primitive`,
            path: ["primitives", index, "sources", slot],
          });
        }
      }
    }
  })
  .describe(
    "2D coordinates are (x,y) with Y-up. 3D coordinates are (x,y,z) with Y as height and XZ as the ground. Angles are degrees, 0° at +X, counterclockwise positive. A voxel's integer (x,y,z) is the minimum corner of the unit cube occupying [x,x+1]×[y,y+1]×[z,z+1]. Standing solids (box, cylinder, cone, pyramid, triangularPrism) are anchored at the bottom-face center: y is the base height, height grows along +Y; rotationDegY/X/Z are euler degrees composed in Y→X→Z order, 0 = base facing down. A sphere's (x,y,z) is its center. A triangularPrism's base is three {x,z} points in the bottom face's local XZ plane (the default base is an equilateral triangle of side 1 with its centroid at the local origin).",
  );

export type GeometryDocument = z.infer<typeof documentSchema>;

/** 2D 说明书里的图元（折线、多边形、矩形、圆族、椭圆、标签），由 schema 推导，不手报名单。 */
export type Primitive2d = z.infer<typeof twoDPrimitiveSchema>;

/** 3D 说明书里的图元（体素、长方体等立体），由 schema 推导，不手报名单。 */
export type Primitive3d = z.infer<typeof threeDPrimitiveSchema>;

export type Primitive = Primitive2d | Primitive3d;

/** 各空间允许的图元类型名单：从判别联合的 type 字面量推导，新增类型不手抄。 */
function typeNamesOf(
  union: typeof twoDPrimitiveSchema | typeof threeDPrimitiveSchema,
): Set<string> {
  return new Set<string>(
    union.options.map((option) => option.shape.type.value),
  );
}

const twoDTypes = typeNamesOf(twoDPrimitiveSchema);

/** 可填充封闭族 = 带 fill 字段的 2D 几何图元（overlapFill 除外——它是引用条目不是几何面）。
 *  从判别联合推导，不手报名单；hit.ts 的封闭判定与此同源，改 schema 即同步。 */
export const fillable2dTypes: ReadonlySet<string> = new Set(
  twoDPrimitiveSchema.options
    .filter(
      (option) =>
        (option.shape as Record<string, unknown>).fill !== undefined &&
        option.shape.type.value !== "overlapFill",
    )
    .map((option) => option.shape.type.value),
);

const threeDTypes = typeNamesOf(threeDPrimitiveSchema);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function spaceMismatchError(input: unknown): string | undefined {
  if (!isRecord(input)) return undefined;
  const { space, primitives } = input;
  if ((space !== "2d" && space !== "3d") || !Array.isArray(primitives)) {
    return undefined;
  }
  const allowed = space === "2d" ? twoDTypes : threeDTypes;
  for (const [index, primitive] of primitives.entries()) {
    if (!isRecord(primitive) || typeof primitive.type !== "string") continue;
    if (!allowed.has(primitive.type)) {
      const id =
        typeof primitive.id === "string" ? primitive.id : String(index);
      return `primitives.${index} (${id}): type "${primitive.type}" is not allowed in space "${space}"`;
    }
  }
  return undefined;
}

export function parseDocument(
  input: unknown,
):
  | { success: true; document: GeometryDocument }
  | { success: false; error: string } {
  let value = input;
  if (typeof input === "string") {
    try {
      value = JSON.parse(input) as unknown;
    } catch (error) {
      const detail =
        error instanceof Error ? error.message : "JSON.parse failed";
      return { success: false, error: `invalid JSON: ${detail}` };
    }
  }

  const result = documentSchema.safeParse(value);
  if (result.success) {
    return { success: true, document: result.data };
  }
  const mismatch = spaceMismatchError(value);
  return {
    success: false,
    error: mismatch ?? z.prettifyError(result.error),
  };
}
