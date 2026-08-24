# 09+10 报告：圆柱圆锥球 + 四棱锥三棱柱

- 票 09 commit：`c71b79b` feat: 圆柱圆锥球参数体
- 票 10 commit：`7526a80` feat: 四棱锥与三棱柱参数体
- 验证：`npx tsc --noEmit` 零错误；`npx vitest run` 全量通过（票 09 后 318 通过，票 10 后 342 通过）。

## 票 09 改动清单（c71b79b）

| 文件 | 改动 |
| --- | --- |
| `src/document/parse-document.ts` | 加 `cylinder`/`cone`/`sphere` schema（r/height 正数、三欧拉角、球无旋转字段）；`threeDTypes` Set 同步三类型；schema describe 写明站立体底面中心锚点 + 球心锚点 |
| `src/document/prompt.ts` | SYNTAX 加三行：圆柱/圆锥底面中心 + r + height + 三欧拉角；球球心 + r（no rotation fields） |
| `src/viewport3d/solid-commit.ts`（新） | `SolidToolId`/`SOLID_TOOLS`/`SolidPrimitive` 名单；`commitCylinder`/`commitCone`/`commitSphere` 与 `commitSolid` 按工具分发；`isSolidTool` 守卫；默认尺寸 r=0.5 height=1、球 r=0.5；锚点 = `snap3d` 吸附后的落点 |
| `src/viewport3d/projector.ts` | 共享单位几何体（圆柱/圆锥/球）+ 每图元 scale/rotate（YXZ 欧拉）；`PlacementPreview` 加 cylinder/cone/sphere 变体；`solidPlacementPreview` 纯映射；预览网格换几何体不换材质；destroy 补齐释放 |
| `src/viewport3d/Viewport3d.vue` | 放置与预览统一走 `commitSolid` + `solidPlacementPreview`（box 也并入），一次 pointerup 一次 `addPrimitive` |
| `src/viewport3d/index.ts` | 导出新提交函数与类型 |
| `src/components/toolbox.ts` | ICONS 加三项；3D 目录 = select + voxel + 五参数体（当时四项） |
| `src/stores/editor.ts` | `EditorTool` 收 `SolidToolId`；`threeDTools` 由 `SOLID_TOOLS` 生成 |
| `src/components/PropertiesPanel.vue` | box 专用字段表泛化为 `solidFields(type)` 按类型穷尽（球只有位置 + r）；`numericFieldOf`/`withNumericField` 不可变读写 |
| `src/i18n/messages.ts` | tool.cylinder/cone/sphere 与 field.r 中英双语 |
| 测试 | parse/prompt/hash/update/箱（toolbox/editor）/solid-commit.test.ts 全红→绿 |

### 票 09 验收框

- [x] 三种创建工具单击落下默认尺寸，预览后一次提交 — pointerup 单次 `commitSolid` + `addPrimitive`；预览跟随指针不写说明书（solid-commit.test.ts、Viewport3d 接线）
- [x] 圆柱/圆锥：底面中心 + `r` + `height` + 三欧拉角（默认 0）— schema 与 commitCylinder/Cone 测试逐字段断言
- [x] 球：球心 + `r`，无旋转字段 — strictObject 拒绝 rotationDeg*（专测）
- [x] 属性面板按类型编辑对应字段；2D 空间拒绝这些类型 — PropertiesPanel `solidFields`；parse 专测错误文案 `not allowed in space "2d"`
- [x] Prompt 列出三种语法与锚点；hash 往返成功 — prompt 专测（语法行含锚点与字段、球行无 rotationDeg）+ hash 混合往返专测

## 票 10 改动清单（7526a80）

