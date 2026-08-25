# 2D 尺寸标注线图元 报告

- 票：15 — 尺寸标注线（契约见 `spec-2d-expansion.md`：`{ id, type: "dimension", points: [{x,y},{x,y}] }` 定长二元组沿 line 结构；refine 两点不重合；显示数字 = 两点距离的推导值——无 text 字段、无单位；笔画族无 fill；无锚点，平移/旋转/缩放沿 line 先例整体作用于两点；控制点 = 两端点）
- 提交：`dc5ffbe`（`feat: 2D 尺寸标注线图元`，21 个文件，+577/−44）
- 验证：`npx tsc --noEmit` 零错误；`npx vitest run` 536/536 全过（票 14 后基线 517 + 新增 19）；`npm run build` 成功。

## 逐站改动清单

1. **契约**（`src/document/parse-document.ts` + 测试）：`dimensionSchema`（strictObject、`points: z.tuple([point2Schema, point2Schema])` 定长二元组、refine 两点不重合），插入判别联合 dimension 在 angle 后、circle 前；2D 大夹具补齐。测试：合法解析、重合拒绝、一元/三元组拒绝、fill 拒绝（strictObject 自动）、3D 拒绝。
2. **提交纯函数**（`src/document/update-document.ts` + 测试）：translate/rotate/scale 沿 line 先例——两点整体平移、绕中点（质心）旋转、朝中点收放（tuple 显式重建保持类型）；锚点 = 中点；控制点 `vertex-0/1` 只动一个端点，拖到另一端（两点重合）被契约拒绝。
3. **命中与面积**（`src/document/hit.ts` + 测试）：主段 `nearPolyline` 笔画命中（箭头与数字是渲染细节不参与命中）；非闭合，area ∞。
4. **填充**（`src/document/fill.ts` + 测试）：`withFill` 不收 dimension（default 分支），补确认测试。
5. **绘制手势**（`src/viewport2d/draw-gesture.ts` + 测试）：`DRAW_TOOLS`/`DRAG_TOOLS` 加 dimension（angle 后、circle 前）；复用 line 手势 kind（对角拖拽），提交时按工具分流产出 `type: "dimension"`；预览复用线段虚线（箭头数字是提交后的渲染细节）；两端吃格重合不提交；Alt 关格；esc 取消；Viewport2d pointerup 名单复用既有 `"line"` kind，零改动。
6. **渲染**（`src/viewport2d/draw-primitives.ts`）：主线 + 两端 8px 箭头（150° 回摆翼，屏幕像素定长）+ 中点上方居中数字——`dimensionLabel` = 两点距离 toFixed(2) 去尾零（`Number()` 后 `String`，5 → "5"、4.2426 → "4.24"）；`Konva.Text` 构造后 `offsetX(width/2)` 居中；选中虚线标记走 `previewPrimitive` 的 dimension 分支。
7. **控制点**（`src/viewport2d/control-points.ts` + 测试）：两端点 `vertex-0/1`（kind vertex），与 line 完全同构。
8. **选择手势**（`src/viewport2d/select-gesture.ts` + 测试）：`handleReach` 沿 line（端点到中点最大距离）；`previewFromPrimitive` 携带两点；`DrawPreview` 加 dimension 分支。
9. **Prompt**（`src/document/prompt.ts` + 测试）：SYNTAX 加一行 `dimension: exactly 2 {x,y} points (must not coincide); the displayed number is the derived distance between them (no text field, no unit)`。
10. **hash 往返**（`src/document/hash.test.ts`）：斜向标注线 lz-string 往返 + 重新 parse 相等。
11. **属性面板**：无改动——dimension 沿 line 先例没有数字字段（几何就是两个端点，编辑走控制点拖动）。
12. **工具箱与 i18n**（`src/components/toolbox.ts` + 测试、`src/i18n/messages.ts`、`src/i18n/locale.test.ts`）：ICONS 加标注线符号（双向箭头 + 数字框）内联 SVG；zh「标注线」/en「Dimension line」双语断言。
13. **顺序修正**：本票发现前两票把 regularPolygon 排在了 angle 之前，与规格 `DRAW_TOOLS` 顺序（…regularPolygon、angle、dimension、circle…）不符——`DRAW_TOOLS`、判别联合与 2D 大夹具顺序一并调正；同时把 toolbox.test 里跨票累积的四段邻接断言收敛为一条完整顺序快照断言（加新工具只改一处，票 14 报告疑虑的落地）。

## 测试摘要

- 新增 19 例（parse 5、update 6、hit 1、fill 1、draw-gesture 3、control-points 1、select-gesture 1、prompt 1、hash 1、locale 1…toolbox 顺序断言为收敛替换非纯新增），全部先红后绿。
- 全量：536/536 通过（基线 517）。
- 类型：`npx tsc --noEmit` 零错误；`npm run build` 成功（chunk 告警为既有现状）。

## 渲染细节（规格授权自定部分的取值）

- 箭头：屏幕 8px、150° 回摆双翼，两端向内。
- 数字：中点上方 16px、12px 字号居中；精度两位小数去尾零，无单位。
- 手势预览只画虚线段：箭头与数字在松手提交后出现。

## 疑虑

- 标注线数字目前水平放置（不沿线段方向旋转）；斜线的可读性在水平数字下最好，若要沿线排布可后续在渲染层加旋转变换（几何不受影响）。
- 命中只认主段：箭头翼与数字不参与命中（数字非几何，箭头是装饰），与"笔画族按主笔画命中"的语义一致。
- 票 2/3 报告所述"插入判别联合在 angle/regularPolygon 之后"的历史顺序与本票的顺序修正有出入——以本票的最终顺序（regularPolygon、angle、dimension）为准，规格原文如此。
