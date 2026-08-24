# 04 — 选择工具拖 2D 图元平移 报告

**Commit:** `8abc9ab23935b341e0f5398a90d49f9008f1519a`（`feat: 选择工具拖 2D 图元平移`）

## 改动文件

| 文件 | 改动 |
|---|---|
| `src/viewport2d/select-gesture.ts` | 新建。选择手势纯函数（抄 draw-gesture 模式）：`startSelect`/`moveSelect`/`upSelect`/`clickSelect`/`escSelect`/`selectPreview`。输入工具/说明书/指针世界坐标/格/命中容差，输出预览与至多一次 commit |
| `src/viewport2d/select-gesture.test.ts` | 新建。13 个用例：命中与容差、单击选中/空白取消、重叠选面积小者、预览吸附（1 / 1/2 / off）、一次 up 一次 commit、亚格位移不提交、Esc 放弃、拖动中图元被删回 idle、手势全程说明书不变（快照断言） |
| `src/document/update-document.ts` | 新增 `translatePrimitiveGeometry`（单图元几何字段平移，位移已吸附，不可变）与 `translatePrimitive`（说明书+id+原始世界位移+格 → snap2d 吸附后写入，返回新说明书；拒绝 3D 体素文档与未知 id；零位移返回原文档） |
| `src/document/update-document.test.ts` | 追加 9 个用例：各类型几何字段写入（line/polygon 的 points、圆族 cx cy、label x y）、半格/关吸附、零位移、未知 id、3D 拒绝、结果再 parse、原说明书快照不变 |
| `src/document/hit.ts` | `hitTest` 增加第三参 `tolerance`（世界单位，缺省 0 行为不变）：细线/弧/标签在容差内可命中，闭合图元仍是面积命中 |
| `src/document/hit.test.ts` | 追加 3 个用例：线/弧/标签容差命中，零容差精确回归 |
| `src/viewport2d/Viewport2d.vue` | 选择工具接线：pointerdown 命中即选中并进拖动、capture 阶段拦截 mousedown 压制投影器的空白平移、pointermove 出吸附预览、pointerup 一次 `translatePrimitive` → `documentStore.updatePrimitive`（一步 Undo）、click 空白取消选中、Esc 放弃；选中图元常驻虚线标记（复用预览层 `setPreview`），在文档/选中/工具变化、滚轮缩放、pan 视口、resize 时刷新 |
| `src/viewport2d/host.test.ts` | 一行：装配断言 `hitTest` → `startSelect`（命中调用移入 select-gesture 纯函数后，该读源码弱测试跟随更新）。**此文件不在我的白名单，属必要跟随，请知悉** |

## 验收框逐条

- [x] 选择工具下单击图元选中，单击空白取消 — `startSelect` 按下即选中；`clickSelect` 空白返回 `selectionId: null`（既有 click 阈值 dragDistance>4 保留：拖动结束不误触发取消）
- [x] 拖本体平移整图元（坐标写入几何字段），预览期间说明书未变，松手一次提交 — `moveSelect` 只出预览（测试有说明书快照断言）；`upSelect` 至多一次 commit，走 `translatePrimitive` 写 points / cx cy / x y（ADR 0015，不另做矩阵）；`documentStore.updatePrimitive` 一次历史快照 = 一步 Undo
- [x] 视口对选中图元有可见标记 — 选中图元以虚线描边 + 锚点圆点常驻显示（预览层同款画法），拖动时虚线图元跟随到目标位置
- [x] 对象列表与属性面板跟同一 `selectionId` — 现状已联动：`src/components/PropertiesPanel.vue:14` 与 `src/components/EditorShell.vue:150,154`（对象列表）都读 `editor.selectionId`，未改壳组件
- [x] 平移吃当前格；Alt 暂时不落格 — 位移经 `snap2d` 吸附（1 / 1/2 / off 三态各有测试）；Alt 沿用 `gridForEvent` 折算为 off，预览与提交一致

## 测试

- 命令：`npm run typecheck`（零错误）+ `npx vitest run src/viewport2d/select-gesture.test.ts src/document`（全过）+ 全量 `npx vitest run`
- 输出摘要：**PASS (170) FAIL (0)**；新增/修改用例先红（函数与模块不存在、容差不生效）后绿；期间修正过两处测试自身的浮点期望（`9.4-8=1.4000000000000004`），改用二进制精确坐标

## 疑虑

1. **`host.test.ts` 一行越界**：读源码弱测试断言 `Viewport2d.vue` 含 `hitTest`；命中收进 `select-gesture` 后该断言必须跟随（否则留红），已改并在此注明。
2. **视口变换未作为手势入参**：spec 缝2 提到「视口变换」，与 draw-gesture 一致，指针在组件层已换算为世界坐标；唯一用到像素的地方是命中容差（6px），由组件层用 `projector.toWorld` 两点采样换算成世界单位传入。
3. **拖动中滚轮缩放**：拖图元的同时滚轮，预览停在旧屏幕位置（需指针再动一下才重算）；既有 draw 预览同此限制，未单独处理。
4. **平移标记复用预览层**：projector 无选中 API 且不在我领地，标记用 `setPreview` 画（虚线描边）。视图变化处（缩放/pan/resize/文档/选中/工具）都已补刷新；若后续票给 projector 加 `setSelection`，建议把标记迁过去。
5. **提交路径两跳**：`translatePrimitive` 产出新说明书后，组件从中取该图元交给 `documentStore.updatePrimitive`（store 未暴露接受 DocumentUpdateResult 的写入口，stores 不在我领地）。语义清楚但有两次 zod parse，说明书规模下无感。
