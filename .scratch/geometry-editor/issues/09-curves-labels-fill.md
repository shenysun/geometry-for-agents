# 09 — 2D 圆族、点名、填充

**What to build:** 操作员能画圆、扇形、弓形、弧、圆环、轴对齐椭圆，能放点名，能给封闭图元设无填充/实心/阴影。行为与 08 相同：预览后提交。

**Blocked by:** 08 — 2D 画线与多边形

**Status:** ready-for-agent

- [ ] `circle` / `sector` / `bow` / `arc` / `ring` / `ellipse` 均可绘制并进入说明书
- [ ] `label` 可放到格点上，文本如 A、B、C
- [ ] 封闭图元支持 `fill: none | solid | hatch`；`line` / `arc` / `label` 无填充
- [ ] 导出 Prompt（若 11 未就绪则至少模块函数）含这些图元
