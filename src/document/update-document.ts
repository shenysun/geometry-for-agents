import { parseDocument } from "./parse-document.ts";
import type {
  GeometryDocument,
  Primitive,
  Primitive2d,
  Primitive3d,
} from "./parse-document.ts";
import {
  baseHeightLocalOffset,
  baseHeightLocalVertices,
} from "./base-height-family.ts";
import type { AnglePrimitive } from "./angle.ts";
import {
  snap2d,
  snap3d,
  type GridSnap,
  type Point2,
  type Point3,
} from "./snap.ts";

export type DocumentUpdateResult =
  | { success: true; document: GeometryDocument }
  | { success: false; error: string };

function replaceDocument(
  document: GeometryDocument,
  patch: {
    underlay: GeometryDocument["underlay"];
    primitives: Primitive[];
  },
): DocumentUpdateResult {
  return parseDocument(
    structuredClone({
      version: document.version,
      space: document.space,
      underlay: patch.underlay,
      primitives: patch.primitives,
    }),
  );
}

function replacePrimitives(
  document: GeometryDocument,
  primitives: Primitive[],
): DocumentUpdateResult {
  return replaceDocument(document, {
    underlay: document.underlay,
    primitives,
  });
}

export function setUnderlay(
  document: GeometryDocument,
  underlay: GeometryDocument["underlay"],
): DocumentUpdateResult {
  return replaceDocument(document, {
    underlay,
    primitives: document.primitives,
  });
}

function missingId(id: string): DocumentUpdateResult {
  return { success: false, error: `primitive id "${id}" not found` };
}

export function addPrimitive(
  document: GeometryDocument,
  primitive: Primitive,
): DocumentUpdateResult {
  return replacePrimitives(document, [...document.primitives, primitive]);
}

export function removePrimitive(
  document: GeometryDocument,
  id: string,
): DocumentUpdateResult {
  if (!document.primitives.some((primitive) => primitive.id === id)) {
    return missingId(id);
  }
  return replacePrimitives(
    document,
    document.primitives.filter((primitive) => primitive.id !== id),
  );
}

export function updatePrimitive(
  document: GeometryDocument,
  id: string,
  primitive: Primitive,
): DocumentUpdateResult {
  if (!document.primitives.some((current) => current.id === id)) {
    return missingId(id);
  }
  return replacePrimitives(
    document,
    document.primitives.map((current) =>
      current.id === id ? { ...primitive, id } : current,
    ),
  );
}

/** 把已吸附的位移写进图元的几何字段（points / cx cy / x y），不可变。 */
export function translatePrimitiveGeometry(
  primitive: Primitive2d,
  dx: number,
  dy: number,
): Primitive2d {
  switch (primitive.type) {
    case "line":
    case "polygon":
      return {
        ...primitive,
        points: primitive.points.map((point) => ({
          x: point.x + dx,
          y: point.y + dy,
        })),
      };
    case "label":
    case "rectangle":
    case "triangle":
    case "parallelogram":
    case "trapezoid":
    case "angle":
      return { ...primitive, x: primitive.x + dx, y: primitive.y + dy };
    case "circle":
    case "sector":
    case "bow":
    case "arc":
    case "ring":
    case "ellipse":
      return { ...primitive, cx: primitive.cx + dx, cy: primitive.cy + dy };
  }
}

/** 平移一条 2D 图元：先把世界位移吸附到格，再写入几何字段，返回新说明书。 */
export function translatePrimitive(
  document: GeometryDocument,
  id: string,
  dx: number,
  dy: number,
  grid: GridSnap,
): DocumentUpdateResult {
  if (document.space !== "2d") {
    return {
      success: false,
      error: "translate is only defined for 2D primitives",
    };
  }
  const current = document.primitives.find((primitive) => primitive.id === id);
  if (current === undefined) {
    return missingId(id);
  }
  const delta = snap2d({ x: dx, y: dy }, grid);
  if (delta.x === 0 && delta.y === 0) {
    return { success: true, document };
  }
  return replacePrimitives(
    document,
    document.primitives.map((primitive) =>
      primitive.id === id
        ? translatePrimitiveGeometry(primitive, delta.x, delta.y)
        : primitive,
    ),
  );
}

/** 顶点质心：折线/多边形的旋转缩放锚点。 */
function centroid(points: readonly Point2[]): Point2 {
  const sum = points.reduce(
    (total, point) => ({ x: total.x + point.x, y: total.y + point.y }),
    { x: 0, y: 0 },
  );
  return { x: sum.x / points.length, y: sum.y / points.length };
}

