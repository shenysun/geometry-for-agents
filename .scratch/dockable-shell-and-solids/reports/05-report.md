# 05 — 2D 旋转/缩放手柄与椭圆旋转角 实施报告

**Commit:** `2fc778d673a42c12f17d154fcedb6bab522e5bcd`

## 改动文件清单

领地内：

- `src/document/parse-document.ts` + `.test.ts` — 椭圆 `rotationDeg: z.number().default(0)`；旧 JSON 打开为 0；非数字拒绝。
- `src/document/update-document.ts` + `.test.ts` — 新增 `rotatePrimitiveGeometry` / `scalePrimitiveGeometry` / `rotatePrimitive` / `scalePrimitive` / `primitiveAnchor`（柄布局与旋转缩放共用同一锚点）。
- `src/document/prompt.ts` + `.test.ts` — 椭圆语法行写明 `rotationDeg`（optional，默认 0 = 轴对齐，逆时针）。
- `src/document/hash.test.ts` — 椭圆带角往返 + 旧椭圆默认 0 往返。
- `src/viewport2d/select-gesture.ts` + `.test.ts` — `transformHandles` 柄布局；`SelectGestureState` 增 `rotate`/`scale` 两态；`SelectCommit` 演进为 kind 判别联合（translate/rotate/scale）；柄命中优先于本体；单击柄保持选中。
- `src/viewport2d/Viewport2d.vue` — 柄 DOM overlay（`data-rotate-handle` 圆形 alias 光标 / `data-scale-handle` 方形 ew-resize 光标，悬停可区分）；`commitTransform` 三路分派；拖柄期间宿主光标保持柄语义；柄随 wheel/平移/缩放/选中/文档变化重摆，手势中隐藏。

领地外的最小连锁（每处一行级，详见疑虑）：

- `src/viewport2d/draw-gesture.ts` + `.test.ts` — `DrawPreview` 椭圆分支与椭圆 commit 补 `rotationDeg` 字段（schema 必填后的构造点）。
- `src/viewport2d/draw-primitives.ts` — 椭圆正式渲染加 `rotation: -rotationDeg`（世界逆时针 ↔ Konva 屏幕顺时针）；预览椭圆经 spread 携带角度。

## 验收框逐条勾验

- [x] 选中后可见旋转柄与缩放柄；拖动手势预览后一次提交 — 柄由 `transformHandles` 单一真源布局，Viewport 画 DOM 柄；测试断言按下柄入态不提交、整串手势仅 pointerup 一次 commit（`{kind:"rotate"/"scale"}`）。
- [x] 圆缩放保持圆形；椭圆可旋转，`rotationDeg` 进说明书 — 圆缩放只乘 `r`（等比天然成立）；椭圆旋转写 `rotationDeg`（归一化 [0,360)），进 schema、Prompt、hash。
- [x] 无 `rotationDeg` 的旧椭圆 JSON 能打开且角度为 0 — `parse-document.test.ts` 旧椭圆用例；`.default(0)`。
- [x] 扇/弓/弧旋转写入起止角，圆心平移仍由拖本体负责 — `rotatePrimitiveGeometry` 对 sweep 改 `startDeg`/`endDeg`、`cx/cy/r` 不动；平移沿用 04 的拖本体路径未动。
- [x] Prompt 写明椭圆可带旋转角；hash/打开保存往返成功 — SYNTAX 椭圆行含 `rotationDeg`（测试用 `/ellipse:.*rotationDeg/` 锁定）；hash 椭圆往返 `toEqual`，含旧椭圆默认 0。

## 设计要点

- **柄能力制**：圆、环只出缩放柄（旋转对称，拖旋转柄无效果，不出柄以免假反馈）；标签无变换手柄（无尺寸字段）；其余图元两柄齐备。旋转柄在锚点上方、缩放柄在右侧，柄距 = 图元半径 + 4 × 命中半径（屏幕 10px 恒定，随缩放换算）。
- **锚点单一真源**：柄的布放中心与旋转/缩放的数学锚点是同一个 `primitiveAnchor`（折线/多边形取顶点质心，圆族取圆心）。
- **旋转缩放不吃格**：角度与比例没有格语义（格约束的是落点），commit 前预览、pointerup 一次写入，与 04 平移同构；恒等变换（如转回原角）不产生历史步。
- **柄是 DOM overlay**：容器 `pointer-events:none`、只有柄本身可点——点柄不会触发投影器空白平移手势，无需 suppress；悬停光标由柄自身 CSS 提供。

## 测试命令与输出摘要

- `npm run typecheck` — 0 错误（全仓）。
- `npx vitest run src/viewport2d/select-gesture.test.ts src/document` — PASS 108 / FAIL 0。
- `npx vitest run`（全仓）— PASS 209 / FAIL 0。
- 流程为先红后绿：parse 3 用例、update-document 12 用例、prompt 1 用例、select-gesture 17 用例均先确认失败再实现。

## 疑虑

1. **三处领地外一行级连锁**（`draw-gesture.ts`、`draw-gesture.test.ts`、`draw-primitives.ts`）：schema 椭圆加必填 `rotationDeg` 后，所有构造椭圆 Primitive 的位置必须补字段（否则 typecheck 红）；椭圆若不落 Konva `rotation` 则旋转后视觉仍轴对齐，验收框无法满足。均为字段补齐/一行渲染修复，不改行为语义，报告中报备。
2. `SelectCommit` 从 `{id,dx,dy}` 演进为 kind 判别联合，更新了 04 已有的三条 commit 断言（同一测试文件内的形状升级，非行为回退）。
3. 椭圆旋转后 `cx/cy/rx/ry` 不变，Konva 椭圆渲染取 `rotation: -rotationDeg`（屏幕系 Y 向下）。预览与正式渲染走同一 `drawPrimitive` 路径，已核对符号方向。
