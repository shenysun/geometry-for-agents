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

const twoDPrimitiveSchema = z.discriminatedUnion("type", [
  lineSchema,
  polygonSchema,
  circleSchema,
  sectorSchema,
  bowSchema,
  arcSchema,
  ringSchema,
  ellipseSchema,
  labelSchema,
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
  primitives: z.array(voxelSchema),
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
    "2D coordinates are (x,y) with Y-up. 3D coordinates are (x,y,z) with Y as height and XZ as the ground. Angles are degrees, 0° at +X, counterclockwise positive. A voxel's integer (x,y,z) is the minimum corner of the unit cube occupying [x,x+1]×[y,y+1]×[z,z+1].",
  );

export type GeometryDocument = z.infer<typeof documentSchema>;
export type Primitive = GeometryDocument["primitives"][number];

const twoDTypes = new Set([
  "line",
  "polygon",
  "circle",
  "sector",
  "bow",
  "arc",
  "ring",
  "ellipse",
  "label",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function spaceMismatchError(input: unknown): string | undefined {
  if (!isRecord(input)) return undefined;
  const { space, primitives } = input;
  if ((space !== "2d" && space !== "3d") || !Array.isArray(primitives)) {
    return undefined;
  }
  const allowed = space === "2d" ? twoDTypes : new Set(["voxel"]);
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