/** 图元自身锚点：折线/多边形取顶点质心，圆族取圆心，矩形/标签/底高家族取其位置。 */
export function primitiveAnchor(primitive: Primitive2d): Point2 {
  switch (primitive.type) {
    case "line":
    case "polygon":
      return centroid(primitive.points);
    case "rectangle":
    case "label":
    case "triangle":
    case "parallelogram":
    case "trapezoid":
    case "angle":
      return { x: primitive.x, y: primitive.y };
    default:
      return { x: primitive.cx, y: primitive.cy };
  }
}

const DEG = Math.PI / 180;

/** 把任意度数折进 [0,360)，避免反复旋转把角度滚出可读区间。 */
function normalizeDeg(deg: number): number {
  const wrapped = deg % 360;
  return wrapped < 0 ? wrapped + 360 : wrapped;
}

/** 点绕锚点旋转 deg 度（逆时针为正，Y 向上）。 */
function rotatePoint(
  point: { x: number; y: number },
  center: { x: number; y: number },
  deg: number,
): { x: number; y: number } {
  const rad = deg * DEG;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const dx = point.x - center.x;
  const dy = point.y - center.y;
  return {
    x: center.x + dx * cos - dy * sin,
    y: center.y + dx * sin + dy * cos,
  };
}

/** 点朝锚点按 factor 缩放。 */
function scalePoint(
  point: { x: number; y: number },
  center: { x: number; y: number },
  factor: number,
): { x: number; y: number } {
  return {
    x: center.x + (point.x - center.x) * factor,
    y: center.y + (point.y - center.y) * factor,
  };
}

/**
 * 绕图元自身锚点旋转，直接写几何字段：折线/多边形转顶点，椭圆转
 * rotationDeg，扇/弓/弧转 startDeg/endDeg；圆、环、标签旋转对称，恒等。
 */
export function rotatePrimitiveGeometry(
  primitive: Primitive2d,
  deg: number,
): Primitive2d {
  switch (primitive.type) {
    case "line":
    case "polygon": {
      const center = primitiveAnchor(primitive);
      return {
        ...primitive,
        points: primitive.points.map((point) =>
          rotatePoint(point, center, deg),
        ),
      };
    }
    case "ellipse":
    case "rectangle":
    case "triangle":
    case "parallelogram":
    case "trapezoid":
      return {
        ...primitive,
        rotationDeg: normalizeDeg(primitive.rotationDeg + deg),
      };
    case "sector":
    case "bow":
    case "arc":
    case "angle":
      return {
        ...primitive,
        startDeg: normalizeDeg(primitive.startDeg + deg),
        endDeg: normalizeDeg(primitive.endDeg + deg),
      };
    case "circle":
    case "ring":
    case "label":
      return primitive;
  }
}

/**
 * 以图元自身锚点为不动点等比缩放：半径类字段乘因子，顶点朝锚点收放。
 * 圆只有一个半径字段，天然保持圆形。
 */
export function scalePrimitiveGeometry(
  primitive: Primitive2d,
  factor: number,
): Primitive2d {
  switch (primitive.type) {
    case "line":
    case "polygon": {
      const center = primitiveAnchor(primitive);
      return {
        ...primitive,
        points: primitive.points.map((point) =>
          scalePoint(point, center, factor),
        ),
      };
    }
    case "circle":
    case "sector":
    case "bow":
    case "arc":
      return { ...primitive, r: primitive.r * factor };
    case "ring":
      return {
        ...primitive,
        rInner: primitive.rInner * factor,
        rOuter: primitive.rOuter * factor,
      };
    case "ellipse":
      return {
        ...primitive,
        rx: primitive.rx * factor,
        ry: primitive.ry * factor,
      };
    case "rectangle":
      return {
        ...primitive,
        width: primitive.width * factor,
        height: primitive.height * factor,
      };
    case "triangle":
      return {
        ...primitive,
        width: primitive.width * factor,
        height: primitive.height * factor,
        apexOffset: primitive.apexOffset * factor,
      };
    case "parallelogram":
      return {
        ...primitive,
        width: primitive.width * factor,
        height: primitive.height * factor,
        skew: primitive.skew * factor,
      };
    case "trapezoid":
      return {
        ...primitive,
        width: primitive.width * factor,
        topWidth: primitive.topWidth * factor,
        height: primitive.height * factor,
        topOffset: primitive.topOffset * factor,
      };
    case "angle":
      return { ...primitive, length: primitive.length * factor };
    case "label":
      return primitive;
  }
}

