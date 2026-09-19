import Konva from "konva";
import type {
  Fill,
  GeometryDocument,
  MeasurePrimitive,
  Primitive2d,
  TransformPrimitive,
} from "../document/index.ts";
import {
  resolveTransformImage,
  type Transformable2d,
} from "../document/transform-math.ts";
import { baseHeightWorldVertices } from "../document/base-height-family.ts";
import { regularPolygonWorldVertices } from "../document/regular-polygon.ts";
import {
  angleArcRadius,
  angleDegreeAnchor,
  angleEndPoint,
  angleStartPoint,
} from "../document/angle.ts";
import {
  angleDegreeText,
  angleSweepDeg,
  formatMeasureNumber,
  isMeasurableShape,
  measureAreaAnchor,
  measurePerimeterAnchor,
  measureText as measureDisplayText,
  MEASURE_TEXT_FONT_PX,
} from "../document/measure-math.ts";
import type { DrawPreview } from "./draw-gesture.ts";
import {
  curveViewportOf,
  worldToScreen,
  type Point2,
  type ViewTransform,
} from "./transform.ts";
import {
  functionCurveParamsOf,
  sampleFunctionCurve,
} from "../document/function-curve.ts";

const STROKE = "#18181b";
/**
 * 选中标记的强调色（indigo-500）与画法：低饱和靛蓝 + 连续细线 + 沿轮廓
 * 柔光晕——「背光」质感来自分层克制，不是高饱和荧光色（虚线同理弃用：
 * 虚线是草稿/选框的语言，不是精致工具的）。
 */
export const SELECTION_STROKE = "#6366f1";
/** 变换像预览标记：像不进说明书，预览层直接携带像图元值（数学层推导）。 */
export type TransformImagePreview = {
  type: "transformImage";
  image: Transformable2d;
};
/** 预览标记：单形、数组（选中 overlapFill 时同时高亮两个源）或变换像。 */
export type PreviewMark =
  | DrawPreview
  | DrawPreview[]
  | TransformImagePreview;
const FILL_SOLID = "rgba(24, 24, 27, 0.14)";
const DEG = Math.PI / 180;
const STROKE_WIDTH = 1.5;

type Sweep = {
  cx: number;
  cy: number;
  r: number;
  startDeg: number;
  endDeg: number;
};

function polar(cx: number, cy: number, r: number, deg: number): Point2 {
  const rad = deg * DEG;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function arcWorldPoints(sweep: Sweep): Point2[] {
  const span = angleSweepDeg(sweep.startDeg, sweep.endDeg);
  const steps = Math.max(12, Math.ceil((span / 360) * 64));
  return Array.from({ length: steps + 1 }, (_, i) =>
    polar(
      sweep.cx,
      sweep.cy,
      sweep.r,
      sweep.startDeg + (span * i) / steps,
    ),
  );
}

function toScreenPoints(points: Point2[], view: ViewTransform): number[] {
  return points.flatMap((point) => {
    const screen = worldToScreen(point, view);
    return [screen.x, screen.y];
  });
}

function hatchCanvas(): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = 8;
  canvas.height = 8;
  const ctx = canvas.getContext("2d");
  if (ctx === null) return canvas;
  ctx.strokeStyle = "rgba(24, 24, 27, 0.55)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, 8);
  ctx.lineTo(8, 0);
  ctx.stroke();
  return canvas;
}

let hatchImage: HTMLCanvasElement | undefined;

function fillConfig(fill: Fill | undefined): Konva.ShapeConfig {
  if (fill === "solid") {
    return { fill: FILL_SOLID };
  }
  if (fill === "hatch") {
    hatchImage ??= hatchCanvas();
    return {
      fillPatternImage: hatchImage as unknown as HTMLImageElement,
      fillPatternRepeat: "repeat",
      fillPriority: "pattern",
    };
  }
  return { fillEnabled: false };
}

function strokeLine(
  points: number[],
  closed: boolean,
  fill?: Fill,
  dash?: number[],
): Konva.Line {
  return new Konva.Line({
    points,
    closed,
    stroke: STROKE,
    strokeWidth: STROKE_WIDTH,
    lineJoin: "round",
    lineCap: "round",
    listening: false,
    dash,
    ...fillConfig(fill),
  });
}

