# 2D 正多边形图元 报告

- 票：14 — 正多边形（契约见 `spec-2d-expansion.md`：`{ id, type: "regularPolygon", x, y, sides(int ≥5), r(>0 外接圆半径), rotationDeg?, fill }`，锚点 = 中心 = 外接圆心；缺省朝向平底——一条边平行局部 X 且在下方（正五边形房子形、正六边形平底卧放）；sides ≥ 5 是 ADR 0017 一形一表：等边三角形与正方形各有唯一规范表达）
- 提交：`bc84bad`（`feat: 2D 正多边形图元`，26 个文件，+771/−12）
- 验证：`npx tsc --noEmit` 零错误；`npx vitest run` 517/517 全过（票 13 后基线 489 + 新增 28）；`npm run build` 成功。

## 逐站改动清单

1. **契约**（`src/document/parse-document.ts` + 测试）：`regularPolygonSchema`（strictObject、`sides: z.number().int().min(5)`、`r` positive、`rotationDeg .default(0)`），插入判别联合 angle 后、circle 前；2D 大夹具补齐。测试：合法解析、缺省旋转 0、sides 2/3/4/5.5 拒绝、非正半径拒绝、3D 拒绝。
2. **共享几何模块**（新增 `src/document/regular-polygon.ts` + 测试）：`RegularPolygonPrimitive` 类型；`regularPolygonLocalVertices`——第 k 个顶点在 `-90° + 180°/n + k·360°/n`（偏移 180°/n 让一条边而非一个顶点落在正下方，即平底朝向），顶点逆时针；`regularPolygonWorldVertices`——局部顶点随 rotationDeg 绕中心旋到世界。测试断言六边形平底卧放（底边 v0/v5 同高 y=-√3）与五边形房子形（尖在 90°）。
3. **提交纯函数**（`src/document/update-document.ts` + 测试）：translate 改 x/y；rotate 写 rotationDeg 归一（与椭圆/矩形/家族同组）；scale 只乘 r；锚点 = 中心。控制点 `vertex-k`：拖顶点只改 r（到中心距离），sides/rotationDeg 不动——旋转朝向走旋转柄。越界 vertex id（≥ sides）恒等；拖到中心（r=0）被契约拒绝。
4. **命中与面积**（`src/document/hit.ts` + 测试）：世界顶点 `pointInPolygon`（与家族同一路径）；`closedTypes` 加 regularPolygon；area = n/2·r²·sin(2π/n) 参与重叠小者优先。
5. **填充**（`src/document/fill.ts` + 测试）：`withFill` 名单加 regularPolygon。
6. **绘制手势**（`src/viewport2d/draw-gesture.ts` + 测试）：`DRAW_TOOLS`/`DRAG_TOOLS` 加 regularPolygon（angle 后、circle 前）；沿 circle 先例中心拖半径，提交 `{ x, y, sides: 6, r, rotationDeg: 0, fill: "none" }`——边数缺省 6（平底六边形），改边数走属性面板；零半径不提交；起点终点吃格、Alt 关格；esc 取消。
7. **渲染**（`src/viewport2d/draw-primitives.ts`）：世界顶点闭合折线（与底/高家族共用分支）；预览零半径返回 null；中心出参考点。
8. **控制点**（`src/viewport2d/control-points.ts` + 测试）：n 个顶点 `vertex-0..n-1`（kind vertex）与世界顶点同源；中心不进目录（平移走拖本体）。
9. **选择手势**（`src/viewport2d/select-gesture.ts` + 测试、`src/viewport2d/Viewport2d.vue`）：`handleReach` = r；`previewFromPrimitive` 携带全部字段；正多边形 n≥5 非连续旋转对称，旋转柄保留（rotationDeg 是几何字段）；Viewport2d pointerup 名单补 `"regularPolygon"`。
10. **属性面板**（`src/components/PropertiesPanel.vue`）：regularPolygon 进 `planarFields` 目录（x/y、sides（step 1）、r、rotationDeg）；`PlanarField`/`commitNumericField` 扩展 `integer`/`min` 约束，sides 非整数或 <5 不提交并回退。
11. **Prompt**（`src/document/prompt.ts` + 测试）：SYNTAX 加一行 `regularPolygon: x, y (circumcenter), sides (integer ≥ 5), r (circumradius), rotationDeg (optional, defaults to 0 = flat-bottom: one edge parallel to X at the bottom), fill`。
12. **hash 往返**（`src/document/hash.test.ts`）：七边形带 rotationDeg/fill 往返 + 重新 parse 相等。
13. **工具箱与 i18n**（`src/components/toolbox.ts` + 测试、`src/i18n/messages.ts`、`src/i18n/locale.test.ts`）：ICONS 加正五边形内联 SVG；zh「正多边形」/en「Regular polygon」；新增 `field.sides`（边数/Sides），`field.r` 沿 3D 圆柱既有键；票 13 的"angle 紧邻 circle"顺序断言随插入更新为"angle 紧邻 regularPolygon"。

## 测试摘要

- 新增 28 例（parse 5、regular-polygon 4、update 7、hit 3、fill 1、draw-gesture 3、control-points 1、select-gesture 1、prompt 1、hash 1、toolbox 1、locale 1…实数以 diff 为准），全部先红后绿。
- 全量：517/517 通过（基线 489）。
- 类型：`npx tsc --noEmit` 零错误；`npm run build` 成功（chunk 告警为既有现状）。

## 手势与交互细节（规格授权自定部分的取值）

- 边数缺省 6：拖半径提交平底正六边形（小学几何最高频），五边形及以上在属性面板把 sides 改成目标值。
- 拖顶点只改 r 不改朝向：想旋转多边形用旋转柄（写 rotationDeg）。

## 疑虑

- 顶点在正下方时（如六边形底边中点附近）控制点命中可能与图元本体命中重叠——既有"控制点优先于柄、再本体"的次序已覆盖，未观察到实际问题。
- `sides` 属性面板输入 5 以下或非整数会被 `integer`/`min` 校验拦下并回退，错误提示只有输入框回退本身（沿面板既有交互，无弹窗）。
- 工具箱顺序断言跨票耦合（每插一个新工具都要更新前票的邻接断言）；后续若再扩工具可考虑把顺序断言收敛为对 `DRAW_TOOLS` 快照的单点断言（本次未动，避免越界重构）。