/** 图元几何是否一致（恒等变换检测，避免写入无变化快照）。 */
function samePrimitive(left: Primitive, right: Primitive): boolean {
  return left === right || JSON.stringify(left) === JSON.stringify(right);
}

function transformPrimitive(
  document: GeometryDocument,
  id: string,
  verb: string,
  apply: (primitive: Primitive2d) => Primitive2d,
): DocumentUpdateResult {
  if (document.space !== "2d") {
    return {
      success: false,
      error: `${verb} is only defined for 2D primitives`,
    };
  }
  const current = document.primitives.find((primitive) => primitive.id === id);
  if (current === undefined) {
    return missingId(id);
  }
  const transformed = apply(current);
  if (samePrimitive(current, transformed)) {
    return { success: true, document };
  }
  return replacePrimitives(
    document,
    document.primitives.map((primitive) =>
      primitive.id === id ? transformed : primitive,
    ),
  );
}

/** 旋转一条 2D 图元：角度直接写进几何字段，不引入矩阵。 */
export function rotatePrimitive(
  document: GeometryDocument,
  id: string,
  deg: number,
): DocumentUpdateResult {
  return transformPrimitive(document, id, "rotate", (primitive) =>
    rotatePrimitiveGeometry(primitive, deg),
  );
}

/** 缩放一条 2D 图元：正因子等比缩放，圆保持圆形。 */
export function scalePrimitive(
  document: GeometryDocument,
  id: string,
  factor: number,
): DocumentUpdateResult {
  if (factor <= 0) {
    return { success: false, error: "scale factor must be positive" };
  }
  return transformPrimitive(document, id, "scale", (primitive) =>
    scalePrimitiveGeometry(primitive, factor),
  );
}

/** 指针相对圆心的方位角（度，逆时针为正）。 */
function pointDegFrom(center: Point2, world: Point2): number {
  return (Math.atan2(world.y - center.y, world.x - center.x) * 180) / Math.PI;
}

function distanceBetween(a: Point2, b: Point2): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/** 世界点转进椭圆局部系（逆旋转 rotationDeg）后的轴上偏移。 */
function ellipseLocalOffset(
  primitive: Extract<Primitive2d, { type: "ellipse" }>,
  world: Point2,
): Point2 {
  const center = { x: primitive.cx, y: primitive.cy };
  const local = rotatePoint(world, center, -primitive.rotationDeg);
  return { x: local.x - center.x, y: local.y - center.y };
}

/** 世界点转进矩形局部系（逆旋转 rotationDeg）后的中心偏移。 */
function rectangleLocalOffset(
  primitive: Extract<Primitive2d, { type: "rectangle" }>,
  world: Point2,
): Point2 {
  const center = { x: primitive.x, y: primitive.y };
  const local = rotatePoint(world, center, -primitive.rotationDeg);
  return { x: local.x - center.x, y: local.y - center.y };
}

/** 矩形四角控制点 id：corner-0..3，与控制点目录同源。 */
const CORNER_ID = /^corner-([0-3])$/;

const VERTEX_ID = /^vertex-(\d+)$/;

/**
 * 拖控制点只改那一处几何（已吸附的世界坐标），不可变：端点/顶点只动
 * 那个下标，半径点只改半径，起止角点只改角度，半轴点沿局部轴度量。
 * pointId 与控制点目录同源（即字段名），未知 id 是恒等。
 */
