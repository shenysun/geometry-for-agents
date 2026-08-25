# 15 — 尺寸标注线（dimension）

**What to build:** 2D 尺寸标注线，契约 `{ id, type: "dimension", points: [{x,y},{x,y}] }`（`spec-2d-expansion.md`）：定长二元组沿 line 结构；refine 两点不重合；显示数字 = 两点距离的推导值（无 text 字段、无单位）；笔画族无 fill；无锚点——平移/旋转/缩放沿 line 先例整体作用于两点；控制点 = 两端点。渲染：箭头 + 居中数字（精度去尾零）。

**Blocked by:** 14 — 正多边形

**Status:** done

- [x] 契约：dimensionSchema（定长二元组）进判别联合；两点重合拒绝；3D 拒绝；大夹具补齐
- [x] 提交纯函数：translate/rotate/scale 沿 line 先例作用于两点；控制点 = 两端点
- [x] 命中：主段笔画命中；非闭合（面积 ∞）
- [x] 填充：withFill 不收 dimension
- [x] 绘制手势：拖拽沿 line 手势（复用 line kind），两端重合不提交；吃格与 Alt
- [x] 渲染：主线 + 两端箭头 + 居中数字（距离，去尾零）
- [x] 控制点：两端点
- [x] 选择手势：handleReach/preview 沿 line；Viewport2d pointerup 名单复用 line kind
- [x] Prompt SYNTAX + hash 往返
- [x] 工具箱 ICONS 与 tool.dimension i18n；修正 DRAW_TOOLS 顺序为规格的 regularPolygon、angle、dimension
