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
  circleSchema,
  sectorSchema,
  bowSchema,
  arcSchema,
  ringSchema,
  ellipseSchema,
  labelSchema,
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
