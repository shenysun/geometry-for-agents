# 几何说明书编辑器（第一期）

**Status:** ready-for-agent

开源生产工具。操作员对照题图画出图元，得到说明书（JSON 真源）和 Prompt（可读投影），交给 Agent 去生成课件。词表见根目录 `CONTEXT.md`，硬决定见 `docs/adr/`。

## Problem Statement

生产互动几何课件时，Agent 经常无法从题图复原图形。操作员已经有三个互不相通的单文件 HTML 助手（线段、曲线、体素），可以导出 Prompt，但无法工程化：画完不能改、只有整数格、不能垫图、不能点名和阴影、2D/3D 拆成三个网址、没有可版本化的说明书、没有分享链接。

## Solution

一个 MIT 开源的单页编辑器。视口可在 2D / 3D 间切换（壳像 Unity：中间视口，旁边对象列表和属性）。一份说明书只属于一个空间。操作员可垫半透明题图、按格绘制封闭名单内的图元、松手后写入说明书。打开/保存 JSON；分享链接把说明书压进 URL hash。永远没有账号和云。界面中英 i18n；说明书字段永远英文。

## User Stories

1. As an 操作员, I want 在一个页面里完成所有绘制, so that 不必在三个 HTML 工具间来回切换。
2. As an 操作员, I want 视口在 2D 与 3D 之间切换, so that 平面题和盖楼题用同一套壳。
3. As an 操作员, I want 一份说明书只属于一个空间, so that Agent 可以干净地选择 p5 或 three，不会一份里混两套引擎。
4. As an 操作员, I want 切换空间时若已有图元则被明确拦住或确认清空, so that 不会默默丢掉或错误转换图元。
5. As an 操作员, I want 把题图垫在视口底下并调节透明度, so that 可以对照真值描结构。
6. As an 操作员, I want 平移和缩放垫图以对齐格, so that 题图像素网格和数学格重合。
7. As an 操作员, I want 垫图像素不进入交给 Agent 的几何, so that Agent 吃的是图元而不是照片。
8. As an 操作员, I want 分享链接只带走垫图的 http(s) 地址和对齐, so that 对方打开链接能看到同一份图元；本地上传的图对方看不到是可接受的。
9. As an 操作员, I want 在 2D 绘制线段和折线, so that 楼梯、小路、格点、凹凸轮廓能进说明书。
10. As an 操作员, I want 在 2D 绘制多边形, so that 封闭区域和剪拼块的轮廓能进说明书。
11. As an 操作员, I want 在 2D 绘制圆、扇形、弓形、弧、圆环、轴对齐椭圆, so that 捆圆、圆环、弓形、弯角类题能进说明书。
12. As an 操作员, I want 给点命名（如 A、B、C）, so that 金字塔、沙漏等比例题里 Agent 知道哪条是 DE。
13. As an 操作员, I want 给封闭区域上阴影或实心填充, so that 阴影部分面积题能标出哪一块。
14. As an 操作员, I want 在 3D 放置单位立方体, so that 盖楼、魔方、三视图、挖洞能进说明书。
15. As an 操作员, I want 3D 里 Y 为高度、地面在 XZ, so that 和 Unity / Three.js 一致，说明书可直接给 three 课件。
16. As an 操作员, I want 2D 默认吸附到边长 1 的格, so that 小学格点题坐标是干净整数。
17. As an 操作员, I want 把格切到 1/2, so that 半格和部分比例题能对齐垫图。
18. As an 操作员, I want 按住修饰键暂时不落格, so that 偶发的非格点位置仍能描上。
19. As an 操作员, I want 3D 体素只落在整数格, so that 单位立方体不会出现半格悬空。
20. As an 操作员, I want 绘制时看到预览、松手后才写入说明书, so that 拖错可以在落笔前放弃，Undo 也不会碎成每帧一步。
21. As an 操作员, I want 选中已有图元并拖控制点或改属性, so that 不必删掉重画。
22. As an 操作员, I want 对象列表里看到所有图元并删除, so that 嵌套图形也能精确挑到要删的那条。
23. As an 操作员, I want 撤销和重做按说明书快照进行, so that 一次手势一步，行为可预期。
24. As an 操作员, I want 导出说明书 JSON 文件, so that 真源可以落盘、进 git、交给别人。
25. As an 操作员, I want 打开说明书 JSON 文件继续编辑, so that 关掉页面后工作能回来。
26. As an 操作员, I want 打开非法或不认识图元的 JSON 时被拒绝并看到原因, so that 坏文件不会把编辑器画崩。
27. As an 操作员, I want 复制分享链接, so that 把 URL 丢给同事就能打开同一份说明书。
28. As an 操作员, I want 打开带 hash 的链接直接进入那份说明书, so that 不需要账号和云。
29. As an 操作员, I want 从说明书生成 Prompt 并复制, so that 可以粘贴给 Agent。
30. As an 操作员, I want Prompt 永远能从当前说明书再生成, so that Prompt 不是第二份真源。
31. As an 操作员, I want Prompt 里写清坐标约定（Y 向上、角度单位、3D Y 为高度）, so that Agent 不会用错轴。
32. As an Agent, I want 说明书是浅层英文 JSON、图元类型是封闭名单, so that 可以确定性复原成 p5/three。
33. As an Agent, I want 不需要解析 Konva 或 Three 的场景树, so that 契约不绑渲染器版本。
34. As an 操作员, I want 界面能中英切换, so that 本团队用中文、开源协作者可用英文。
35. As an 操作员, I want 第一次打开时语言跟浏览器，中英之外则中文, so that 少一次找设置。
36. As an 操作员, I want 说明书的键名不随界面语言改变, so that 中英界面导出的 JSON 是同一份契约。
37. As an 操作员, I want 2D 视口滚轮缩放、拖拽平移, so that 大图和小细节都能看。
38. As an 操作员, I want 3D 视口轨道旋转、平移、缩放, so that 能检查盖楼的层数和遮挡。
39. As an 操作员, I want 导航与绘制不必拆成两个互斥网址, so that Unity 式工具栏即可切换当前工具。
40. As an 操作员, I want 右键或删除键去掉命中的图元, so that 和旧工具的手感连续。
41. As an 操作员, I want 嵌套图形时点选优先更小的封闭区域, so that 圆环里的小圆能点到。
42. As an 操作员, I want 空说明书时有网格和坐标轴, so that 知道原点在哪。
43. As an 开源贡献者, I want 仓库是 MIT, so that 可以嵌进商业课件流水线。
44. As an 开源贡献者, I want 不出现账号、云同步、短链后台, so that 这个工具保持可自托管的静态页。
45. As an 操作员, I want 旧三个 HTML 助手的 z-up 体素习惯不要出现在新说明书里, so that 不必记两套轴。

