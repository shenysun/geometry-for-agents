# 03 — 工具箱：图标+名称 实施报告

**Commit:** `6523acc` feat: 工具箱图标加名称并接管创建工具

## 改动文件

| 文件 | 改动 |
| --- | --- |
| `src/components/toolbox.ts` | 新建。`toolsForSpace(space)` 纯函数：每空间工具目录（id + i18n key + 内联 SVG 图标数据）。2D = select + `DRAW_TOOLS` 全部九种；3D = select + voxel（参数体未加） |
| `src/components/toolbox.test.ts` | 新建。两空间名单、互斥性（2D 无 voxel / 3D 无 2D 创建工具 / 都含 select）、每项 labelKey 与图标数据断言 |
| `src/components/ToolboxPanel.vue` | 占位槽填充为真工具箱：图标 + 名称列表，点击调 `editor.setTool`，选中项 `aria-pressed` + 高亮激活态，目录随 `documentStore.current.space` 切换 |
| `src/components/DrawToolbar.vue` | 创建工具 ToggleGroup 整块删除；格开关留在顶栏（仍只在 2D 显示）。组件名与 `data-draw-toolbar` 保留（`EditorShell` 引用） |
| `src/stores/editor.ts` | `EditorTool` 扩 `"voxel"`；`setSpace` 回退：2D 创建工具切 3D、voxel 切 2D 都退 `"select"` |
| `src/stores/editor.test.ts` | 补「voxel 是工具；跨空间创建工具退回选择」用例 |
| `src/i18n/messages.ts` | `tool.voxel`（单位立方体 / Unit cube）；删不再用的 `toolbox.placeholder` 两语占位 |
| `src/app-shell.test.ts` | 补壳装配源码断言：工具箱渲染 `toolsForSpace` 且点选切 `editor.tool`、顶栏不再含 `DRAW_TOOLS`/`isDrawTool`/`tool.select`、格开关保留 |

## 验收框逐条

- [x] 2D 工具箱含选择与现有平面创建工具，图标+名称，点选切换 `editor.tool` — `toolsForSpace("2d")` = `["select", ...DRAW_TOOLS]`，`ToolboxPanel` 每项内联 SVG + `t(labelKey)`，`@click="editor.setTool(tool.id)"`
- [x] 3D 工具箱含选择与单位立方体；2D 创建工具不出现 — `toolsForSpace("3d")` = `["select", "voxel"]`，测试断言互斥
- [x] 顶栏不再放创建工具；格仍在顶栏 — `DrawToolbar.vue` 仅剩格 ToggleGroup，`setGrid` 保留
- [x] 切到 3D 时 2D 创建工具变为选择 — `setSpace` 回退逻辑（双向：voxel 进 2D 也回 select），测试覆盖
- [x] 2D 绘制与 3D 放体素仍可用 — 未动 `viewport2d/**`、`viewport3d/**`；3D 视口不读 `editor.tool`，左键放体素现状不变（分家留给 07）

## 测试

- `npx vitest run src/components/toolbox.test.ts src/stores/editor.test.ts src/app-shell.test.ts` → 21 pass / 0 fail
- `npx vitest run`（全量）→ 176 pass / 0 fail
- `npm run typecheck` → 零错误

TDD 顺序：先写三个测试文件跑红（voxel 回退断言失败、工具箱装配断言失败、toolbox 模块缺失），再实现转绿。

## 疑虑

- 无阻塞。两点备忘：图标是手绘 16×16 描边 path（无图标库，符合票面约束），视觉细节可后续统一调；`ToolboxToolId` 从 `EditorTool` 派生（`Exclude<EditorTool, null>`），后续票给 3D 加参数体工具时只需在 `editor.ts` 扩类型、在 `toolbox.ts` 的 `TOOLS_PER_SPACE`/`ICONS` 加项。
