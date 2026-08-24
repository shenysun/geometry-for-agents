# 02 — 记住布局、关面板、恢复默认：实施报告

**Commit:** `4ef5a67` — `feat: 布局本机记忆、面板显隐与恢复默认`

## 改动文件清单

| 文件 | 改动 |
| --- | --- |
| `src/components/layout.ts` | 新增。布局纯数据模块：`PANEL_IDS`（五块）、`VIEWPORT_PANEL_ID`、`CLOSABLE_PANEL_IDS`（四块可关）、`PANEL_TITLE_KEYS`、`LAYOUT_STORAGE_KEY`、`factoryLayoutSnapshot()`（出厂五块三列快照）、`sanitizeLayoutSnapshot(raw: unknown)`（坏输入 → 出厂；缺视口 → 第一个叶子组补回）。 |
| `src/components/layout.test.ts` | 新增。纯函数测试 10 例：坏字符串/非字符串/结构不合法/引用未知面板/空树 → 出厂；含视口合法快照原样往返；缺视口补回且其余摆法保留；出厂三列结构与可关名单。 |
| `src/components/DockHost.vue` | 出厂改为纯数据快照（`clear` + `fromJSON`，命令式 `layoutFactory` 删除）；`useLocalStorage` 存取快照，`onDidLayoutChange`（150ms debounce）落盘并上报 `editor.closedPanelIds`；`fromJSON` 失败兜底回出厂；自定义 `PanelTab` 标签（视口不渲染关闭钮，其余四块有）；`watch(editor.layoutCommand)` 执行开/关/恢复默认；保留 `watch(locale)` + `setTitle` 的标题语言刷新。 |
| `src/components/DrawToolbar.vue` | 顶栏新增「面板」下拉（reka-ui `DropdownMenuCheckboxItem`，勾=开、取消=关）与「恢复默认布局」按钮；格开关保留。 |
| `src/stores/editor.ts` | 新增 `closedPanelIds`（显隐上报）、`layoutCommand`（open/close/reset + nonce）、`setClosedPanelIds`/`openPanel`/`closePanel`/`resetLayout`。不新增 store。 |
| `src/i18n/messages.ts` | 只加 `layout` 分区（`panels`/`reset`/`closePanel`，中英）。 |
| `src/app-shell.test.ts` | 出厂五块摆法断言移到 layout.ts；新增布局持久化装配断言（useLocalStorage/接线/勾选/恢复默认/不进说明书）。 |

## 验收框逐条勾验

- [x] 布局用 VueUse `useLocalStorage` 记住；刷新后摆法还在
  `DockHost.vue` 用 `useLocalStorage<string>(LAYOUT_STORAGE_KEY, "")`；`onDidLayoutChange`（debounce 150ms）`JSON.stringify(api.toJSON())` 落盘，打开时 `fromJSON` 恢复。浏览器实测：关工具箱 → 刷新 → 工具箱仍关。
- [x] 保存/分享后的说明书与 URL hash 不含布局
  布局只写 localStorage；`DockHost` 不引用 document store（app-shell 断言）；document/hook 代码未动。
- [x] 四块面板可关，顶栏勾选可再打开；视口不能关，快照缺视口时补回
  `PanelTab` 对视口不渲染关闭钮（浏览器实测视口 tab 0 个关闭钮、其余各 1）；顶栏勾选开/关均实测通过；缺视口快照打开后视口被补回（纯函数测试 + 浏览器实测，工具箱/对象列表摆法保留）。
- [x] 「恢复默认布局」回到出厂五块全开
  顶栏按钮 → `editor.resetLayout()` → `applySnapshot(factoryLayoutSnapshot())`，实测五块全开、三列归位。
- [x] 无法解析的布局字符串回出厂，编辑器仍能用
  `sanitizeLayoutSnapshot` 纯函数测试 10 例全绿；浏览器实测注入 `'{{{not json'` 刷新 → 出厂五块全开，且打开后立即存回合法快照（自愈）。

## 测试命令与输出摘要

```
npm run typecheck
  → 0 错误（工作区全绿）

npx vitest run src/components/layout.test.ts src/app-shell.test.ts
  → 21 passed / 0 failed（layout 10 + app-shell 11）

npx vitest run   # 全量回归
  → 241 passed / 0 failed
```

另做了两层额外验证：
1. **index 树独立验证**：editor.ts/messages.ts 与 08 号票（长方体）的工作区改动混在同一文件，提交时用 `git hash-object` + `git update-index` 只暂存本票 hunks；导出 index 树跑 `tsc --noEmit`（0 错误）与 vitest（21/21）确认本提交不依赖 08 的未提交改动。
2. **浏览器实测**（Vite dev + agent-browser）：出厂五块渲染、视口无关闭钮、tab 关面板、顶栏勾选开/关、刷新持久、恢复默认、坏字符串回出厂、缺视口补回、中英切换标题刷新，全部通过。期间发现并修复两个真问题：dockview-vue 8.2 传给 tab 组件的顶层 prop 是 `params`（内含 `api`），reka-ui 2.4 的 `DropdownMenuCheckboxItem` 用 `modelValue` 而非 `checked`。

## 疑虑

- `onDidLayoutChange` 在 `fromJSON` 后不触发，故 `onReady` 末尾主动落一份初始快照；用户从不改动布局时本机存的即出厂快照，行为等价。
- 从顶栏重新打开面板的落位规则是「工具箱/对象列表回视口左列、属性面板/垫图回右列」（`reopenSide`），不记忆被关前的精确位置——spec 未要求记忆，恢复默认可随时归位。
- reopen 面板用 `addPanel` 命令式加回（无法用 fromJSON 表达「在既有布局上补一块」），这是唯一的命令式布局路径，其余全部走快照。