## Implementation Decisions

- 单一 Vue 3 应用，Vite 构建，TypeScript 严格。壳：Reka UI + Tailwind + vue-i18n。浏览器侧文件/剪贴板/键盘/语言探测优先 VueUse。
- 许可证 MIT。
- 说明书是唯一真源。Pinia 两块：`document`（当前说明书 + undo/redo 快照；垫图 URL 与对齐作为说明书字段）和 `editor`（当前工具、选中、格）。不拆视口 store、历史 store、图元 store。
- 视口是命令式投影器，不是声明式图形树：2D 用 Konva，3D 用 Three.js。各提供 `render(说明书)` 与 `setPreview(手势)`。不用 vue-konva 图元树，不用 TresJS。
- 手势进行中只改预览层；pointerup 或闭合图形时对说明书做一次不可变替换。Undo 按快照，一次手势一步。
- 几何计算第一期为对着说明书字段的纯函数（吸附、命中、包围盒）。不引入 Euclid / JSXGraph / Clipper。
- 说明书用一份 Zod schema 同时得到运行时校验和 TypeScript 类型。打开文件、解析 hash、导入都 `safeParse`，失败则拒绝并说明。
- 分享链接：说明书 JSON → lz-string `compressToEncodedURIComponent` → URL hash。无服务器。
- 一份说明书一个空间，字段 `space: "2d" | "3d"`。切换空间若已有图元，必须确认清空或拒绝，禁止静默转换。
- 坐标：2D `(x,y)` Y 向上；3D `(x,y,z)` Y 为高度，地面在 XZ。角度为度，0° 为 +X，逆时针为正（与旧曲线工具一致，仅 3D 高度轴不沿用旧 z-up）。
- 2D 格默认 1，可切 1/2；修饰键暂时关闭吸附。3D 体素只整数。
- 图元 `type` 封闭名单（避免旧工具里 `segment` 既是线段又是弓形）：
  - 2D：`line`（线段）、`polygon`、`circle`、`sector`、`bow`（弓形）、`arc`、`ring`、`ellipse`（轴对齐）、`label`（点名）
  - 3D：`voxel`（单位立方体，坐标为左下后角或中心须在 schema 注释中写死一种：采用立方体占 `[x,x+1] × [y,y+1] × [z,z+1]`，整数格点为角）