export function moveControlPointGeometry(
  primitive: Primitive2d,
  pointId: string,
  world: Point2,
): Primitive2d {
  switch (primitive.type) {
    case "line":
    case "polygon": {
      const match = VERTEX_ID.exec(pointId);
      if (match === null) return primitive;
      const index = Number(match[1]);
      if (index >= primitive.points.length) return primitive;
      return {
        ...primitive,
        points: primitive.points.map((point, at) =>
          at === index ? world : point,
        ),
      };
    }
    case "angle": {
      // 顶点只写位置；边端点改该方向角与公共边长（两边等长）。
      const vertex = { x: primitive.x, y: primitive.y };
      if (pointId === "apex") {
        return { ...primitive, x: world.x, y: world.y };
      }
      const deg = normalizeDeg(pointDegFrom(vertex, world));
      const length = distanceBetween(vertex, world);
      if (pointId === "startDeg") {
        return { ...primitive, startDeg: deg, length };
      }
      if (pointId === "endDeg") {
        return { ...primitive, endDeg: deg, length };
      }
      return primitive;
    }
    case "label":
      return primitive;
    case "circle": {
      if (pointId === "center") {
        return { ...primitive, cx: world.x, cy: world.y };
      }
      if (pointId === "radius") {
        return {
          ...primitive,
          r: distanceBetween({ x: primitive.cx, y: primitive.cy }, world),
        };
      }
      return primitive;
    }
    case "sector":
    case "bow":
    case "arc": {
      const center = { x: primitive.cx, y: primitive.cy };
      if (pointId === "center") {
        return { ...primitive, cx: world.x, cy: world.y };
      }
      if (pointId === "radius") {
        return { ...primitive, r: distanceBetween(center, world) };
      }
      const deg = normalizeDeg(pointDegFrom(center, world));
      if (pointId === "startDeg") return { ...primitive, startDeg: deg };
      if (pointId === "endDeg") return { ...primitive, endDeg: deg };
      return primitive;
    }
    case "ring": {
      const center = { x: primitive.cx, y: primitive.cy };
      if (pointId === "center") {
        return { ...primitive, cx: world.x, cy: world.y };
      }
      const radius = distanceBetween(center, world);
      if (pointId === "rInner") return { ...primitive, rInner: radius };
      if (pointId === "rOuter") return { ...primitive, rOuter: radius };
      return primitive;
    }
    case "ellipse": {
      if (pointId === "center") {
        return { ...primitive, cx: world.x, cy: world.y };
      }
      if (pointId === "rx") {
        return {
          ...primitive,
          rx: Math.abs(ellipseLocalOffset(primitive, world).x),
        };
      }
      if (pointId === "ry") {
        return {
          ...primitive,
          ry: Math.abs(ellipseLocalOffset(primitive, world).y),
        };
      }
      return primitive;
    }
    case "rectangle": {
      // 拖任一角都以中心为不动点改宽高：局部偏移翻倍即尺寸，两轴独立。
      if (CORNER_ID.test(pointId)) {
        const offset = rectangleLocalOffset(primitive, world);
        return {
          ...primitive,
          width: Math.abs(offset.x) * 2,
          height: Math.abs(offset.y) * 2,
        };
      }
      return primitive;
    }
    case "triangle":
    case "parallelogram":
    case "trapezoid": {
      // 底/高家族：底角以底边中点为不动点对称改底宽；顶点/上角写各自的
      // 上部字段与高（平四 skew 由上角减半底推出，梯形上底对称伸缩）。
      const match = CORNER_ID.exec(pointId);
      if (match === null) return primitive;
      const index = Number(match[1]);
      if (index >= baseHeightLocalVertices(primitive).length) return primitive;
      const local = baseHeightLocalOffset(primitive, world);
      if (index <= 1) {
        return { ...primitive, width: Math.abs(local.x) * 2 };
      }
      switch (primitive.type) {
        case "triangle":
          return { ...primitive, apexOffset: local.x, height: local.y };
        case "parallelogram":
          return {
            ...primitive,
            skew:
              index === 2
                ? local.x - primitive.width / 2
                : local.x + primitive.width / 2,
            height: local.y,
          };
        case "trapezoid":
          return {
            ...primitive,
            topWidth: Math.abs(local.x - primitive.topOffset) * 2,
            height: local.y,
          };
      }
    }
  }
}

/** 拖控制点提交：目标点先吸附到格，再只写那一处几何，非法几何被契约拒绝。 */
export function moveControlPoint(
  document: GeometryDocument,
  id: string,
  pointId: string,
  world: Point2,
  grid: GridSnap,
): DocumentUpdateResult {
  return transformPrimitive(document, id, "moveControlPoint", (primitive) =>
    moveControlPointGeometry(primitive, pointId, snap2d(world, grid)),
  );
}

// ---- 3D 参数体变换（票 11）：变换直接写几何字段，不引入矩阵层 ----

/** 参数体图元（长方体、圆柱、圆锥、球、四棱锥、三棱柱）：体素不在其列。 */
export type SolidPrimitive = Exclude<Primitive3d, { type: "voxel" }>;

/** 旋转柄对应的欧拉轴。 */
export type SolidAxis = "x" | "y" | "z";

function rotX(deg: number, v: Point3): Point3 {
  const rad = deg * DEG;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  return { x: v.x, y: v.y * cos - v.z * sin, z: v.y * sin + v.z * cos };
}

