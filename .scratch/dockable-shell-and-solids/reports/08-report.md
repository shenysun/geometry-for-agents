# 08 — 单击放置长方体 实施报告

**Commit:** `2991aa6`

## 改动文件清单

领地内：

- `src/document/parse-document.ts` + `.test.ts` — 新增 `boxSchema`（id/type/x/y/z/width/depth/height/rotationDegY/X/Z，三尺寸 `positive`）；3D 图元从单一 voxel 变为 `threeDPrimitiveSchema` 判别联合；`spaceMismatchError` 的 3D 名单为 `{voxel, box}`（2D 说明书拒绝 box，报错文案与 voxel 同款）；schema `describe` 写明 box 底面中心锚点、+Y、Y→X→Z。
- `src/document/update-document.test.ts` — box 的 add/update 不可变更新后仍能 parse；2D 说明书拒绝写入 box。
- `src/document/prompt.ts` + `.test.ts` — CONVENTIONS 增两条（站立参数体底面中心锚点 +Y、欧拉角 Y→X→Z）；SYNTAX 增 box 行含全部字段。
- `src/document/hash.test.ts` — box+体素混合 3D 说明书 hash 往返 `toEqual` 且再 parse 成功。
- `src/viewport3d/snap3d.ts` + `.test.ts`（新）— 3D 参数体自己的落点吸附纯函数（吃 1 / 1/2 / 关，逐轴四舍五入；不动 2D 的 snap.ts）。
- `src/viewport3d/box-commit.ts` + `.test.ts`（新）— `commitBox(document, world, grid, id)`：吸附当前格后一次产出默认 1×1×1、三欧拉角 0、位置 = 底面中心；仅 3D 说明书合法；`BOX_DEFAULTS` 常量。
- `src/viewport3d/projector.ts` — 新 `solidGroup` + `placeBoxMesh`（底面中心定位、scale 三尺寸、Euler `"YXZ"` 合成顺序）；`Viewport3dPick` 两变体都带 `world`（指针原始世界落点：体素命中取面交点，否则地面交点）；`setPreview` 泛化为 `PlacementPreview`（voxel 最小角 / box 底面中心+尺寸）；`destroy` 释放 solidMaterial。
- `src/viewport3d/Viewport3d.vue` — 拿着长方体工具时：预览与单击提交走 `commitBox(document, pick.world, editor.grid, uuid)`，一次 `addPrimitive` 后选中；其它工具保持体素点格路径（票 07 再分家）；拖动超阈值仍取消预览不提交。
- `src/viewport3d/index.ts` — 导出 box-commit/snap3d/PlacementPreview。
- `src/stores/editor.ts`（仅工具类型）+ `.test.ts` — `EditorTool` 增 `"box"`；`threeDTools` 名单 `{voxel, box}`，`setSpace("2d")` 时退回选择。
- `src/components/toolbox.ts` + `.test.ts` — ICONS 增 box（斜二测长方体图标）；3D 目录 `["select","voxel","box"]`；ToolboxPanel 数据驱动无需改。
- `src/components/PropertiesPanel.vue` — box 选中时按 `BOX_FIELDS` 数据目录渲染 9 个数字输入（x/y/z、width/depth/height、三欧拉角），`@change` 不可变写入说明书；非数字或 ≤0 尺寸不写并回退显示；保留原 fill 分区。
- `src/i18n/messages.ts` — 只加 `tool.box`（长方体/Box）与 `field.*`（9 个字段名）两组 key，紧挨工具名分区，未动顶栏/布局区。

领地外的穷尽 switch 跟随改动（已获 team-lead 授权进本票提交）：

- `src/document/hit.ts` — `contains` 加 `case "box": return false;`、`area` 加 `case "box": return Number.POSITIVE_INFINITY;`（box 加入 Primitive 联合后 switch 不再穷尽，TS2366）。
- `src/viewport2d/draw-primitives.ts` — `drawPrimitive` 加 `case "box": return [];`（同因，2D 视口不画 3D 参数体，同 voxel 先例）。

## 验收框逐条勾验

