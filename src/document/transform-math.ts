import type { Primitive2d, TransformPrimitive } from "./parse-document.ts";
import { transformable2dTypes } from "./parse-document.ts";
import type { Point2 } from "./snap.ts";

/**
 * 变换数学纯函数层（ADR 0022）：四变换求像几何的唯一出口，接缝形态与
 * measure-math / function-curve 同构——无副作用、不触碰契约、不依赖视口
 * 实例。像不是图元：transformImage 返回像的几何——与源图元同形的图元值
 * （不进说明书），渲染层拿它走既有画法叠加固定推导（描边虚线化、填充
 * 半透明）。
 */

/** 四种变换参数：契约形状的数学层镜像（spec Implementation Decisions）。
 *  rotate 的 angleDeg 正为逆时针、负值与超 360° 原样存储（显示归一在
 *  面板层做）；dilate 的 ratio 可负（负比 = 中心对称 + 位似）。 */
export type TransformParams =
  | { kind: "translate"; dx: number; dy: number }
  | { kind: "rotate"; centerX: number; centerY: number; angleDeg: number }
  | { kind: "reflect"; x1: number; y1: number; x2: number; y2: number }
  | { kind: "dilate"; centerX: number; centerY: number; ratio: number };

/** 可变换 2D 图元（笔画族 + 封闭族 + 点名）：函数曲线（世界坐标身份冲突，
 *  ADR 0021）与引用型条目（重叠填充/度量标注/transform 自身）不在内。
 *  契约层的 superRefine 白名单（transformable2dTypes，仿 measurable2dTypes）
 *  随 transform 图元契约票落地，与本联合是同一清单的两侧镜像。 */
export type Transformable2d = Extract<
  Primitive2d,
  {
    type:
      | "line"
      | "polygon"
      | "dimension"
      | "angle"
      | "arc"
      | "rectangle"
      | "triangle"
      | "parallelogram"
      | "trapezoid"
      | "regularPolygon"
      | "circle"
      | "sector"
      | "bow"
      | "ring"
      | "ellipse"
      | "label";
  }
>;

/** 平面相似变换的代数形式：像点 = 线性部分 × 点 + 平移部分。四 kind 归一
 *  到同一形状，图元求像不再逐 kind 写点变换。线性部分是均匀缩放乘
 *  （旋转或反射）：det 的绝对值平方根是缩放比、符号是定向（轴对称反定向）。
 *  四 kind 均为相似变换是本层一切推导的前提。 */
type PlaneSimilarity = {
  m00: number;
  m01: number;
  m10: number;
  m11: number;
  tx: number;
  ty: number;
};

const DEG = Math.PI / 180;

function similarityOf(params: TransformParams): PlaneSimilarity {
  switch (params.kind) {
    case "translate":
      return { m00: 1, m01: 0, m10: 0, m11: 1, tx: params.dx, ty: params.dy };
    case "rotate": {
      // p → c + R(p−c) = R·p + (c − R·c)
      const rad = params.angleDeg * DEG;
      const cos = Math.cos(rad);
      const sin = Math.sin(rad);
      return {
        m00: cos,
        m01: -sin,
        m10: sin,
        m11: cos,
        tx: params.centerX - cos * params.centerX + sin * params.centerY,
        ty: params.centerY - sin * params.centerX - cos * params.centerY,
      };
    }
    case "reflect": {
      // 轴过 (x1,y1)、方向 u：M = 2uuᵀ − I，t = a − M·a。
      // 前置条件：两点不重合（手势取点与契约层保证，退化轴无定义）。
      const dx = params.x2 - params.x1;
      const dy = params.y2 - params.y1;
      const len = Math.hypot(dx, dy);
      const ux = dx / len;
      const uy = dy / len;
      const m00 = 2 * ux * ux - 1;
      const m01 = 2 * ux * uy;
      const m10 = m01;
      const m11 = 2 * uy * uy - 1;
      return {
        m00,
        m01,
        m10,
        m11,
        tx: params.x1 - (m00 * params.x1 + m01 * params.y1),
        ty: params.y1 - (m10 * params.x1 + m11 * params.y1),
      };
    }
    case "dilate":
      // p → c + k(p−c) = kI·p + (1−k)c；负比由此自然成为中心对称 + 位似。
      return {
        m00: params.ratio,
        m01: 0,
        m10: 0,
        m11: params.ratio,
        tx: (1 - params.ratio) * params.centerX,
        ty: (1 - params.ratio) * params.centerY,
      };
  }
}

