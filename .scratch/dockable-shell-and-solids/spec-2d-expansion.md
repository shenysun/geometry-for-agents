# 2D 图元扩容规格（交接文档）

设计已全部拍板并记录在案：`CONTEXT.md`（词汇表，六词条已立）、`docs/adr/0017-parametric-shapes-canonical-form.md`（一形一表决定）、`docs/todo.md`（名单）。实现模式照抄上一票 `.scratch/dockable-shell-and-solids/reports/rectangle-report.md`。开工前先读完这四份。

## 总原则（ADR 0017，不可违背）

- **一形一表**：参数形之间互不重叠，用 refine 排除与更基本类型同形的退化取值；与 polygon 的重叠不禁（它是任意形状的逃逸通道）。
- **特例不设类型**：等腰/直角/等边/菱形/正方形/等腰梯形/直角梯形都是参数取值或工具约束。
- **底/高家族锚点 = 底边中点**（梯形为下底中点），沿 3D 站立体底面中心先例；**旋转一律绕锚点**。
- **数字不进契约**：角的度数、标注线距离是几何推导值。
- 说明书字段名永远英文；界面中英 i18n（zh/en）。
- 手势预览态可出现退化取值，只在松手提交时钳制/拒绝（ADR 0007 预览后提交）。

## 契约（已拍板，禁止重新设计；strictObject，`rotationDeg` 用 `.default(0)` 沿椭圆/矩形先例）

```
triangle:       { id, type: "triangle", x, y, width(>0), height(>0), apexOffset, rotationDeg?, fill }
                // x,y 底边中点；width 底沿局部 X；height 高沿局部 +Y；apexOffset 顶点相对底边中点的 X 偏移（0=等腰；任意实数，可出下底跨度）
parallelogram:  { id, type: "parallelogram", x, y, width(>0), height(>0), skew, rotationDeg?, fill }
                // x,y 底边中点；skew 上底相对下底沿局部 X 的平移；refine skew ≠ 0
trapezoid:      { id, type: "trapezoid", x, y, width(>0), topWidth(>0), height(>0), topOffset, rotationDeg?, fill }
                // x,y 下底中点；topOffset 上底中点相对下底中点的 X 偏移（0=等腰）；refine topWidth ≠ width（topWidth>0 已排三角退化）
regularPolygon: { id, type: "regularPolygon", x, y, sides(int ≥5), r(>0 外接圆半径), rotationDeg?, fill }
                // x,y 中心=外接圆心；缺省朝向平底：一条边平行局部 X 且在下方（正五边形呈房子形、正六边形平底卧放）
angle:          { id, type: "angle", x, y, startDeg, endDeg, length(>0) }
                // x,y 顶点；两角沿圆族惯例（0° 在 +X、逆时针、sweepDeg 归一）；refine 归一化 sweep ∈ (0°,360°)
                // 无 fill（笔画族）；无 rotationDeg 字段——旋转手柄直接改写 startDeg/endDeg；弧标总是渲染（半径按 length 比例，渲染细节）
dimension:      { id, type: "dimension", points: [{x,y},{x,y}] }
                // 定长二元组沿 line 结构；refine 两点不重合；显示数字=两点距离的推导值（无 text 字段、无单位）
                // 笔画族无 fill；无锚点，平移/旋转/缩放沿 line 先例整体作用于两点；控制点=两端点
```

字段注释里的 `rotationDeg?` 表示 `.default(0)`：写进 schema 后说明书里可省略。

**正方形**：只加工具按钮（`tool.square`，i18n 正方形/Square），拖拽约束等宽高（取主轴长度），提交的是 `rectangle`（width=height），schema 不动。

## 每票十站清单（沿矩形票，逐站先写测试再实现）

1. **契约**（`parse-document.ts`）：新 schema 插入判别联合（家族排在 rectangle 后、circle 前）；`Primitive2d`/`twoDTypes` 由 schema 推导自动生效；3D 空间拒绝、refine 拒绝、"每个闭合 2D 类型"大夹具补齐。
2. **提交纯函数**（`update-document.ts`）：translate 改 x/y；rotate 写 rotationDeg 归一 [0,360)（angle 改写两角；dimension 旋转两点）；scale 尺寸同乘（等比）；控制点语义（三角 corner-0..2 三顶点、平四/梯四角、正多边形顶点、角=顶点+两边端点、标注线两端点）。
3. **命中与面积**（`hit.ts`）：闭合形（三角/平四/梯/正多边形）局部系反旋转判定 + `closedTypes` + area 参与重叠小者优先；角/标注线按笔画命中。
4. **填充**（`fill.ts`）：`withFill` 只收闭合形。
5. **绘制手势**（`draw-gesture.ts`）：`DRAW_TOOLS` 顺序 line、polygon、rectangle、**triangle、parallelogram、trapezoid、regularPolygon、angle、dimension**、circle…；拖拽手势细节自定但必须吃格（1 / 1/2）与 Alt 关格；零尺寸/退化取值松手不提交（平四 skew 近零钳非零）。
6. **渲染**（`draw-primitives.ts`）：Konva 分支；`rotation: -rotationDeg` 沿先例；angle 的弧标、dimension 的箭头 + 居中数字（精度去尾零，渲染细节）。
7. **控制点**（`control-points.ts`）：`rotateOffset` 随 rotationDeg 旋到世界；中心/底中点不进目录（平移走拖本体）。
8. **选择手势**（`select-gesture.ts` + `Viewport2d.vue`）：handleReach、previewFromPrimitive；`Viewport2d.vue` pointerup 的拖拽 kind 名单记得补（矩形票疑虑 #1：与 isDragDrawTool 两处名单，加齐不收敛）。
9. **属性面板 + Prompt + hash**（`PropertiesPanel.vue` 沿 `commitNumericField`；新 field.* i18n 键 apexOffset 顶点偏移 / topWidth 上底 / topOffset 上底偏移 / skew 斜移 / sides 边数 / length 边长 等，zh/en 断言进 locale.test；`prompt.ts` SYNTAX 每类型一行沿椭圆/矩形写法；`hash.test.ts` 补往返夹具）。
10. **工具箱与 i18n**（`toolbox.ts` ICONS 内联 SVG 16×16 描边照现有风格 + `i18n/messages.ts`）。

## 票切分与顺序（每票独立提交 + 报告）

1. **底/高家族票**：triangle + parallelogram + trapezoid + 正方形工具（骨架共用，一张票）
2. **角票**（复用 `hit.ts` 既有 `sweepDeg`/`normalizeDeg`）
3. **正多边形票**
4. **标注线票**（最小，抄 line）

每票流程：`.scratch/dockable-shell-and-solids/issues/` 建票（沿现有票格式编号续）→ TDD 先红后绿 → `npx tsc --noEmit` 零错误 → `npx vitest run` 全过（当前基线 412）→ `npm run build` 成功 → conventional commit（中文，如 `feat: 2D 三角形平行四边形梯形图元`）→ `reports/` 写报告（沿 rectangle-report.md 格式：逐站清单 + 测试摘要 + 疑虑）。

## 边界

- 不做越界重构；不改已定契约——发现契约自相矛盾就停下来问，不要自作主张。
- 周角（360°）不进角契约（用圆 + 两条线拼）；半圆、菱形不设类型。
- 新类型仅 2D 空间合法（`spaceMismatchError` 自动覆盖，补测试即可）。
