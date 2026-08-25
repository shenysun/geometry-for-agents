# 12 — 底/高家族：三角形、平行四边形、梯形与正方形工具

**What to build:** 2D 参数化图元三角/平四/梯形（契约见 `spec-2d-expansion.md`，ADR 0017 一形一表：平四 `skew ≠ 0`、梯形 `topWidth > 0` 且 `≠ width`）。锚点都是底边中点（梯形为下底中点），底沿局部 X、高沿局部 +Y，旋转绕锚点。正方形只加工具按钮 `tool.square`，拖拽约束等宽高（取主轴长度），提交 `rectangle`（width=height），schema 不动。十站清单照矩形票（`reports/rectangle-report.md`）。

**Blocked by:** 矩形票（已合入 `b7f0883`）

**Status:** ready-for-agent

- [x] 契约：triangle/parallelogram/trapezoid schema 进判别联合（rectangle 后、circle 前）；3D 拒绝；refine 拒绝；闭合大夹具补齐
- [x] 提交纯函数：translate 改 x/y；rotate 写 rotationDeg 归一；scale 尺寸同乘（含 apexOffset/skew/topWidth/topOffset）；控制点 corner-0..n 语义
- [x] 命中与面积：闭合形判定 + closedTypes + area 参与重叠小者优先
- [x] 填充：withFill 收三个新类型
- [x] 绘制手势：拖 box 画（平四 skew=height 45° 斜边、梯形 topWidth=width/2 等腰、三角 apexOffset=0）；吃格与 Alt 关格；零尺寸不提交
- [x] 渲染：Konva 世界顶点折线闭合分支
- [x] 控制点：顶点目录（三角 3、平四/梯 4），rotateOffset 旋到世界；锚点不进目录
- [x] 选择手势：handleReach、previewFromPrimitive；Viewport2d.vue pointerup 名单补齐
- [x] 属性面板 + Prompt SYNTAX + hash 往返 + field.* i18n（apexOffset/topWidth/topOffset/skew）
- [x] 工具箱 ICONS（square/triangle/parallelogram/trapezoid）与 tool.* i18n
