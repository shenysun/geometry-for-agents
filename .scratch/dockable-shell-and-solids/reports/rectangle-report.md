# 2D 矩形图元 报告

- 票：2D 矩形图元（参数化一等图元，契约 `{ id, type: "rectangle", x, y, width, height, rotationDeg }`，x/y 为矩形中心，width/height 必须 > 0，rotationDeg 缺省 0，仅 2D 空间合法）
- 提交：`b7f0883925caeaf6eb24902eb3d3e93f1393c873`（`feat: 2D 矩形图元`，24 个文件，+913/−32）
- 验证：`npx tsc --noEmit` 零错误；`npx vitest run` 412/412 全过（基线 380 + 新增 32）；`npm run build` 成功。

## 逐站改动清单

1. **契约**（`src/document/parse-document.ts` + `parse-document.test.ts`）：新增 `rectangleSchema`（strictObject：x/y 中心、width/height positive、rotationDeg `.default(0)`、fill），插入判别联合 polygon 之后；`Primitive2d` 类型与 `twoDTypes` 名单 Set 均由 schema 推导，自动吃新成员，无需手抄。测试：合法解析、缺省 rotationDeg 为 0、非正宽高拒绝、3D 空间拒绝（错误信息含 `type "rectangle" is not allowed in space "3d"`）；并把矩形补进"每个闭合 2D 类型"大夹具。
2. **提交纯函数**（`src/document/update-document.ts` + 测试）：translate 改 x/y（与 label 同组）；rotate 写 rotationDeg 归一化 [0,360)（与 ellipse 同组）；scale 宽高同乘因子（等比）；控制点新增 `corner-0..3` 语义：新增 `rectangleLocalOffset`（世界点逆旋转回局部系，镜像 `ellipseLocalOffset`）与 `CORNER_ID` 正则，拖任一角以中心为不动点改宽高（局部偏移绝对值 ×2，两轴独立，退化尺寸被契约拒绝）。
3. **命中与面积**（`src/document/hit.ts` + 测试）：新增 `inRectangle`（点绕中心反旋转 rotationDeg 到局部系再按半宽半高判定，含边界）；`closedTypes` 加 rectangle；area = width×height 参与重叠小者优先。填充（`src/document/fill.ts` + 测试）：`withFill` 名单加 rectangle。
4. **绘制手势**（`src/viewport2d/draw-gesture.ts` + 测试）：`DRAW_TOOLS`/`DRAG_TOOLS` 加 rectangle（排在 polygon 后）；新增 `rectangleFromDiagonal`（对角→中点中心 + 两轴投影）；`DrawPreview`/`DrawGestureState` 加 rectangle 成员；start/move/up 全链路：拖对角线预览、pointerup 一次 commit（零宽/零高不提交）、起点终点吃当前格、grid off（Alt 不落格）保留原始点、esc 取消。
5. **渲染**（`src/viewport2d/draw-primitives.ts`）：`drawPrimitive` 加 Konva.Rect 分支——中心定位（offsetX/Y 半宽半高）、`rotation: -primitive.rotationDeg`（世界逆时针 vs Konva 屏幕顺时针，沿椭圆先例）、fillConfig 接填充；`previewPrimitive` 退化矩形返回 null（不出虚线）；`previewGuidePoints` 矩形出中心参考点。
6. **控制点**（`src/viewport2d/control-points.ts` + 测试）：`ControlPointKind` 加 "corner"；矩形返回四角目录（局部逆时针 corner-0..3，经既有 `rotateOffset` 随 rotationDeg 旋到世界）；中心不进目录（平移走拖本体）。
7. **选择手势**（`src/viewport2d/select-gesture.ts` + 测试）：`handleReach` 矩形取半对角线 `hypot(width/2, height/2)`（柄布放半径）；`previewFromPrimitive` 加 rectangle 预览（携带 x/y/width/height/rotationDeg）；命中/拖角提交走既有 hitTest + moveControlPoint 架构自动适用；矩形非旋转对称，旋转/缩放两柄齐备（既有判定自动覆盖）。配套 `src/viewport2d/Viewport2d.vue`：pointerup 的拖拽手势 kind 名单补 `"rectangle"`（一行，让工具真正端到端提交）。
8. **属性面板**（`src/components/PropertiesPanel.vue`）：新增矩形字段编辑（x/y/width/height/rotationDeg）；抽通用 `commitNumericField`（非数字/非正尺寸不写说明书、输入框回退当前值），参数体与矩形两条路径共用；`numericFieldOf` 泛化为 `Primitive`，删除单一用途的 `withNumericField`。填充开关对矩形自动出现（`"fill" in primitive`）。
9. **Prompt**（`src/document/prompt.ts` + 测试）：SYNTAX 加一行 `rectangle: x, y (center), width (X), height (Y), rotationDeg (optional, defaults to 0 = axis-aligned; counterclockwise), fill`（沿椭圆写法）；同一说明书两次生成相等。
10. **hash 往返**（`src/document/hash.test.ts`）：补带 rotationDeg/fill 的矩形 lz-string 往返 + 重新 parse 相等。
11. **工具箱与 i18n**（`src/components/toolbox.ts` + 测试、`src/i18n/messages.ts`、`src/i18n/locale.test.ts`）：ICONS 加矩形内联 SVG（`M3 4.5h10v7H3z`）；2D 名单 = select + DRAW_TOOLS 自动含 rectangle（跟在 polygon 后）；文案 zh「矩形」/en「Rectangle」；新增 `field.rotationDeg`（旋转（度）/Rotation (deg)），双语断言进 locale 测试。

## 测试摘要

- 新增 32 例（parse 4、update 8、hit 3、fill 1、draw-gesture 6、control-points 2、select-gesture 4、prompt 1、hash 1、toolbox 1、locale 1），全部先红后绿。
- 全量：29 个测试文件 412/412 通过（基线 380）。
- 类型：`npx tsc --noEmit` 零错误；`npm run build` 成功（chunk 体积告警为既有 konva+three 打包现状，与本特性无关）。

## 疑虑

- `Viewport2d.vue` 的 pointerup 拖拽手势名单原本硬编码四种 kind，我补了 `"rectangle"` 一行。这个名单与 `isDragDrawTool` 语义重复，未来加拖拽工具还得改两处；可考虑后续收敛为一个谓词（本次未动，避免越界重构）。
- 矩形控制点只露四角不露中心（圆/椭圆露圆心）：拖中心平移与拖本体平移语义重合，故按票面只做四角；若交互上想与圆族完全一致可再补 "center"。
- 旋转 90° 等角度下局部系换算存在 1e-15 量级浮点ε（cos(π/2) ≠ 0），实现不做舍入，相关测试用 `expectCloseTo` 断言；契约层不受影响。
- `field.width` zh 文案「长 (X)」与 3D 长方体共用，矩形语境下读作「X 向边长」，未另拆键。
