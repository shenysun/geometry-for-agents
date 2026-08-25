# 重叠填充图元实现报告（票 16，ADR 0019 引用式）

## 交付

2D 新图元 `overlapFill { sources: [id, id], fill }`：引用式两源交集阴影，几何不进说明书，交集渲染期离屏合成（曲边精确）。工具箱「重叠填充」工具两步拾取（快捷键 F），画完即回选择（ADR 0018）。删源级联删条目——由 schema 反向强制：`replaceDocument` 重走 parse，悬空 sources 直接拒整份说明书，级联是唯一正确实现。

## 分站落点

| 站 | 文件 | 要点 |
|----|------|------|
| 契约 | `parse-document.ts` | `overlapFillSchema` 进判别联合；superRefine 跨条目校验源存在/可填充；**可填充名单从联合推导**（含 fill 字段者，排除 overlapFill 自身）导出 `fillable2dTypes`，hit/工具复用，改 schema 即同步 |
| 级联 | `update-document.ts` | `removePrimitive` 一遍扫描闭包（源只能是几何图元，不会链式）；translate/rotate/scale/moveControlPoint 对 overlapFill 恒等 |
| 命中 | `hit.ts` | 三层：overlapFill 区域（两源都含点，并列取列表靠后者）> 几何现行规则（封闭优先 + 面积小者）> 笔画。让位规则：几何胜者面积严格小于两源时赢（交集里更小的可见目标），源不劫走自己的条目 |
| Prompt | `prompt.ts` | SYNTAX 一行关系描述（交集、按 id、可为空）；条目 JSON 本身即关系无坐标 |
| 渲染 | `draw-primitives.ts` | 离屏 canvas：世界系路径（圆/椭圆走 ctx.arc）→ `source-in` 遮罩 → solid/hatch 穿遮罩 → Konva.Image 顶层贴回，bbox 尺寸画布 + dpr 清晰度；`sourcesIntersect` 同源判据供创建契约 |
| 拾取 | `pick-overlap-gesture.ts` | 纯状态机（相交判定注入）；三拒绝：非封闭/同一图元/不相交，拒绝不改状态，空点忽略 |
| 布线 | `Viewport2d.vue` | click 通道分发；`commitPrimitive` 统一「成功才选中+回选择」（源码钉子测试保证 setTool("select") 全文件仅一处）；hint 条 i18n |
| 面板 | `PropertiesPanel.vue` | fill 编辑靠 `"fill" in primitive` 自动生效；新增只读「源：Circle ∩ Triangle」行 |
| 注册 | toolbox/tool-shortcuts/messages/ADR 0018 | 图标（两交叠圆+斜线）、F 键、中英词条、键位表补行 |

## 踩坑记录（值得留下）

1. **Vue 容器 vs Konva 命令式节点**：hint 条最初放进 `hostRef` 容器内——Konva 舞台 div 是命令式插入的，Vue patch 的兄弟锚点错乱，运行时 `insertBefore(null)` 崩溃且异常被 Vue 吞掉（页面静默不响应）。解法：外包 Vue 自己的 wrapper，hint 与宿主平级。这是 ADR 0008「命令式投影器」的边界条款，实现层第一次真正踩到。
2. **computed 依赖非响应式 let**：hint 最初用 computed 读 `let pickHintToken`，永不重算。改成 ref 直接赋值。
3. 源码断言测试（host.test.ts 钉 `setTool("select")` 仅一处）逼出了 `commitPrimitive` 的正确抽象，而不是放宽断言。

## 验证

- 单测 620 通过（新增：parse 7 + 级联/恒等 3 + 命中 5 + prompt 1 + hash 1 + 拾取 7 + 空间守卫断言；钉子测试更新：toolbox 顺序、快捷键表）
- 实机端到端（chromium + CDP 真输入，dev server）：画圆→画三角→F 两步拾取→月牙形斜线阴影出现且边界贴合圆弧；hint 三态正确；属性面板显示条目与「Sources: Circle ∩ Triangle」；拖圆阴影跟随；删圆阴影完全消失（级联）；全程零异常

## 已知边界

- 选中 overlapFill 无画布视觉描边（无几何可描）：反馈靠属性面板/对象列表；如需高亮可后续给遮罩加 tint
- 对象列表显示名复用 `tool.overlapFill` 计数（重叠填充、重叠填充1）自动生效
- 3D 不参与（空间守卫退回选择），Prompt 面向 Agent 的关系语义已写进 SYNTAX