| 文件 | 改动 |
| --- | --- |
| `src/document/parse-document.ts` | 加 `pyramid`（width/depth/height 正数 + 三欧拉角）与 `triangularPrism`（height 正数 + `base` 为恰三点的 `{x,z}` strictObject 元组 + 三欧拉角）；`threeDTypes` 同步；describe 写明两类型锚点与 base 局部 XZ 约定 |
| `src/document/prompt.ts` | SYNTAX 加两行：四棱锥底面中心 + width(X)/depth(Z)/height(Y) + 三欧拉角；三棱柱底面中心 + height + `3 local {x,z} points`（默认边长 1 正三角、形心在局部原点）+ 三欧拉角 |
| `src/viewport3d/solid-commit.ts` | `commitPyramid`（默认 1×1×1）、`commitTriangularPrism`（默认高 1 + `equilateralTriangleBase()`：顶点 (0,√3/3)、(−0.5,−√3/6)、(0.5,−√3/6)）；`SolidToolId`/`SOLID_TOOLS`/`isSolidTool` 扩两项；新增 `isSolidPrimitive` 图元守卫 |
| `src/viewport3d/projector.ts` | `createPyramidGeometry`（共享单位四棱锥，底 1×1 顶点 (0,1,0)，按 scale 放大）；`createPrismGeometry`（按 base 三点 + height 自建，顺时针输入按有向面积翻转让面朝外，`ownsGeometry` 标记自建自毁）；渲染 switch 补两类型；`PlacementPreview` 加 pyramid/prism；预览与重渲染前释放自建几何体 |
| `src/components/toolbox.ts` | ICONS 加 pyramid/triangularPrism；3D 目录补全为八个工具 |
| `src/stores/editor.test.ts` | 两新工具跨空间退回选择专测（editor.ts 本身零改动：SOLID_TOOLS 自动生效） |
| `src/components/PropertiesPanel.vue` | `solidFields` 补 pyramid（三尺寸 + 旋转）与 prism（位置 + 高 + 旋转）；prism 专属「底面三点」六输入编辑节（只动被改的底点，不可变） |
| `src/i18n/messages.ts` | tool.pyramid/triangularPrism、field.base/basePoint 中英双语 |
| 测试 | parse（含 base 元组长度/多余字段/缺字段拒绝）、prompt、hash、update（正方形底拉开长方形、正三角拉开一般三角形）、toolbox、solid-commit（默认底几何精确断言：三边长 1、形心 (0,0)） |

### 票 10 验收框

- [x] 两种创建工具单击落下默认尺寸，预览后一次提交 — 同 09 路径；prism 预览几何体按底面自建、换掉即释放
- [x] 四棱锥默认 `width === depth`；三棱柱 `base` 为形心在原点的正三角形 — 默认 1×1；`equilateralTriangleBase` 坐标按 √3 精确断言 + 几何校验（三边长 closeTo 1、形心 (0,0)）
- [x] 属性面板能改底面尺寸/三点与高；三欧拉角默认 0 — pyramid 字段表与 prism 底点编辑节；提交默认三欧拉角 0
- [x] 2D 空间拒绝这些类型；与体素、长方体可共存 — parse 错误文案专测；solid-commit 共存专测（prism + voxel + box 同说明书）
- [x] Prompt 列出两种语法与锚点；hash 往返成功 — prompt 专测逐锚点断言；hash 混合往返专测

## 测试摘要

- 新增测试文件：`src/viewport3d/solid-commit.test.ts`（放置提交纯函数，抄 box-commit 模式）。
- 扩展：parse-document / prompt / hash / update-document / toolbox / editor 六处既有测试文件。
- 全量：票 09 提交前 318 全过；票 10 提交前 342 全过；tsc 两次零错误。
- 不测 Three mesh 内部（沿 08 决定），渲染只测纯映射 `solidPlacementPreview` 的类型完备（由 tsc 穷尽性保证）。

## 疑虑

1. **球放置高度**：单击地面时 pick.world.y=0，球心即落在地面高度，球会半埋在地面下。锚点语义上这是忠实实现（球心 = 落点），但没有「落在地面上」的抬高魔法；操作员可 hover 体素顶面抬高落点或在属性面板改 y。若期望「放在桌上」，需要票 11 或后续加放置偏移——请拍板。
2. **三棱柱底三点可任意**：契约允许共线（渲染退化为不可见薄片）与顺时针（projector 按有向面积翻转绕序保证面朝外，不受影响）。未在 schema 层拒绝共线，属有意留白。
3. **projector 里 `signedArea2x` 假定 base 恰三点**：契约 tuple 保证，非用户可绕过。
4. `PropertiesPanel` 的 `numericFieldOf`/`withNumericField` 在联合类型上按字符串键读写（TS 无法对联合成员按键收窄）；守卫是字段目录按类型穷尽 + `solidFields` 的返回值，无 `as any`。