function mapPoint(sim: PlaneSimilarity, point: Point2): Point2 {
  return {
    x: sim.m00 * point.x + sim.m01 * point.y + sim.tx,
    y: sim.m10 * point.x + sim.m11 * point.y + sim.ty,
  };
}

/** 均匀缩放比：长度量（半径、宽高、边长）一律乘它。 */
function scaleOf(sim: PlaneSimilarity): number {
  return Math.sqrt(Math.abs(sim.m00 * sim.m11 - sim.m01 * sim.m10));
}

/** 是否反定向（轴对称专属）：镜像公式组的开关。 */
function reversesOrientation(sim: PlaneSimilarity): boolean {
  return sim.m00 * sim.m11 - sim.m01 * sim.m10 < 0;
}

/** 方向角（度，0° 在 +X 逆时针）的像：保向加线性部分的转角 φ，反向
 *  映到镜像轴的另一侧 2α−θ。反射矩阵是 [[cos2α, sin2α], [sin2α,
 *  −cos2α]]，α 从首行直接反解。 */
function mapDirectionDeg(sim: PlaneSimilarity, deg: number): number {
  if (!reversesOrientation(sim)) {
    return deg + Math.atan2(sim.m10, sim.m00) / DEG;
  }
  const axisDeg = Math.atan2(sim.m01, sim.m00) / (2 * DEG);
  return 2 * axisDeg - deg;
}

/** 单点求像：四 kind 的原子操作，控制点、辅助几何与命中映射共用。 */
export function transformPoint(
  point: Point2,
  params: TransformParams,
): Point2 {
  return mapPoint(similarityOf(params), point);
}

/** 契约白名单的窄化判定：与 parse-document 的 transformable2dTypes 同源
 *  （isMeasurableShape 先例——数学层自己持联合，白名单单侧镜像）。 */
export function isTransformableShape(
  primitive: Primitive2d,
): primitive is Transformable2d {
  return transformable2dTypes.has(primitive.type);
}

/** 查源求像的统一入口（渲染与命中共用）：说明书条目表里按 sourceId 查源、
 *  白名单窄化、经数学层求像；源不存在或掉出白名单（防御性场景，契约已拒）
 *  返回 null。 */
export function resolveTransformImage(
  primitives: readonly Primitive2d[],
  entry: TransformPrimitive,
): Transformable2d | null {
  const source = primitives.find((primitive) => primitive.id === entry.sourceId);
  if (source === undefined || !isTransformableShape(source)) return null;
  return transformImage(source, transformParamsOf(entry));
}

/** 契约条目 → 数学层参数：字段同名同义，收窄掉 id/type/sourceId。
 *  渲染与命中共用的单一换算点。 */
export function transformParamsOf(
  entry: TransformPrimitive,
): TransformParams {
  switch (entry.kind) {
    case "translate":
      return { kind: "translate", dx: entry.dx, dy: entry.dy };
    case "rotate":
      return {
        kind: "rotate",
        centerX: entry.centerX,
        centerY: entry.centerY,
        angleDeg: entry.angleDeg,
      };
    case "reflect":
      return {
        kind: "reflect",
        x1: entry.x1,
        y1: entry.y1,
        x2: entry.x2,
        y2: entry.y2,
      };
    case "dilate":
      return {
        kind: "dilate",
        centerX: entry.centerX,
        centerY: entry.centerY,
        ratio: entry.ratio,
      };
  }
}

