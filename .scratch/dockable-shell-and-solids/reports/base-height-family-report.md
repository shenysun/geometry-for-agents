# 2D 底/高家族图元 报告

- 票：12 — 三角形、平行四边形、梯形 + 正方形工具（契约见 `spec-2d-expansion.md`：三角 `{ x, y, width, height, apexOffset, rotationDeg?, fill }`、平四 `{ …, skew }` refine `skew ≠ 0`、梯 `{ …, topWidth, topOffset }` refine `topWidth ≠ width`；锚点都是底边中点，底沿局部 X、高沿局部 +Y，旋转绕锚点。正方形只加 `tool.square`，提交 `rectangle`（width=height），schema 不动）
- 提交：`ed101c8`（`feat: 2D 三角形平行四边形梯形图元与正方形工具`，26 个文件，+1808/−21）
- 验证：`npx tsc --noEmit` 零错误；`npx vitest run` 459/459 全过（基线 412 + 新增 47）；`npm run build` 成功。

## 逐站改动清单

1. **契约**（`src/document/parse-document.ts` + 测试）：新增 `triangleSchema`、`parallelogramSchema`（`.refine` 拒绝 `skew = 0`）、`trapezoidSchema`（`.refine` 拒绝 `topWidth = width`），均 strictObject、`rotationDeg .default(0)`；插入判别联合 rectangle 后、circle 前；`Primitive2d`/`twoDTypes` 由 schema 推导自动生效；"每个闭合 2D 类型"大夹具补齐三个类型。测试：合法解析、缺省旋转 0、非正尺寸拒绝、refine 拒绝（平四→矩形、梯→平四方言）、3D 空间拒绝。
2. **共享几何模块**（新增 `src/document/base-height-family.ts` + 测试）：`BaseHeightShape` 类型 + 局部顶点（三角 3、平四/梯 4，逆时针、底边在局部 y=0）+ `baseHeightWorldVertex`（局部偏移旋到世界）/ `baseHeightWorldVertices`（顶点目录）/ `baseHeightLocalOffset`（世界点逆旋转回锚点原点）。命中、渲染、控制点、提交四模块消费同一几何源，不再各写一份旋转换算。
3. **提交纯函数**（`src/document/update-document.ts` + 测试）：translate 改 x/y；rotate 写 rotationDeg 归一 [0,360)；scale 全部长度字段同乘（含 apexOffset/skew/topWidth/topOffset，保持相似形）；控制点 corner-0..n 语义——底角以底边中点为不动点对称改底宽（width = 2|局部x|），三角顶点写 apexOffset+height，平四上角写 skew（局部x∓半底）+height，梯形上角对称改 topWidth（2|局部x−topOffset|）+height；越界 corner id（如三角的 corner-3）恒等。拖出的退化取值（高 0、skew 0、上下底等长）被契约拒绝不进说明书。
4. **命中与面积**（`src/document/hit.ts` + 测试）：家族顶点已随 rotationDeg 旋到世界，直接复用 `pointInPolygon`（判定与坐标系无关，省掉局部系换算）；`closedTypes` 加三类型；area：三角 wh/2、平四 wh、梯 (w+tw)/2·h，参与重叠小者优先。
5. **填充**（`src/document/fill.ts` + 测试）：`withFill` 名单加三类型。
6. **绘制手势**（`src/viewport2d/draw-gesture.ts` + 测试）：`DRAW_TOOLS` 在 rectangle 后加 `square`、家族三工具（circle 前）；`DRAG_TOOLS` 同步；新增 `box` 手势 kind（携带 tool）与 `squareFromDiagonal`（主轴长度为边长、方向沿拖拽象限、零轴分量默认正向）、`familyFromBox`（底边取包围盒下边、等腰缺省：三角 apexOffset 0、平四 skew=height（45° 斜边，天然非零）、梯 topWidth=width/2 且 topOffset 0）；起点终点吃格、Alt 关格保留原始点、零宽/零高松手不提交、esc 取消。
7. **渲染**（`src/viewport2d/draw-primitives.ts`）：家族分支用世界顶点闭合折线（`strokeLine closed + fill`），不引入 Konva rotation；预览退化（非正尺寸）返回 null，平四 skew 过零的预览照常显示（ADR 0007 预览态可退化）；`previewGuidePoints` 家族出锚点参考点。
8. **控制点**（`src/viewport2d/control-points.ts` + 测试）：顶点目录直接 `baseHeightWorldVertices` 映射 `corner-i`；锚点（底边中点）不进目录，平移走拖本体。
9. **选择手势**（`src/viewport2d/select-gesture.ts` + 测试、`src/viewport2d/Viewport2d.vue`）：`handleReach` 取顶点到锚点最大距离；`previewFromPrimitive` 携带家族全部字段；旋转/缩放柄经既有 `rotatable` 判定自动齐备；Viewport2d.vue pointerup 拖拽 kind 名单补 `"box"` 一行（与 `isDragDrawTool` 的两处名单照旧，未收敛——沿矩形票疑虑 #1 的既定决定）。
10. **属性面板**（`src/components/PropertiesPanel.vue`）：把矩形字段目录泛化为 `planarFields(type)`（x/y、width/height、家族偏移字段、rotationDeg），矩形与家族共用同一条 `commitNumericField` 路径；填充开关自动出现。
11. **Prompt**（`src/document/prompt.ts` + 测试）：SYNTAX 加三行，写明底边中点锚点与家族字段（沿椭圆/矩形写法）；同一说明书两次生成相等。
12. **hash 往返**（`src/document/hash.test.ts`）：三类型带 rotationDeg/fill 的 lz-string 往返 + 重新 parse 相等（`hash.ts` 通用压缩无需改动）。
13. **工具箱与 i18n**（`src/components/toolbox.ts` + 测试、`src/i18n/messages.ts`、`src/i18n/locale.test.ts`）：ICONS 加 square（7×7 方）、triangle、parallelogram、trapezoid 内联 SVG；2D 名单 = select + DRAW_TOOLS 自动含新工具；文案 zh「正方形/三角形/平行四边形/梯形」en「Square/Triangle/Parallelogram/Trapezoid」；新增 `field.apexOffset`（顶点偏移/Apex offset）、`field.skew`（斜移/Skew）、`field.topWidth`（上底/Top base）、`field.topOffset`（上底偏移/Top offset），双语断言进 locale 测试。

