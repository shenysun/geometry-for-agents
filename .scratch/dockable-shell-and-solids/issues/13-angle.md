# 13 — 角图元（angle）

**What to build:** 2D 角图元，契约 `{ id, type: "angle", x, y, startDeg, endDeg, length(>0) }`（`spec-2d-expansion.md`）：顶点为锚点，两条边沿圆族度数惯例（0° 在 +X、逆时针），边长 length（两边等长），弧标总是渲染（半径按 length 比例，渲染细节）。refine 归一化 sweep ∈ (0°,360°)（起止角重合拒绝）。无 fill（笔画族）；无 rotationDeg 字段——旋转手柄直接改写 startDeg/endDeg。复用 `hit.ts` 既有 `sweepDeg`/`normalizeDeg`。

**Blocked by:** 12 — 底/高家族

**Status:** done

- [x] 契约：angleSchema 进判别联合（家族后、circle 前）；sweep 退化拒绝；3D 拒绝；闭合大夹具补齐（角是笔画族，夹具名不改动语义）
- [x] 提交纯函数：translate 改 x/y；rotate 改写 startDeg/endDeg（无 rotationDeg）；scale 乘 length；控制点 = 顶点 + 两边端点
- [x] 命中：笔画命中（两边线段 + 弧标近弧）
- [x] 填充：withFill 不收 angle
- [x] 绘制手势：点击放顶点 → 拖/点两边端点（沿 sweep 先例或拖拽，细节自定）；吃格与 Alt
- [x] 渲染：两条边线 + 弧标（半径按 length 比例）
- [x] 控制点：顶点 + 两边端点
- [x] 选择手势：handleReach、previewFromPrimitive；旋转柄改写两角
- [x] 属性面板 + Prompt SYNTAX + hash 往返 + field.length i18n
- [x] 工具箱 ICONS 与 tool.angle i18n
