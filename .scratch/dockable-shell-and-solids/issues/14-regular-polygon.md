# 14 — 正多边形图元（regularPolygon）

**What to build:** 2D 正多边形，契约 `{ id, type: "regularPolygon", x, y, sides(int ≥5), r(>0 外接圆半径), rotationDeg?, fill }`（`spec-2d-expansion.md`）：锚点 = 中心 = 外接圆心；缺省朝向平底（一条边平行局部 X 且在下方：正五边形房子形、正六边形平底卧放）；refine sides ≥ 5（等边三角形与正方形各有唯一规范表达，ADR 0017）。

**Blocked by:** 13 — 角图元

**Status:** ready-for-agent

- [x] 契约：regularPolygonSchema 进判别联合（angle 后、circle 前）；sides <5 或非整数拒绝；3D 拒绝；闭合大夹具补齐
- [x] 提交纯函数：translate 改 x/y；rotate 写 rotationDeg 归一；scale 乘 r；控制点 = 顶点（拖顶点改 r）
- [x] 命中与面积：pointInPolygon 世界顶点 + closedTypes + area = n/2·r²·sin(2π/n)
- [x] 填充：withFill 收 regularPolygon
- [x] 绘制手势：中心拖半径（沿 circle 先例），sides 缺省 6、面板改；吃格与 Alt；r=0 不提交
- [x] 渲染：世界顶点闭合折线
- [x] 控制点：n 个顶点
- [x] 选择手势：handleReach = r、previewFromPrimitive
- [x] 属性面板 + Prompt SYNTAX + hash 往返 + field.sides/r i18n
- [x] 工具箱 ICONS 与 tool.regularPolygon i18n