/** 中心谓词的单一判定源（票 03）：旋转/位似有中心、平移/轴对称没有。
 *  控制点目录、中心拖动、辅助点画法与预览拼装共用，不各写一遍 kind
 *  谓词；类型守卫让调用方拿得到窄化后的契约分支。 */
export function hasTransformCenter(
  entry: TransformPrimitive,
): entry is Extract<TransformPrimitive, { kind: "rotate" | "dilate" }> {
  return entry.kind === "rotate" || entry.kind === "dilate";
}

/** 变换的中心辅助点：hasTransformCenter 为真时给出 (centerX, centerY)。 */
export function transformCenterOf(
  entry: TransformPrimitive,
): Point2 | null {
  return hasTransformCenter(entry)
    ? { x: entry.centerX, y: entry.centerY }
    : null;
}

/** 逆时针圆族（角/弧/扇形/弓形）起止角的像：保向整体加转角；反定向
 *  时扫过区间镜像、逆时针起点换成原终点（起止交换）。 */
function mapSweepDeg(
  sim: PlaneSimilarity,
  startDeg: number,
  endDeg: number,
): { startDeg: number; endDeg: number } {
  if (!reversesOrientation(sim)) {
    return {
      startDeg: mapDirectionDeg(sim, startDeg),
      endDeg: mapDirectionDeg(sim, endDeg),
    };
  }
  return {
    startDeg: mapDirectionDeg(sim, endDeg),
    endDeg: mapDirectionDeg(sim, startDeg),
  };
}

/** 底/高族的局部 X 偏移（apexOffset/skew/topOffset）的像：保向随缩放比
 *  缩放；反向翻号并补 180°——镜像把局部 +Y 转到帧的 −Y，翻帧才能让
 *  高度保持沿局部 +Y。返回 [偏移像, 旋转角像]。 */
function mapOffsetAndRotationDeg(
  sim: PlaneSimilarity,
  offset: number,
  rotationDeg: number,
): [offset: number, rotationDeg: number] {
  const directionDeg = mapDirectionDeg(sim, rotationDeg);
  if (!reversesOrientation(sim)) {
    return [offset * scaleOf(sim), directionDeg];
  }
  return [-offset, directionDeg + 180];
}

/** 图元求像：输入源几何与变换参数，输出像的几何（样式与文本字段原样
 *  保留给渲染层，id 沿源、不进说明书）。返回类型随源收窄——像保持源的
 *  判别键与字段形状。退化取值（零向量、0°、比 0 或 1）由契约层拒绝，
 *  本层保持全。点名特例在此收口：只有锚点照变换，字形不旋转不缩放
 *  （点名字段只有锚点与文本，天然成立）。16 个 case 沿 measure-math
 *  的穷尽 switch 惯例保持扁平，不按族再拆层。 */