- 封闭 2D 图元带 `fill: "none" | "solid" | "hatch"`。`line` / `arc` / `label` 无填充。
- 每条图元有稳定 `id`（创建时生成）。列表、选中、删除按 id。
- 垫图字段属于说明书但不进入 Prompt：`underlay: { url?: string, opacity, x, y, scale } | null`。`url` 仅 http(s)。本地文件垫图只活在本机会话，不进分享链接。
- Prompt 是纯函数 `说明书 → string`，含图元语法说明、坐标约定、以及 `S = { ... }` 列表。
- 界面默认语言：浏览器 `zh*` → 中文，`en*` → 英文，其余中文。说明书键名永不本地化。
- 测试缝只有说明书模块（schema、更新、undo、Prompt、hash 往返、吸附与命中纯函数）。不把 Konva/Three/Reka 当单测缝。

建议的说明书形状（契约，不是文件路径）：

```ts
// 概念形状，以 Zod 为准
type Document = {
  version: 1
  space: '2d' | '3d'
  underlay: null | { url?: string; opacity: number; x: number; y: number; scale: number }
  primitives: Primitive[]
}
```

## Testing Decisions

- 只测外部行为：给说明书（或 JSON 字符串、hash），断言得到的说明书 / Prompt / 拒绝原因。不测 Konva 节点、Three mesh、组件内部状态。
- 被测模块：说明书 Zod schema；对说明书的不可变更新（添加、删除、改属性、undo/redo）；Prompt 生成；lz-string hash 往返；2D 吸附纯函数；点选命中纯函数（含嵌套取较小封闭图元）。
- 仓库从空开始，没有既有测试可抄；测试与 schema 放在同一说明书模块旁，随契约变而变。
- 打开非法 JSON、未知 `type`、2D 图元放进 `space: "3d"` 必须失败。
- 同一份说明书两次生成 Prompt 必须字符串相等。

## Out of Scope

第一期不做（见 `docs/todo.md`）：

- 圆柱 / 圆锥 / 剖切 / 水面
- Clipper2 多边形布尔
- 七巧板、钉板、小棒等教具盒
- 约束几何
- 旋转、翻折等时间轴
- 一份说明书里 2D+3D 图元共存
- 绑定 Geometry Studio 课件字段
- 账号、自建云文档、短链后台（永远不做）
- 老师/学生教具沙盘
- 产出课件 HTML 本身
- vue-konva 声明式图元树、TresJS
- 用 Three 正交相机兼做 2D 编辑器

## Further Notes

- 旧助手 URL 仅作手感参考，新 IR 不兼容其 z-up 与三套互不相同的 Prompt 方言；Prompt 语法在第一期重新规定并写进导出文本。
- 开源调研见 `docs/research-oss-geometry-editors.md`：不嵌入 Polypad / GeoGebra / tldraw 当内核。
- 下一步按 `/to-tickets` 拆成可独立演示的竖切票，从说明书缝的测试开始。
