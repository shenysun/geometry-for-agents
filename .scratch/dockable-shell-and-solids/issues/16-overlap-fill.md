# 16 — 重叠填充图元：引用式两源交集阴影

**What to build:** 2D 新图元 `overlapFill`（ADR 0019 引用式）：`{ sources: [id, id], fill }`，不存几何——交集是渲染期离屏合成的推导值，曲边精确。契约：两源必须存在、属可填充封闭族、互不相同；相交性不进 schema（创建时校验，创建后被拖到不相交渲染为空、条目保留）。删源级联删条目——这由 schema 反向强制：`replaceDocument` 重走 parse，悬空 sources 会让整份说明书 parse 失败，级联是唯一正确实现。交互：工具箱「重叠填充」工具**两步拾取**（点两个封闭图元；非封闭 / 同一图元 / 不相交三条契约拒绝），提交后画完即回选择、新条目选中（ADR 0018）。Prompt 投影是关系不是坐标（SYNTAX 一行 + 条目 JSON 本身即关系）。

**Blocked by:** 无（二期首票；ADR 0019 已拍板，交互原型已验证）

**Status:** done

- [x] 契约：`overlapFillSchema` 进判别联合（label 后）；superRefine 校验 sources 存在 / 可填充 / 互异；可填充类型名单从联合推导（含 fill 字段者，排除 overlapFill 自身）导出供 hit.ts / fill.ts 复用；3D 拒绝由 space 判别自动生效；parse-document.test 先行
- [x] 级联：`removePrimitive` 删源连带删引用它的 overlapFill；`translatePrimitiveGeometry` 对 overlapFill 原样返回；update-document.test 先行（含「不级联则 parse 失败」的反向用例）
- [x] 命中：`hitTest` 三层优先——overlapFill 区域（点在两源交集内，多个并列取列表靠后者）> 封闭面（面积小者优先，现行规则不动）> 笔画族；overlapFill 不进 `contains` 泛化通道，在 hitTest 顶层特判；hit.test 先行
- [x] Prompt：SYNTAX 加 overlapFill 一行（关系描述，注明交集可为空）；prompt.test 补投影用例
- [x] hash 往返：schema 驱动；hash.test 补 overlapFill 用例
- [x] 渲染：draw-primitives 离屏 canvas 合成两源 Path 交集（`source-in`），hatch 斜线 / solid 穿遮罩；源被拖动跟随重绘；不相交渲染为空
- [x] 两步拾取工具：`EditorTool` 增 `overlapFill`（非 DrawTool 拖拽族；空间切换守卫把 2D 拾取工具带进 3D 时退回选择）；Viewport2d 点击分发、第一拾取高亮、三条契约拒绝提示
- [x] 选择 / 对象列表 / 属性面板：单选中、Del 可删；显示名「重叠填充」按类型计数；属性面板 fill 可改、sources 只读展示
- [x] 工具箱 + 快捷键 + i18n：ICONS 补 overlapFill（两交叠图形 + 交集斜线）；单键 `f` 进 2D 键位表；`tool.overlapFill` / field 词条中英双语