function rotY(deg: number, v: Point3): Point3 {
  const rad = deg * DEG;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  return { x: v.x * cos + v.z * sin, y: v.y, z: -v.x * sin + v.z * cos };
}

function rotZ(deg: number, v: Point3): Point3 {
  const rad = deg * DEG;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  return { x: v.x * cos - v.y * sin, y: v.x * sin + v.y * cos, z: v.z };
}

/**
 * 参数体的欧拉旋转（合成顺序 Y→X→Z，矩阵 Ry·Rx·Rz，与渲染端 three 的
 * 内旋 'YXZ' 同一约定）：对局部向量先作用 Z、再 X、最后 Y，得到世界向量。
 */
export function rotateEulerYxz(
  degY: number,
  degX: number,
  degZ: number,
  v: Point3,
): Point3 {
  return rotY(degY, rotX(degX, rotZ(degZ, v)));
}

/** rotateEulerYxz 的逆：把世界向量还原到参数体局部系。 */
export function unrotateEulerYxz(
  degY: number,
  degX: number,
  degZ: number,
  v: Point3,
): Point3 {
  return rotZ(-degZ, rotX(-degX, rotY(-degY, v)));
}

/** 参数体锚点：站立体是底面中心，球是球心（契约里的 (x,y,z) 本体）。 */
export function solidAnchor(solid: SolidPrimitive): Point3 {
  return { x: solid.x, y: solid.y, z: solid.z };
}

/**
 * 平移参数体几何：只写锚点，尺寸、欧拉角与三棱柱局部底面都不动，
 * 不可变。吸附由调用侧（translateSolid）决定。
 */
export function translateSolidGeometry(
  solid: SolidPrimitive,
  dx: number,
  dy: number,
  dz: number,
): SolidPrimitive {
  return { ...solid, x: solid.x + dx, y: solid.y + dy, z: solid.z + dz };
}

/**
 * 绕自身欧拉轴增量旋转：只写对应的 rotationDeg*（度）并归一到 [0,360)，
 * 锚点不动——0 姿态即底面朝下站立。球没有旋转字段，恒等。
 */
export function rotateSolidGeometry(
  solid: SolidPrimitive,
  axis: SolidAxis,
  deg: number,
): SolidPrimitive {
  if (solid.type === "sphere") {
    return solid;
  }
  switch (axis) {
    case "y":
      return {
        ...solid,
        rotationDegY: normalizeDeg(solid.rotationDegY + deg),
      };
    case "x":
      return {
        ...solid,
        rotationDegX: normalizeDeg(solid.rotationDegX + deg),
      };
    case "z":
      return {
        ...solid,
        rotationDegZ: normalizeDeg(solid.rotationDegZ + deg),
      };
  }
}

/**
 * 以锚点为不动点等比缩放：尺寸字段乘因子（cylinder/cone 的 r 与 height
 * 独立可拉，等比时同乘），三棱柱的底面点随局部坐标一起收放。
 */
export function scaleSolidGeometry(
  solid: SolidPrimitive,
  factor: number,
): SolidPrimitive {
  switch (solid.type) {
    case "box":
    case "pyramid":
      return {
        ...solid,
        width: solid.width * factor,
        depth: solid.depth * factor,
        height: solid.height * factor,
      };
    case "cylinder":
    case "cone":
      return {
        ...solid,
        r: solid.r * factor,
        height: solid.height * factor,
      };
    case "sphere":
      return { ...solid, r: solid.r * factor };
    case "triangularPrism":
      return {
        ...solid,
        height: solid.height * factor,
        // 底面是定长三元组：逐点显式重建，保持元组类型
        base: [
          { x: solid.base[0].x * factor, z: solid.base[0].z * factor },
          { x: solid.base[1].x * factor, z: solid.base[1].z * factor },
          { x: solid.base[2].x * factor, z: solid.base[2].z * factor },
        ],
      };
  }
}

/** 世界点减锚点后逆旋转回局部系的偏移：控制点度量的统一入口。 */
function solidLocalOffset(solid: SolidPrimitive, world: Point3): Point3 {
  const anchor = solidAnchor(solid);
  const offset = {
    x: world.x - anchor.x,
    y: world.y - anchor.y,
    z: world.z - anchor.z,
  };
  if (solid.type === "sphere") {
    return offset;
  }
  return unrotateEulerYxz(
    solid.rotationDegY,
    solid.rotationDegX,
    solid.rotationDegZ,
    offset,
  );
}