export function transformImage<T extends Transformable2d>(
  source: T,
  params: TransformParams,
): T {
  const sim = similarityOf(params);
  const scale = scaleOf(sim);
  switch (source.type) {
    // 点族：折线/多边形/尺寸标注逐点求像（尺寸标注的显示数字是渲染期
    // 推导值，随点自动更新；两点定长元组解构保形）。
    case "line":
    case "polygon":
      return {
        ...source,
        points: source.points.map((point) => mapPoint(sim, point)),
      };
    case "dimension": {
      const [a, b] = source.points;
      return { ...source, points: [mapPoint(sim, a), mapPoint(sim, b)] };
    }
    // 底/高族：锚点求像、宽/高缩放、局部 X 偏移与旋转角成对换算
    // （镜像翻帧，见 mapOffsetAndRotationDeg）。
    case "triangle": {
      const anchor = mapPoint(sim, { x: source.x, y: source.y });
      const [apexOffset, rotationDeg] = mapOffsetAndRotationDeg(
        sim,
        source.apexOffset,
        source.rotationDeg,
      );
      return {
        ...source,
        x: anchor.x,
        y: anchor.y,
        width: source.width * scale,
        height: source.height * scale,
        apexOffset,
        rotationDeg,
      };
    }
    case "parallelogram": {
      const anchor = mapPoint(sim, { x: source.x, y: source.y });
      const [skew, rotationDeg] = mapOffsetAndRotationDeg(
        sim,
        source.skew,
        source.rotationDeg,
      );
      return {
        ...source,
        x: anchor.x,
        y: anchor.y,
        width: source.width * scale,
        height: source.height * scale,
        skew,
        rotationDeg,
      };
    }
    case "trapezoid": {
      const anchor = mapPoint(sim, { x: source.x, y: source.y });
      const [topOffset, rotationDeg] = mapOffsetAndRotationDeg(
        sim,
        source.topOffset,
        source.rotationDeg,
      );
      return {
        ...source,
        x: anchor.x,
        y: anchor.y,
        width: source.width * scale,
        topWidth: source.topWidth * scale,
        height: source.height * scale,
        topOffset,
        rotationDeg,
      };
    }
    // 锚点 + rotationDeg 的对称族：锚点求像、尺寸缩放、方向角换算
    // （矩形与椭圆对 90°/180° 代表元不敏感，方向角直接取像）。
    case "rectangle": {
      const anchor = mapPoint(sim, { x: source.x, y: source.y });
      return {
        ...source,
        x: anchor.x,
        y: anchor.y,
        width: source.width * scale,
        height: source.height * scale,
        rotationDeg: mapDirectionDeg(sim, source.rotationDeg),
      };
    }
    case "ellipse": {
      const center = mapPoint(sim, { x: source.cx, y: source.cy });
      return {
        ...source,
        cx: center.x,
        cy: center.y,
        rx: source.rx * scale,
        ry: source.ry * scale,
        rotationDeg: mapDirectionDeg(sim, source.rotationDeg),
      };
    }
    // 正多边形：中心求像、外接圆半径缩放；镜像的顶点栅格 (−90+180/n
    //  + k·360/n) 逐点映到 2α−r−栅格，换回规范栅格需补 180−360/n。
    case "regularPolygon": {
      const center = mapPoint(sim, { x: source.x, y: source.y });
      return {
        ...source,
        x: center.x,
        y: center.y,
        r: source.r * scale,
        rotationDeg: reversesOrientation(sim)
          ? mapDirectionDeg(sim, source.rotationDeg) +
            180 -
            360 / source.sides
          : mapDirectionDeg(sim, source.rotationDeg),
      };
    }
    // 圆族（圆/环）：中心求像、半径按缩放比（环的两半径同比缩放，
    // 大小关系保持）；正多边形无方向、圆无方向角。
    case "circle":
    case "ring": {
      const center = mapPoint(sim, { x: source.cx, y: source.cy });
      return source.type === "circle"
        ? { ...source, cx: center.x, cy: center.y, r: source.r * scale }
        : {
            ...source,
            cx: center.x,
            cy: center.y,
            rInner: source.rInner * scale,
            rOuter: source.rOuter * scale,
          };
    }
    // 逆时针圆族（弧/扇形/弓形）与角图元：锚点求像、半径/边长缩放、
    // 起止角按方向角规则换算（反定向起止交换，sweep 保持逆时针语义）。
    case "arc":
    case "sector":
    case "bow": {
      const center = mapPoint(sim, { x: source.cx, y: source.cy });
      const sweep = mapSweepDeg(sim, source.startDeg, source.endDeg);
      return {
        ...source,
        cx: center.x,
        cy: center.y,
        r: source.r * scale,
        ...sweep,
      };
    }
    case "angle": {
      const vertex = mapPoint(sim, { x: source.x, y: source.y });
      const sweep = mapSweepDeg(sim, source.startDeg, source.endDeg);
      return {
        ...source,
        x: vertex.x,
        y: vertex.y,
        length: source.length * scale,
        ...sweep,
      };
    }
    // 点名特例：锚点照变换、字形不旋转不缩放（AC 钉死，保持水平可读）。
    case "label": {
      const anchor = mapPoint(sim, { x: source.x, y: source.y });
      return { ...source, x: anchor.x, y: anchor.y };
    }
  }
}