## 测试摘要

- 新增 47 例（parse 5、base-height-family 6、update 13、hit 3、fill 1、draw-gesture 10、control-points 3、select-gesture 2、prompt 1、hash 1、toolbox 1、locale 1），全部先红后绿。
- 全量：30 个测试文件 459/459 通过（基线 412）。
- 类型：`npx tsc --noEmit` 零错误；`npm run build` 成功（chunk 体积告警为既有 konva+three 打包现状，与本特性无关）。

## 手势细节（规格授权自定部分的取值）

- 平四 `skew = height`：拖出的斜边恒 45°，提交值天然非零，规格要求的"平四 skew 近零钳非零"由该取值自动满足。
- 梯形 `topWidth = width / 2`、`topOffset = 0`：等腰、上底一半，`topWidth > 0` 且 `≠ width` 自动成立。
- 三角 `apexOffset = 0`：等腰缺省，直角/任意三角靠拖顶点控制点或属性面板改。
- 正方形：边长取拖拽主轴分量，起点为一角，方向沿拖拽象限（某轴分量为零时该轴默认正向），纯水平/垂直拖也能出正方形。

## 疑虑

- `Viewport2d.vue` pointerup 名单与 `isDragDrawTool` 仍是两处名单（本次只加 `"box"` 一行，按矩形票疑虑 #1 的既定决定未收敛）。
- 梯形上角控制点语义是"上底以中点对称伸缩"（topOffset 不动），平移上底位置需走属性面板的 topOffset 字段；若交互上想直接拖上底中点，可后续加一个不进规格的控制点（本次未做，保持四角语义与票面一致）。
- 平四手势 `skew = height` 在高很大时形状会明显溢出拖拽 box 右侧——手势 box 是参考框不是包围盒约束，预览可见，操作员松手前可纠正。
- PropertiesPanel 把 `RECTANGLE_FIELDS` 泛化为 `planarFields` 是同文件内的目录重组，矩形面板行为不变（字段集合一致）。