/**
 * 拖控制点只改那一处尺寸（world 已吸附）：宽深按局部轴投影取绝对值、
 * 圆族半径取底面径向距离、球半径取到球心距离、高取局部 Y；三棱柱的
 * 底面点把世界点直接写回局部 XZ。pointId 与控制点目录同源，未知 id 恒等。
 */
export function moveSolidControlPointGeometry(
  solid: SolidPrimitive,
  pointId: string,
  world: Point3,
): SolidPrimitive {
  const offset = solidLocalOffset(solid, world);
  switch (solid.type) {
    case "box":
    case "pyramid":
      if (pointId === "width") {
        return { ...solid, width: Math.abs(offset.x) * 2 };
      }
      if (pointId === "depth") {
        return { ...solid, depth: Math.abs(offset.z) * 2 };
      }
      if (pointId === "height") {
        return { ...solid, height: Math.abs(offset.y) };
      }
      return solid;
    case "cylinder":
    case "cone":
      if (pointId === "r") {
        return { ...solid, r: Math.hypot(offset.x, offset.z) };
      }
      if (pointId === "height") {
        return { ...solid, height: Math.abs(offset.y) };
      }
      return solid;
    case "sphere":
      if (pointId === "r") {
        return {
          ...solid,
          r: Math.hypot(offset.x, offset.y, offset.z),
        };
      }
      return solid;
    case "triangularPrism": {
      if (pointId === "height") {
        return { ...solid, height: Math.abs(offset.y) };
      }
      const match = /^base-(\d)$/.exec(pointId);
      if (match === null) return solid;
      const index = Number(match[1]);
      if (index >= solid.base.length) return solid;
      return {
        ...solid,
        base: solid.base.map((point, at) =>
          at === index ? { x: offset.x, z: offset.z } : point,
        ) as typeof solid.base,
      };
    }
  }
}

function transformSolidPrimitive(
  document: GeometryDocument,
  id: string,
  verb: string,
  apply: (solid: SolidPrimitive) => SolidPrimitive,
): DocumentUpdateResult {
  if (document.space !== "3d") {
    return {
      success: false,
      error: `${verb} is only defined for 3D solids`,
    };
  }
  const current = document.primitives.find((primitive) => primitive.id === id);
  if (current === undefined) {
    return missingId(id);
  }
  if (current.type === "voxel") {
    return {
      success: false,
      error: `${verb} is only defined for 3D solids`,
    };
  }
  const transformed = apply(current);
  if (samePrimitive(current, transformed)) {
    return { success: true, document };
  }
  return replacePrimitives(
    document,
    document.primitives.map((primitive) =>
      primitive.id === id ? transformed : primitive,
    ),
  );
}

/**
 * 平移一条参数体：世界位移先吸附当前格（体素不走这里，体素另走整格
 * 平移），再写入锚点。吸附后零位移返回原说明书。
 */
export function translateSolid(
  document: GeometryDocument,
  id: string,
  dx: number,
  dy: number,
  dz: number,
  grid: GridSnap,
): DocumentUpdateResult {
  return transformSolidPrimitive(document, id, "translateSolid", (solid) => {
    const delta = snap3d({ x: dx, y: dy, z: dz }, grid);
    return translateSolidGeometry(solid, delta.x, delta.y, delta.z);
  });
}

/** 旋转一条参数体：增量角度直接加进对应欧拉字段（球恒等，零增量不动）。 */
export function rotateSolid(
  document: GeometryDocument,
  id: string,
  axis: SolidAxis,
  deg: number,
): DocumentUpdateResult {
  return transformSolidPrimitive(document, id, "rotateSolid", (solid) =>
    rotateSolidGeometry(solid, axis, deg),
  );
}

/** 缩放一条参数体：正因子等比改尺寸字段，锚点不动。 */
export function scaleSolid(
  document: GeometryDocument,
  id: string,
  factor: number,
): DocumentUpdateResult {
  if (factor <= 0) {
    return { success: false, error: "scale factor must be positive" };
  }
  return transformSolidPrimitive(document, id, "scaleSolid", (solid) =>
    scaleSolidGeometry(solid, factor),
  );
}

/** 拖参数体控制点提交：目标点先吸附当前格，再只写那一处尺寸。 */
export function moveSolidControlPoint(
  document: GeometryDocument,
  id: string,
  pointId: string,
  world: Point3,
  grid: GridSnap,
): DocumentUpdateResult {
  return transformSolidPrimitive(document, id, "moveSolidControlPoint", (
    solid,
  ) => moveSolidControlPointGeometry(solid, pointId, snap3d(world, grid)));
}
