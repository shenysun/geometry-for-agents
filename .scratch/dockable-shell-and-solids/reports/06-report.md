# 06 — 2D 控制点与命中顺序 实施报告

**Commit:** `39445a9 feat: 2D 控制点与命中顺序`

## 改动文件清单

| 文件 | 改动 |
| --- | --- |
| `src/viewport2d/control-points.ts` | 新建。控制点目录纯函数 `controlPoints(primitive)`：折线/多边形逐顶点（`vertex-N`）、圆（圆心+半径点）、环（圆心+内外半径点）、椭圆（圆心+两半轴点，随 `rotationDeg` 旋转）、扇/弓/弧（圆心+半径点+起止角点）、标签无控制点。控制点 `id` 即说明书字段名（顶点带下标），目录顺序即命中并列时的优先级。 |
| `src/viewport2d/control-points.test.ts` | 新建。各类型目录断言（含带 `rotationDeg: 90` 的椭圆半轴点位置）。 |
| `src/document/update-document.ts` | 新增 `moveControlPointGeometry(primitive, pointId, world)`（只改那一处几何，不可变，未知 id 恒等）与 `moveControlPoint(document, id, pointId, world, grid)`（目标点先吸附到格，复用 `transformPrimitive` 骨架：space 检查、missingId、恒等不写、Zod 契约拒绝非法几何如 r=0、rInner≥rOuter）。 |
| `src/document/update-document.test.ts` | 新增 `moveControlPointGeometry` / `moveControlPoint` 两个 describe：端点只改该端点、半径点只改半径（圆心/起止角不动）、起止角点只改角度并归一化、椭圆半轴沿局部轴度量、环内外半径各改各的、吸附、不可变、契约拒绝、恒等、缺 id、3D 拒绝。 |
| `src/viewport2d/select-gesture.ts` | 手势状态机加 `{ kind: "control" }` 与 commit `controlPoint`；`SelectContext` 加 `controlTolerance`；命中顺序改为控制点 → 柄 → 本体（`startSelect` / `clickSelect`）；`moveSelect` 出吸附后预览、`upSelect` 一次提交（拖回原格不提交）。 |
| `src/viewport2d/select-gesture.test.ts` | 新增两个 describe：命中顺序（同位置控制点赢柄、控制点赢本体、柄仍赢本体、未选中/零容差不干扰、单击控制点保持选中）与拖控制点（半径只改半径、端点只改该端点、起止角只改角度、圆心只挪圆心、整串手势一次 commit、原位不提交、Esc、图元被删回 idle）。 |
| `src/viewport2d/Viewport2d.vue` | 控制点 overlay（8px 小圆、`data-control-point`、cursor `move`），与柄同一层；`selectContext` 传 `controlTolerance`；`commitTransform` 加 `controlPoint` 分支调 `moveControlPoint`；`refreshHandles` 改名 `refreshOverlays` 同刷柄与控制点；拖控制点期间 host 光标 `move`；平移抑制从「仅拖本体」放宽为「任一选择手势」（修掉柄/控制点命中圈边缘落在画布上时触发视口平移的漏斗）。 |

## 验收框逐条勾验

- [x] 各 2D 类型在选中后露出对应控制点，拖动预览后一次提交 —— 目录覆盖全部 2D 类型（标签除外，无几何控制点）；`moveSelect` 只出预览、`upSelect` 一次 `controlPoint` commit（select-gesture 测试「整串手势只有这一次 commit」）。
- [x] 拖半径只改半径，不会变成整圆非等比缩放 —— `moveControlPointGeometry` 的 `radius` 分支只写 `r`，测试断言 `cx/cy/startDeg/endDeg` 原样（update-document「拖半径点只改半径」）。
- [x] 命中顺序：控制点 → 旋转/缩放柄 → 本体 —— `startSelect` 依序探测；测试「同一位置同时命中控制点与缩放柄时控制点赢」+ 既有「柄赢本体」。
- [x] 悬停控制点、柄、本体时光标可区分 —— 控制点 `move` / 柄 `alias`·`ew-resize` / 本体 `grab`；拖动期间 host 光标跟随控件语义。
- [x] 属性面板数字与控制点写入同一份说明书 —— `moveControlPoint` 与属性面板同样走 `documentStore` 的说明书更新，控制点 `id` 即属性面板所编字段名；未改属性面板（票面要求共存即可）。

## 测试命令与输出摘要

```
npx tsc --noEmit
  → TypeScript compilation completed（零错误）

npx vitest run src/viewport2d src/document
  → Test Files 16 passed (16)
  → Tests 199 passed (199)
```

TDD 顺序：先写 control-points / update-document / select-gesture 三处红测试（`moveControlPointGeometry is not a function`），再实现转绿。

## 疑虑

1. **扇/弓/弧在 `startDeg = 0` 时半径点与起始角点重合**：命中并列时按目录顺序取先列出者（半径点赢），拖它改半径。几何上无法避免（两个点真在同一位置），属已知折衷。
2. **椭圆半轴点拖过圆心**：按局部轴度量的绝对值收边（`Math.abs`），半轴长度保持非负；恰好拖到圆心时 `rx/ry = 0` 由契约拒绝、不写说明书。
3. **平移抑制条件放宽**（`drag` → 任意选择手势）是行为收紧：修掉 rotate/scale 命中圈边缘落在画布上会同时平移视口的既有漏斗，与本票控制点需求同源。若不希望搭车，可回退为只对 `drag`/`control` 抑制。