- [x] 3D 工具箱有长方体；单击吸附后提交一条 `box`，默认 width/depth/height 为 1 — `toolsForSpace("3d")` 含 box（测试锁定目录）；`commitBox` 吸附后产出 1×1×1，Viewport pointerup 单击一次 `addPrimitive`。
- [x] 位置为底面中心；`rotationDegY/X/Z` 为 0；与体素共存于 `space: "3d"` — `commitBox` 测试断言全字段；parse 测试断言 box+voxel 同份 3D 说明书合法；projector 两个组同帧渲染。
- [x] 2D 说明书拒绝 `box`；非法尺寸被 Zod 拒绝 — parse 测试：2D 报 `type "box" is not allowed in space "2d"`；width/depth/height ≤0 各被 `positive` 拒绝；缺 rotationDegY 被拒。
- [x] 属性面板可编辑该长方体字段并写入说明书 — PropertiesPanel 9 字段数据目录，改动即 `updatePrimitive` 不可变写入，写入后仍过 Zod（非法值拒绝并回显旧值）。
- [x] Prompt 说明长方体锚点与字段；hash 往返成功 — CONVENTIONS/SYNTAX 覆盖底面中心、+Y、三尺寸、三欧拉角与 Y→X→Z（测试用正则锁定）；box+voxel hash 往返 `toEqual`。

## 设计要点

- **落点语义与 2D 一致**：2D 图元锚点吸附格点（格交点），box 同样把底面中心吸附到 3D 格点；体素路径不受影响（仍 `snapVoxel` 整数最小角）。格开关 1/1/2/关 对参数体生效，是从 `editor.grid` 一路传进 `commitBox` 的。
- **`world` 进 pick**：参数体需要指针的原始世界落点（可含半格），体素需要整数角；两者都从一次 raycast 里带出（命中体素取面交点，否则取地面交点），互不抢。
- **单击语义沿用体素先例**：按下即出预览、位移超 4px 判为拖动取消、抬起未拖才提交；长方体分支与体素分支同构。
- **欧拉角**：Three `Euler` 序 `"YXZ"` 对应 ADR 0016 的 Y→X→Z 合成；本票只有 0 姿态与属性面板改角度，手柄在票 11。

## 测试命令与输出摘要

- `npx vitest run src/document src/viewport3d src/components/toolbox.test.ts src/stores/editor.test.ts` — PASS 116 / FAIL 0。
- `npx vitest run`（全仓）— 27 个测试文件、241 用例全过。
- `npm run typecheck` — 0 错误（含 3 行领地外跟随改动后全仓干净）。
- 流程为先红后绿：parse 5 用例、update 3 用例、prompt 1 用例、hash 1 用例、box-commit 6 用例、snap3d 4 用例、editor 1 用例、toolbox 2 用例改写，均先确认失败再实现。

## 疑虑

1. **领地外 3 行连锁（已获授权并落地）**：box 进 `Primitive` 联合后 `src/document/hit.ts`（contains/area 两处）与 `src/viewport2d/draw-primitives.ts`（drawPrimitive）的穷尽 switch 编译红（TS2366）。team-lead 已裁决按 voxel 先例加单 case 进本票提交。波 5 批量加参数体前，team-lead 会另派 agent 把 2D 图元收窄成独立类型联合，让这两处签名只吃 2D 联合，从根上解决。
2. **`src/stores/editor.ts` / `src/i18n/messages.ts` 为并行共用文件**：布局 agent 同期加入 LayoutCommand 等代码块，与本票改动无冲突、全量测试共同通过；提交时这两个文件整文件暂存会带上对方 hunks，需要按团队提交纪律协调先后。
3. 体素面上放长方体时，落点取面交点吸附（如体素顶面 → y=1 的格点），box 以格点为底面中心而非格中心；与 2D「锚点吸附格点」语义一致，视觉上可能半格悬出体素侧面，票 11 手柄可再调。
4. 3D 选中高亮、box 拾取/选中态不在本票（pick 仍只交集体素组），票 07/11 处理。
