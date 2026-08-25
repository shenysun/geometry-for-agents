# 2D 角图元 报告

- 票：13 — 角（契约见 `spec-2d-expansion.md`：`{ id, type: "angle", x, y, startDeg, endDeg, length(>0) }`，顶点为锚点，两角沿圆族度数惯例，两边等长；refine 归一化 sweep ∈ (0°,360°)——起止重合（零角）与差整周（周角）都拒绝；无 fill、无 rotationDeg——旋转手柄直接改写两角；弧标总是渲染）
- 提交：`ad30407`（`feat: 2D 角图元`，24 个文件，+789/−7）
- 验证：`npx tsc --noEmit` 零错误；`npx vitest run` 489/489 全过（票 12 后基线 459 + 新增 30）；`npm run build` 成功。

## 逐站改动清单

1. **契约**（`src/document/parse-document.ts` + 测试）：`angleSchema`（strictObject、`length` positive、refine 拒绝 `startDeg === endDeg` 与起止差 360 整倍数），插入判别联合 trapezoid 后、circle 前；2D 大夹具补 angle。测试：合法解析、零角/周角拒绝、非正边长拒绝、fill 拒绝（strictObject 自动）、3D 拒绝。
2. **共享几何模块**（新增 `src/document/angle.ts` + 测试）：`AnglePrimitive` 类型、`ANGLE_ARC_RATIO = 0.25`（弧标半径占边长比例，渲染细节不进契约）、`angleStartPoint`/`angleEndPoint`（圆族惯例极坐标端点）、`angleArcRadius`。命中、渲染、控制点、提交共用。
3. **提交纯函数**（`src/document/update-document.ts` + 测试）：translate 改 x/y；rotate 与 sector/bow/arc 同组——两角加 deg 归一 [0,360)（无 rotationDeg 字段）；scale 只乘 length；`primitiveAnchor` 取顶点。控制点：`apex` 写 x/y；`startDeg`/`endDeg` 写该方向角 + 公共边长（两边等长约束）。拖出零边长/起止同角被契约拒绝。
4. **命中与面积**（`src/document/hit.ts` + 测试）：笔画族——两边（共享顶点的三点折线）`nearPolyline` + 弧标 `nearArc`（复用既有函数，规格预告的 sweepDeg/normalizeDeg 直接可用）；非闭合，area ∞。
5. **填充**（`src/document/fill.ts` + 测试）：`withFill` 不收 angle（default 分支），补确认测试。
6. **绘制手势**（`src/viewport2d/draw-gesture.ts` + 测试）：`DRAW_TOOLS` 加 angle（trapezoid 后、circle 前）；复用 sweep 三步点击状态机（点顶点 → 点一边端点定 length+startDeg → 点另一边端点定 endDeg），`clickSweep` 既有"同点/同角不推进"检查自动防零角；`commitSweep`/previewFrom 加 angle 分支（字段 x/y/length 而非 cx/cy/r）；点击吃格；esc 取消。
7. **渲染**（`src/viewport2d/draw-primitives.ts`）：两边 = `[start, vertex, end]` 一条折线；弧标 = 复用 `drawSweepPath`（半径 `length×0.25`），总是画出（角的身份）；预览零边长返回 null；顶点出参考点。
8. **控制点**（`src/viewport2d/control-points.ts` + 测试）：`apex`（kind vertex）+ `startDeg`/`endDeg`（kind sweepAngle，id 与圆族起止角点同名同义）。
9. **选择手势**（`src/viewport2d/select-gesture.ts` + 测试）：`handleReach` = length；`previewFromPrimitive` 携带全部字段；旋转柄经 `rotatable` 判定自动齐备（旋转提交走两角改写）；角是三步点击工具，Viewport2d 的 pointerup 拖拽名单无需动。
10. **属性面板**（`src/components/PropertiesPanel.vue`）：`ANGLE_FIELDS` 目录（x/y、startDeg/endDeg（step 15）、length），走共用 `commitNumericField`；零角/周角提交被契约拒绝并回退。
11. **Prompt**（`src/document/prompt.ts` + 测试）：SYNTAX 加一行 `angle: x, y (vertex), startDeg, endDeg (side directions in degrees; 0° at +X, counterclockwise; sweep within (0°,360°)), length (both sides equal)`。
12. **hash 往返**（`src/document/hash.test.ts`）：角 lz-string 往返 + 重新 parse 相等。
13. **工具箱与 i18n**（`src/components/toolbox.ts` + 测试、`src/i18n/messages.ts`、`src/i18n/locale.test.ts`）：ICONS 加角符号（两条边 + 小弧）内联 SVG；zh「角」/en「Angle」；新增 `field.startDeg`（起始角/Start angle）、`field.endDeg`（终止角/End angle）、`field.length`（边长/Side length），双语断言进 locale 测试；票 12 的"trapezoid 紧邻 circle"顺序断言随 angle 插入更新为"trapezoid 紧邻 angle"。

## 测试摘要

- 新增 30 例（parse 5、angle 2、update 8、hit 3、fill 1、draw-gesture 5、control-points 1、select-gesture 1、prompt 1、hash 1、toolbox 1、locale 1），全部先红后绿。
- 全量：489/489 通过（基线 459）。
- 类型：`npx tsc --noEmit` 零错误；`npm run build` 成功（chunk 告警为既有现状）。

## 疑虑

- 弧标半径取 `length × 0.25`（自定渲染细节）：边长很短时弧标可能小于视觉可辨尺寸，暂不做最小像素钳制（渲染层无量纲信息，保持纯几何）。
- 拖边端点同时改公共 length（两边等长是契约）：拖一边会带动另一边变长，预览可见该行为；若操作员只想调角度，属性面板的 startDeg/endDeg 数字框不受此影响。
- `atan2` 回算方向角在非轴向角上有 1e-16 级 ε（cos(90°) ≠ 0），相关测试用极小容差断言；契约层的零角 refine 用精确相等判断，不会被 ε 误伤（轴向角 atan2 精确）。
- 角的第三步点击与起止同角时保留手势等下一击（沿 sweep 先例），不弹提示；操作员按 esc 可退出。