function centerScreen(
  cx: number,
  cy: number,
  view: ViewTransform,
): Point2 {
  return worldToScreen({ x: cx, y: cy }, view);
}

function drawDisk(
  cx: number,
  cy: number,
  radius: number,
  fill: Fill,
  view: ViewTransform,
): Konva.Circle {
  const center = centerScreen(cx, cy, view);
  return new Konva.Circle({
    x: center.x,
    y: center.y,
    radius: radius * view.scale,
    stroke: STROKE,
    strokeWidth: STROKE_WIDTH,
    listening: false,
    ...fillConfig(fill),
  });
}

function drawSweepPath(
  sweep: Sweep,
  view: ViewTransform,
  closed: boolean,
  prefix: Point2[] = [],
  fill?: Fill,
): Konva.Line {
  return strokeLine(
    toScreenPoints([...prefix, ...arcWorldPoints(sweep)], view),
    closed,
    fill,
  );
}

/** 箭头翼端：从尖端沿指向 toward 的方向回摆 150° 的两翼（屏幕坐标）。 */
function arrowWings(
  tip: Point2,
  toward: Point2,
  size: number,
): [Point2, Point2] {
  const dx = toward.x - tip.x;
  const dy = toward.y - tip.y;
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len;
  const uy = dy / len;
  const rad = (150 * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  return [
    { x: tip.x + (ux * cos - uy * sin) * size, y: tip.y + (ux * sin + uy * cos) * size },
    { x: tip.x + (ux * cos + uy * sin) * size, y: tip.y + (-ux * sin + uy * cos) * size },
  ];
}

/** 标注数字：两点距离的推导值，统一走度量数学层的格式化（两位去尾零）。 */
function dimensionLabel(primitive: Extract<Primitive2d, { type: "dimension" }>): string {
  const [a, b] = primitive.points;
  return formatMeasureNumber(Math.hypot(b.x - a.x, b.y - a.y));
}

/** 度量数字文本（尺寸标注线与角度数共用）：统一字体字号，水平居中；
 *  垂直位置由调用方定（需要垂直居中时再设 offsetY）。 */
function measureText(x: number, y: number, text: string): Konva.Text {
  const label = new Konva.Text({
    x,
    y,
    text,
    fontSize: MEASURE_TEXT_FONT_PX,
    fontFamily: "sans-serif",
    fill: STROKE,
    listening: false,
  });
  label.offsetX(label.width() / 2);
  return label;
}

function drawDimension(
  primitive: Extract<Primitive2d, { type: "dimension" }>,
  view: ViewTransform,
): Konva.Shape[] {
  const [a, b] = primitive.points;
  const screenA = worldToScreen(a, view);
  const screenB = worldToScreen(b, view);
  const ARROW_PX = 8;
  const [aWing1, aWing2] = arrowWings(screenA, screenB, ARROW_PX);
  const [bWing1, bWing2] = arrowWings(screenB, screenA, ARROW_PX);
  const mid = {
    x: (screenA.x + screenB.x) / 2,
    y: (screenA.y + screenB.y) / 2,
  };
  const label = measureText(mid.x, mid.y - 16, dimensionLabel(primitive));
  return [
    strokeLine([screenA.x, screenA.y, screenB.x, screenB.y], false),
    strokeLine(
      [aWing1.x, aWing1.y, screenA.x, screenA.y, aWing2.x, aWing2.y],
      false,
    ),
    strokeLine(
      [bWing1.x, bWing1.y, screenB.x, screenB.y, bWing2.x, bWing2.y],
      false,
    ),
    label,
  ];
}

function drawPrimitive(
  primitive: Primitive2d,
  view: ViewTransform,
): Konva.Shape[] {
  switch (primitive.type) {
    case "overlapFill":
      // 引用条目不画自身：交集由投影器离屏合成（见 projector 的 overlap 层）。
      return [];
    case "measure":
      // 引用条目不画自身：文本需要查源，由 drawDocumentPrimitives 的度量层
      // 专趟处理（画在全部几何之上）。
      return [];
    case "transform":
      // 引用条目不画自身：像由 drawDocumentPrimitives 的变换像层专趟推导
      // （画在源与重叠填充之上、度量标注之下）。
      return [];
    case "line":
      return [strokeLine(toScreenPoints(primitive.points, view), false)];
    case "functionCurve": {
      // Konva 折线按纯函数层采样分段绘制（inverse 两支断开）：曲线铺满
      // 可见 x 范围、随平移缩放每帧重算重绘（redraw 全量重建本层节点）。
      const viewport = curveViewportOf(view);
      if (viewport === null) return [];
      return sampleFunctionCurve(
        functionCurveParamsOf(primitive),
        viewport,
      ).map((segment) => strokeLine(toScreenPoints(segment, view), false));
    }
    case "dimension":
      return drawDimension(primitive, view);
    case "polygon":
      return [
        strokeLine(toScreenPoints(primitive.points, view), true, primitive.fill),
      ];
    case "rectangle": {
      const center = centerScreen(primitive.x, primitive.y, view);
      const width = primitive.width * view.scale;
      const height = primitive.height * view.scale;
      return [
        new Konva.Rect({
          x: center.x,
          y: center.y,
          width,
          height,
          // 矩形以中心定位：offset 把局部原点挪到左上角，旋转绕中心。
          offsetX: width / 2,
          offsetY: height / 2,
          // 世界系逆时针为正，Konva 屏幕系顺时针为正，符号取反。
          rotation: -primitive.rotationDeg,
          stroke: STROKE,
          strokeWidth: STROKE_WIDTH,
          listening: false,
          ...fillConfig(primitive.fill),
        }),
      ];
    }
    case "circle":
      return [
        drawDisk(primitive.cx, primitive.cy, primitive.r, primitive.fill, view),
      ];
    case "triangle":
    case "parallelogram":
    case "trapezoid":
    case "regularPolygon":
      // 顶点已随 rotationDeg 旋到世界：闭合折线即形，无需 Konva rotation。
      return [
        strokeLine(
          toScreenPoints(
            primitive.type === "regularPolygon"
              ? regularPolygonWorldVertices(primitive)
              : baseHeightWorldVertices(primitive),
            view,
          ),
          true,
          primitive.fill,
        ),
      ];
    case "ellipse": {
      const center = centerScreen(primitive.cx, primitive.cy, view);
      return [
        new Konva.Ellipse({
          x: center.x,
          y: center.y,
          radiusX: primitive.rx * view.scale,
          radiusY: primitive.ry * view.scale,
          // 世界系逆时针为正，Konva 屏幕系顺时针为正，符号取反。
          rotation: -primitive.rotationDeg,
          stroke: STROKE,
          strokeWidth: STROKE_WIDTH,
          listening: false,
          ...fillConfig(primitive.fill),
        }),
      ];
    }
    case "ring": {
      const center = centerScreen(primitive.cx, primitive.cy, view);
      return [
        new Konva.Ring({
          x: center.x,
          y: center.y,
          innerRadius: primitive.rInner * view.scale,
          outerRadius: primitive.rOuter * view.scale,
          stroke: STROKE,
          strokeWidth: STROKE_WIDTH,
          listening: false,
          ...fillConfig(primitive.fill),
        }),
      ];
    }
    case "arc":
      return [drawSweepPath(primitive, view, false)];
    case "angle": {
      // 笔画族：两边是共享顶点的折线，弧标总是画出（半径按边长比例）。
      const vertex = { x: primitive.x, y: primitive.y };
      const sides = [
        angleStartPoint(primitive),
        vertex,
        angleEndPoint(primitive),
      ];
      const shapes: Konva.Shape[] = [
        strokeLine(toScreenPoints(sides, view), false),
        drawSweepPath(
          {
            cx: primitive.x,
            cy: primitive.y,
            r: angleArcRadius(primitive),
            startDeg: primitive.startDeg,
            endDeg: primitive.endDeg,
          },
          view,
          false,
        ),
      ];
      // 度数是渲染期推导值：开关打开才画文本，数值不进契约（ADR 0020）。
      if (primitive.showDeg === true) {
        const anchor = worldToScreen(angleDegreeAnchor(primitive), view);
        const text = measureText(anchor.x, anchor.y, angleDegreeText(primitive));
        text.offsetY(text.height() / 2);
        shapes.push(text);
      }
      return shapes;
    }
    case "sector":
      return [
        drawSweepPath(
          primitive,
          view,
          true,
          [{ x: primitive.cx, y: primitive.cy }],
          primitive.fill,
        ),
      ];
    case "bow":
      return [drawSweepPath(primitive, view, true, [], primitive.fill)];
    case "label": {
      const point = worldToScreen({ x: primitive.x, y: primitive.y }, view);
      return [
        new Konva.Circle({
          x: point.x,
          y: point.y,
          radius: 3,
          fill: STROKE,
          listening: false,
        }),
        new Konva.Text({
          x: point.x + 6,
          y: point.y - 16,
          text: primitive.text,
          fontSize: 14,
          fontFamily: "sans-serif",
          fill: STROKE,
          listening: false,
        }),
      ];
    }
  }
}

function previewPrimitive(preview: DrawPreview): Primitive2d | null {
  if (preview === null || preview.type === "guide") {
    return null;
  }
  if (preview.type === "line") {
    if (preview.points.length < 2) return null;
    return { id: "preview", type: "line", points: preview.points };
  }
  if (preview.type === "dimension") {
    if (preview.points.length < 2) return null;
    return {
      id: "preview",
      type: "dimension",
      points: [preview.points[0]!, preview.points[1]!],
    };
  }
  if (preview.type === "polygon") {
    if (preview.points.length < 3) {
      if (preview.points.length < 2) return null;
      return { id: "preview", type: "line", points: preview.points };
    }
    return {
      id: "preview",
      type: "polygon",
      points: preview.points,
      fill: "none",
    };
  }
  if (preview.type === "circle") {
    if (preview.r <= 0) return null;
    return { id: "preview", ...preview, fill: "none" };
  }
  if (preview.type === "rectangle") {
    if (preview.width <= 0 || preview.height <= 0) return null;
    return { id: "preview", ...preview, fill: "none" };
  }
  if (preview.type === "triangle") {
    if (preview.width <= 0 || preview.height <= 0) return null;
    return { id: "preview", ...preview, fill: "none" };
  }
  if (preview.type === "parallelogram") {
    // 预览态允许 skew 过零（ADR 0007）：退化只挡非正尺寸。
    if (preview.width <= 0 || preview.height <= 0) return null;
    return { id: "preview", ...preview, fill: "none" };
  }
  if (preview.type === "trapezoid") {
    if (
      preview.width <= 0 ||
      preview.topWidth <= 0 ||
      preview.height <= 0
    ) {
      return null;
    }
    return { id: "preview", ...preview, fill: "none" };
  }
  if (preview.type === "ellipse") {
    if (preview.rx <= 0 || preview.ry <= 0) return null;
    return { id: "preview", ...preview, fill: "none" };
  }
  if (preview.type === "ring") {
    if (preview.rOuter <= 0) return null;
    if (preview.rInner <= 0 || preview.rInner >= preview.rOuter) {
      return {
        id: "preview",
        type: "circle",
        cx: preview.cx,
        cy: preview.cy,
        r: preview.rOuter,
        fill: "none",
      };
    }
    return { id: "preview", ...preview, fill: "none" };
  }
  if (preview.type === "angle") {
    if (preview.length <= 0) return null;
    return { id: "preview", ...preview };
  }
  if (preview.type === "regularPolygon") {
    if (preview.r <= 0) return null;
    return { id: "preview", ...preview, fill: "none" };
  }
  if (preview.type === "label") {
    return { id: "preview", ...preview };
  }
  if (preview.type === "functionCurve") {
    // 缺省参数即合法（a=1、k=1 非退化），采样视口缺失时渲染为空由
    // drawPrimitive 兜底。
    return { id: "preview", ...preview };
  }
  if (preview.r <= 0) return null;
  if (preview.type === "arc") {
    return { id: "preview", ...preview };
  }
  if (preview.type === "sector") {
    return { id: "preview", ...preview, fill: "none" };
  }
  return { id: "preview", ...preview, fill: "none" };
}

function previewGuidePoints(preview: DrawPreview): Point2[] {
  if (preview === null) return [];
  if (preview.type === "functionCurve") {
    // 无锚点无控制点：曲线由参数决定，手势单击不落任何几何。
    return [];
  }
  if (
    preview.type === "line" ||
    preview.type === "dimension" ||
    preview.type === "polygon" ||
    preview.type === "guide"
  ) {
    return preview.points;
  }
  if (
    preview.type === "label" ||
    preview.type === "rectangle" ||
    preview.type === "triangle" ||
    preview.type === "parallelogram" ||
    preview.type === "trapezoid" ||
    preview.type === "angle" ||
    preview.type === "regularPolygon"
  ) {
    return [{ x: preview.x, y: preview.y }];
  }
  return [{ x: preview.cx, y: preview.cy }];
}

/**
 * 变换像的固定推导画法（ADR 0022）：源样式 + 描边虚线化 + 填充半透明。
 * 虚线是「像」的语言（推导值非本体，与选中标记的背光连续线可区分）；
 * 「半透明填充」取既有填充基调本身（solid 0.14、hatch 0.55，均带透明度）
 * ——像与源同基调、以虚线区分，不再叠一层透明（人工走查项）。点名的像
 * 文本原样（锚点照变换、字形不旋转不缩放，数学层已收口）。
 */
function transformImageShapes(
  image: Transformable2d,
  view: ViewTransform,
): Konva.Shape[] {
  return drawPrimitive(image, view).map((node) => {
    if (!(node instanceof Konva.Text)) {
      node.dash([6, 4]);
    }
    return node;
  });
}

/** 一条变换图元的像：查源求像（统一入口在数学层），虚线上屏。调用点已
 *  收窄 2D 说明书。 */
function drawTransformImage(
  entry: TransformPrimitive,
  document: Extract<GeometryDocument, { space: "2d" }>,
  view: ViewTransform,
): Konva.Shape[] {
  const image = resolveTransformImage(document.primitives, entry);
  if (image === null) return [];
  return transformImageShapes(image, view);
}

export function drawGesturePreview(
  layer: Konva.Layer,
  preview: PreviewMark,
  view: ViewTransform,
  selectionStroke?: string,
): void {
  layer.destroyChildren();
  if (preview === null) {
    return;
  }
  if (Array.isArray(preview)) {
    for (const item of preview) {
      drawSinglePreview(layer, item, view, selectionStroke);
    }
    return;
  }
  if (preview.type === "transformImage") {
    for (const node of transformImageShapes(preview.image, view)) {
      layer.add(node);
    }
    return;
  }
  drawSinglePreview(layer, preview, view, selectionStroke);
}

function drawSinglePreview(
  layer: Konva.Layer,
  preview: DrawPreview,
  view: ViewTransform,
  selectionStroke?: string,
): void {
  if (preview === null) return;
  const primitive = previewPrimitive(preview);
  if (primitive !== null) {
    for (const node of drawPrimitive(primitive, view)) {
      if (selectionStroke === undefined) {
        node.dash([6, 4]);
      } else {
        // 选中标记：连续细线 + 同色柔光晕（背光质感），弃虚线。
        node.strokeWidth(2);
        node.shadowColor(selectionStroke);
        node.shadowBlur(8);
        node.shadowOpacity(0.4);
      }
      // 换色：文本染色用 fill，其余形状描边换色。
      if (node instanceof Konva.Text) {
        node.fill(selectionStroke ?? STROKE);
      } else {
        node.stroke(selectionStroke ?? STROKE);
      }
      layer.add(node);
    }
  } else if (
    (preview.type === "line" ||
      preview.type === "dimension" ||
      preview.type === "polygon" ||
      preview.type === "guide") &&
    preview.points.length >= 2
  ) {
    const guide = strokeLine(
      toScreenPoints(preview.points, view),
      false,
      undefined,
      selectionStroke === undefined ? [6, 4] : undefined,
    );
    guide.stroke(selectionStroke ?? STROKE);
    if (selectionStroke !== undefined) {
      guide.strokeWidth(2);
      guide.shadowColor(selectionStroke);
      guide.shadowBlur(8);
      guide.shadowOpacity(0.4);
    }
    layer.add(guide);
  }
  for (const point of previewGuidePoints(preview)) {
    const screen = worldToScreen(point, view);
    layer.add(
      new Konva.Circle({
        x: screen.x,
        y: screen.y,
        radius: 3,
        fill: selectionStroke === undefined ? STROKE : "#ffffff",
        stroke: selectionStroke,
        strokeWidth: 1.5,
        listening: false,
      }),
    );
  }
}

export function drawDocumentPrimitives(
  layer: Konva.Layer,
  document: GeometryDocument,
  view: ViewTransform,
): void {
  layer.destroyChildren();
  if (document.space !== "2d") {
    return;
  }
  for (const primitive of document.primitives) {
    if (primitive.type === "overlapFill") continue;
    for (const node of drawPrimitive(primitive, view)) {
      layer.add(node);
    }
  }
  // 重叠填充画在全部几何之上（它着色的就是「压在上面」的交集）。
  // 遮罩画布按 Konva 全局 pixelRatio 出图，保证与图层同等清晰度。
  const pixelRatio = Konva.pixelRatio ?? 1;
  for (const primitive of document.primitives) {
    if (primitive.type !== "overlapFill") continue;
    for (const node of drawOverlapFill(primitive, document, view, pixelRatio)) {
      layer.add(node);
    }
  }
  // 变换像画在源与重叠填充之上、度量标注之下（spec 渲染条）：像由数学层
  // 对源几何实时推导（不进说明书），源拖动/编辑后重画即自动跟随。
  for (const primitive of document.primitives) {
    if (primitive.type !== "transform") continue;
    for (const node of drawTransformImage(primitive, document, view)) {
      layer.add(node);
    }
  }
  // 度量标注画在最上层：数值是渲染期推导值（ADR 0020），每次重画随源
  // 几何实时重算——拖动、控制点编辑、变换之后数字永远与几何一致。
  for (const primitive of document.primitives) {
    if (primitive.type !== "measure") continue;
    for (const node of drawMeasure(primitive, document, view)) {
      layer.add(node);
    }
  }
}

// —— 度量标注（ADR 0020 引用式）——
// 无坐标纯跟随：条目自身不存几何，渲染时按 sourceId 查源、经度量数学层
// 推导数值与锚点。面积文本在源形心（文本中心对齐），周长文本在源紧
// 包围盒上方中点（文本底边贴包络上沿，区别于面积的形心放置）。

function drawMeasure(
  entry: MeasurePrimitive,
  document: GeometryDocument,
  view: ViewTransform,
): Konva.Shape[] {
  const source = document.primitives.find(
    (primitive) => primitive.id === entry.sourceId,
  );
  if (source === undefined || !isMeasurableShape(source)) return [];
  // 水平居中由 measureText 负责；垂直位置按种类：形心 = 文本中心，
  // 包围盒上方中点 = 文本底边（世界系 y 向上，上沿即 maxY）。
  const anchor =
    entry.kind === "area"
      ? worldToScreen(measureAreaAnchor(source), view)
      : worldToScreen(measurePerimeterAnchor(source), view);
  const text = measureText(
    anchor.x,
    anchor.y,
    measureDisplayText(source, entry.kind),
  );
  text.offsetY(entry.kind === "area" ? text.height() / 2 : text.height());
  return [text];
}

// —— 重叠填充（ADR 0019 引用式）——
// 交集不进说明书，渲染期用离屏 canvas 合成：先画源 A，再以 source-in 叠画
// 源 B 得到 alpha 遮罩，最后把填充样式穿遮罩上屏。路径在世界坐标系里描述
// （圆、椭圆走 canvas arc，曲边精确），交给 world→screen 仿射变换映射。

type OverlapFillEntry = Extract<Primitive2d, { type: "overlapFill" }>;

/** 源图元的填充区域路径（世界坐标）。环用内外双弧 + evenodd 挖洞。 */
function traceSourcePath(
  ctx: CanvasRenderingContext2D,
  source: Primitive2d,
): void {
  switch (source.type) {
    case "circle":
      ctx.arc(source.cx, source.cy, source.r, 0, Math.PI * 2);
      break;
    case "ellipse":
      ctx.ellipse(
        source.cx,
        source.cy,
        source.rx,
        source.ry,
        source.rotationDeg * DEG,
        0,
        Math.PI * 2,
      );
      break;
    case "rectangle": {
      ctx.save();
      ctx.translate(source.x, source.y);
      ctx.rotate(source.rotationDeg * DEG);
      ctx.rect(
        -source.width / 2,
        -source.height / 2,
        source.width,
        source.height,
      );
      ctx.restore();
      break;
    }
    case "triangle":
    case "parallelogram":
    case "trapezoid":
    case "regularPolygon": {
      const vertices =
        source.type === "regularPolygon"
          ? regularPolygonWorldVertices(source)
          : baseHeightWorldVertices(source);
      tracePolyline(ctx, vertices);
      break;
    }
    case "polygon":
      tracePolyline(ctx, source.points);
      break;
    case "sector": {
      ctx.moveTo(source.cx, source.cy);
      tracePolyline(ctx, arcWorldPoints(source));
      break;
    }
    case "bow":
      tracePolyline(ctx, arcWorldPoints(source));
      break;
    case "ring": {
      // evenodd 由调用方 fill 时指定：外弧 + 内弧围出环带。
      ctx.arc(source.cx, source.cy, source.rOuter, 0, Math.PI * 2);
      ctx.moveTo(source.cx + source.rInner, source.cy);
      ctx.arc(source.cx, source.cy, source.rInner, 0, Math.PI * 2);
      break;
    }
    case "line":
    case "dimension":
    case "arc":
    case "angle":
    case "label":
    case "overlapFill":
      // 笔画族与引用条目不可能是源（schema 已拒），防御性留空。
      break;
  }
}

function tracePolyline(ctx: CanvasRenderingContext2D, points: Point2[]): void {
  const first = points[0];
  if (first === undefined) return;
  ctx.moveTo(first.x, first.y);
  for (const point of points.slice(1)) {
    ctx.lineTo(point.x, point.y);
  }
  ctx.closePath();
}

/** 源的世界包围盒（取并集用）；笔画族无面积返回 null。 */
function worldSourceBounds(
  source: Primitive2d,
): { minX: number; minY: number; maxX: number; maxY: number } | null {
  switch (source.type) {
    case "circle":
    case "sector":
    case "bow":
      return {
        minX: source.cx - source.r,
        minY: source.cy - source.r,
        maxX: source.cx + source.r,
        maxY: source.cy + source.r,
      };
    case "ring":
      return {
        minX: source.cx - source.rOuter,
        minY: source.cy - source.rOuter,
        maxX: source.cx + source.rOuter,
        maxY: source.cy + source.rOuter,
      };
    case "ellipse": {
      // 旋转椭圆的包围半径：半轴按旋转角投影取包络。
      const cos = Math.cos(source.rotationDeg * DEG);
      const sin = Math.sin(source.rotationDeg * DEG);
      const ex = Math.hypot(source.rx * cos, source.ry * sin);
      const ey = Math.hypot(source.rx * sin, source.ry * cos);
      return {
        minX: source.cx - ex,
        minY: source.cy - ey,
        maxX: source.cx + ex,
        maxY: source.cy + ey,
      };
    }
    case "rectangle":
      return {
        minX: source.x - source.width / 2,
        minY: source.y - source.height / 2,
        maxX: source.x + source.width / 2,
        maxY: source.y + source.height / 2,
      };
    case "triangle":
    case "parallelogram":
    case "trapezoid":
    case "regularPolygon": {
      const vertices =
        source.type === "regularPolygon"
          ? regularPolygonWorldVertices(source)
          : baseHeightWorldVertices(source);
      return boundsOfPoints(vertices);
    }
    case "polygon":
      return boundsOfPoints(source.points);
    default:
      return null;
  }
}

function boundsOfPoints(points: readonly Point2[]) {
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  return {
    minX: Math.min(...xs),
    minY: Math.min(...ys),
    maxX: Math.max(...xs),
    maxY: Math.max(...ys),
  };
}

function paintSource(
  ctx: CanvasRenderingContext2D,
  source: Primitive2d,
): void {
  ctx.beginPath();
  traceSourcePath(ctx, source);
  ctx.fill(source.type === "ring" ? "evenodd" : "nonzero");
}

/**
 * 两源是否相交：与渲染同源的离屏合成判据——交集遮罩里采到 alpha 即相交。
 * 曲边精确（圆、椭圆走 canvas arc），创建时的契约校验用（ADR 0019：
 * 相交性不进 schema，只守创建时）。
 */
export function sourcesIntersect(
  a: Primitive2d,
  b: Primitive2d,
): boolean {
  const boundsA = worldSourceBounds(a);
  const boundsB = worldSourceBounds(b);
  if (boundsA === null || boundsB === null) return false;
  const world = {
    minX: Math.min(boundsA.minX, boundsB.minX),
    minY: Math.min(boundsA.minY, boundsB.minY),
    maxX: Math.max(boundsA.maxX, boundsB.maxX),
    maxY: Math.max(boundsA.maxY, boundsB.maxY),
  };
  const width = Math.max(1, world.maxX - world.minX);
  const height = Math.max(1, world.maxY - world.minY);
  // 采样步长取包围盒短边的 1/200：足以分辨任何有意义的交集面积。
  const step = Math.max(1, Math.floor(Math.min(width, height) / 200));
  const canvas = window.document.createElement("canvas");
  canvas.width = Math.ceil(width / step);
  canvas.height = Math.ceil(height / step);
  const ctx = canvas.getContext("2d");
  if (ctx === null) return false;
  ctx.setTransform(1 / step, 0, 0, -1 / step, -world.minX / step, world.maxY / step);
  ctx.fillStyle = "#000";
  paintSource(ctx, a);
  ctx.globalCompositeOperation = "source-in";
  paintSource(ctx, b);
  const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
  for (let i = 3; i < data.length; i += 4) {
    if (data[i] > 0) return true;
  }
  return false;
}

/**
 * 世界 → 遮罩画布像素的仿射参数（ctx.setTransform 的六个数）。
 * 遮罩画布左上角对应屏幕 (x, y)：任意世界点 w 必须映射为
 * (worldToScreen(w) − (x, y)) · pixelRatio，与贴回的 Konva.Image 对齐。
 */
export function overlapMaskTransform(
  view: ViewTransform,
  x: number,
  y: number,
  pixelRatio: number,
): [number, number, number, number, number, number] {
  return [
    view.scale * pixelRatio,
    0,
    0,
    -view.scale * pixelRatio,
    (view.originX - x) * pixelRatio,
    (view.originY - y) * pixelRatio,
  ];
}

/**
 * 一条重叠填充的渲染节点：交集遮罩离屏合成后以 Konva.Image 上层贴回。
 * 源被拖到不相交时遮罩全透明——渲染为空，条目仍在说明书里。
 */
function drawOverlapFill(
  entry: OverlapFillEntry,
  geometry: GeometryDocument,
  view: ViewTransform,
  pixelRatio: number,
): Konva.Shape[] {
  if (entry.fill === "none") return [];
  const sources = entry.sources.map((id) =>
    geometry.primitives.find(
      (primitive): primitive is Primitive2d =>
        primitive.id === id && primitive.type !== "overlapFill",
    ),
  );
  const [a, b] = sources;
  if (a === undefined || b === undefined) return [];
  const boundsA = worldSourceBounds(a);
  const boundsB = worldSourceBounds(b);
  if (boundsA === null || boundsB === null) return [];

  const world = {
    minX: Math.min(boundsA.minX, boundsB.minX),
    minY: Math.min(boundsA.minY, boundsB.minY),
    maxX: Math.max(boundsA.maxX, boundsB.maxX),
    maxY: Math.max(boundsA.maxY, boundsB.maxY),
  };
  const topLeft = worldToScreen({ x: world.minX, y: world.maxY }, view);
  const bottomRight = worldToScreen({ x: world.maxX, y: world.minY }, view);
  const x = Math.floor(topLeft.x);
  const y = Math.floor(topLeft.y);
  const width = Math.max(1, Math.ceil(bottomRight.x) - x);
  const height = Math.max(1, Math.ceil(bottomRight.y) - y);

  const canvas = window.document.createElement("canvas");
  canvas.width = Math.ceil(width * pixelRatio);
  canvas.height = Math.ceil(height * pixelRatio);
  const ctx = canvas.getContext("2d");
  if (ctx === null) return [];
  // 世界 → 遮罩画布像素（含 dpr 与视口原点平移），与贴回的图像矩形对齐。
  ctx.setTransform(...overlapMaskTransform(view, x, y, pixelRatio));
  ctx.fillStyle = "#000";
  paintSource(ctx, a);
  ctx.globalCompositeOperation = "source-in";
  paintSource(ctx, b);

  // 填充样式穿遮罩：变换退回画布像素坐标，图案颗粒不随视图缩放。
  ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
  if (entry.fill === "hatch") {
    hatchImage ??= hatchCanvas();
    const pattern = ctx.createPattern(hatchImage, "repeat");
    if (pattern !== null) {
      ctx.fillStyle = pattern;
      ctx.fillRect(0, 0, width, height);
    }
  } else {
    ctx.fillStyle = FILL_SOLID;
    ctx.fillRect(0, 0, width, height);
  }

  return [
    new Konva.Image({
      image: canvas,
      x,
      y,
      width,
      height,
      listening: false,
    }),
  ];
}
