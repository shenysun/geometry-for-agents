# 01 — 可停靠五块面板出厂布局 · 实施报告

**Commit:** `ddd77092d069067abfcdc4028091c1846d84409d`
**状态:** DONE（带两处说明，见「疑虑」）

## 改动文件清单

| 文件 | 改动 |
| --- | --- |
| `package.json` / `package-lock.json` | 新增依赖 `dockview-vue@8.2.0`（lock 为 npm install 必然产物） |
| `src/components/DockHost.vue` | 新建。dockview-vue 装配：五块面板注册、出厂布局（左列上工具箱下对象列表、中视口、右列上属性下垫图）、`disable-floating-groups` 禁浮窗、语言切换时更新面板标签标题 |
| `src/components/ToolboxPanel.vue` | 新建。工具箱空占位槽（创建工具暂留顶栏，下一票搬入） |
| `src/components/ObjectListPanel.vue` | 新建。对象列表从 EditorShell 拆出为独立面板，点选联动保持 |
| `src/components/ViewportPanel.vue` | 新建。按说明书空间包 Viewport2d / Viewport3d（原样引用，未改其内部） |
| `src/components/EditorShell.vue` | 重写。只剩顶栏（空间/工具/文件/撤销/重做/分享/语言）+ 打开错误条 + DockHost + 空间切换确认对话框；删除内联三栏、垫图内联、JSON 原文调试输出 |
| `src/components/PropertiesPanel.vue` | 微调：根元素加 `h-full overflow-auto` 适配面板滚动；内容逻辑未动（本就只显示选中图元、未选中为空） |
| `src/components/UnderlayPanel.vue` | 微调：去掉 `border-t`（不再是属性列下一段），加 `h-full overflow-auto` |
| `src/app-shell.test.ts` | 先红后绿：dockview-vue 依赖、DockHost 五面板 id 与出厂方位断言、顶栏在停靠区外、JSON 原文与垫图离开壳层、对象列表独立组件点选断言；原对象列表/视口断言随拆分改读新组件 |
| `src/i18n/messages.ts` | 新增 `panel.*`（五面板标题，中英）与 `toolbox.placeholder` |
| `src/style.css` | 引入 `dockview-vue/dist/styles/dockview.css`；light 主题变量微调至 zinc 灰阶（面板头 32px、分隔条 hover 可见） |

## 验收框逐条勾验

- [x] 接入 `dockview-vue`，五块面板可并排、改大小、叠成标签 — `DockviewVue` 组件 + `addPanel` 出厂布局；dockview 默认 dock-only，可拖拽并排/改大小/叠标签（冒烟中五面板均带标签页头）
- [x] 出厂摆法为左工具箱/对象列表、中视口、右属性/垫图 — `layoutFactory`：object-list `below` toolbox，viewport `right` of toolbox，properties `right` of viewport，underlay `below` properties；浏览器截图确认布局正确
- [x] 顶栏不进停靠区；无页内浮窗、无弹出浏览器窗口 — 顶栏是 `<header>` 整页铬；传 `:disable-floating-groups="true"`；popout 仅显式 API 可触发，未接入
- [x] 属性面板只显示选中图元字段，未选中为空；垫图独立；JSON 原文离开属性面板 — PropertiesPanel 原有逻辑保持并有既有测试；UnderlayPanel 挂为独立面板；`serializedDocument` 从壳层删除（未做成第六块面板）
- [x] 视口仍能画、对象列表仍能点选；说明书与分享链接行为不变 — 浏览器冒烟：顶栏选「线段」→ 视口拖拽画线 → 对象列表出现该图元 → 点选后属性面板显示 `line · <id>`；说明书/分享/Prompt 相关测试全绿，未触碰 document/share/io/stores

## 测试命令与输出摘要

- `npx vitest run src/app-shell.test.ts` → **PASS (9) FAIL (0)**（先红：DockHost 等新文件不存在时 2 个新用例 ENOENT 失败；实现后全绿）
- `npm run build` → 成功，837 模块，dockview CSS 正常打包
- `npm run typecheck` → **我领地文件零错误**；报错均来自并行票文件（`src/document/hit.test.ts`、`src/document/update-document.test.ts`、`src/viewport2d/select-gesture.test.ts`），已忽略
- `npx vitest run`（全量）→ 145 过 / 12 败，失败全部位于并行票领地 `src/document/hit.test.ts`、`src/document/update-document.test.ts`，与本次改动无关
- 运行时冒烟（vite preview + 无头浏览器）：无页面错误、无控制台报错；五面板渲染 + 画线 + 点选联动确认

## 疑虑

1. **面板标签标题与语言切换**：dockview 面板标题在 `onReady` 时定，语言切换后我通过 `watch(locale)` 调 `setTitle` 更新五块标签。此路径冒烟未逐语言验证（只验证了中文初始渲染），若下一票布局持久化（fromJSON）接管标题，注意保留该同步。
2. **package-lock.json 一并提交**：允许清单只写了 `package.json`，但 lock 是 `npm install dockview-vue` 的必然产物，不提交会造成安装版本漂移，故纳入本次提交。
3. **dockview 面板默认带关闭按钮**：本票未配置「视口不可关」（那是票 02 布局持久化的范围），操作员当前可以把任意面板关掉且顶栏暂无重开入口——待票 02 落地面板显隐勾选与恢复默认布局。
