# 可停靠编辑器壳与 3D 参数体

**Status:** ready-for-agent

把编辑器从固定三栏改成可停靠分块，并补上选择工具下的变换/控制点，以及 3D 参数体。词表见根目录 `CONTEXT.md`，硬决定见 `docs/adr/0014`–`0016` 及既有 ADR。本 spec 叠在已落地的第一期编辑器之上，不推翻说明书为真源。

## Problem Statement

操作员现在的壳是写死的：创建图元挤在顶栏纯文字按钮里，左侧是对象列表，右侧把选中属性、垫图、JSON 堆在一起。面板不能拖。选择工具只能点选，不能平移/旋转/缩放，也不能拖控制点。3D 只有体素，盖不住小学里常见的长方体、圆柱、圆锥、球、棱锥、棱柱。手搓一套 Unity 式分块布局太重。

## Solution

用 `dockview-vue` 做五块可停靠面板（工具箱、对象列表、视口、属性面板、垫图）。工具箱用图标+名称列出当前空间的工具。选择工具选中后同时出现变换手柄和控制点，命中从专到整。属性面板只编辑当前选中图元。3D 封闭名单扩为体素加参数体；参数体单击落下默认尺寸，位置与旋转按已拍板约定写入说明书几何。布局只存在本机 `useLocalStorage`。

## User Stories

1. As an 操作员, I want 可创建的图元以图标加名称出现在工具箱, so that 不必在顶栏一排文字按钮里找。
2. As an 操作员, I want 工具箱和对象列表是两块独立面板, so that 「接下来画什么」和「已经画了什么」不会混在一个列表里。
3. As an 操作员, I want 在 2D 工具箱里看到选择与第一期平面图元, so that 切换空间后创建项是对的。
4. As an 操作员, I want 在 3D 工具箱里看到选择、体素、长方体、圆柱、圆锥、球、四棱锥、三棱柱, so that 立体题不必只靠堆方块。
5. As an 操作员, I want 点工具箱一项即切换当前工具, so that 鼠标在视口里的含义是明确的。
6. As an 操作员, I want 从 2D 切到 3D 时若拿着 2D 创建工具则回到选择, so that 不会拿着「圆」对着体素格点空。
7. As an 操作员, I want 选择工具下点图元即选中它, so that 后续手柄、控制点、属性面板有对象。
8. As an 操作员, I want 视口、对象列表、属性面板共用同一条选中, so that 三处不会各指各的。
9. As an 操作员, I want 同时最多选中一条图元, so that 属性面板不会对多选含糊其辞。
10. As an 操作员, I want 点空白处取消选中, so that 可以停手。
11. As an 操作员, I want 选中后在对象列表里看到该项被标出, so that 嵌套或重叠时知道选的是谁。
12. As an 操作员, I want 选中后视口里能看出哪一条被选中, so that 不必只靠对象列表确认。
13. As an 操作员, I want 属性面板只显示当前选中图元的字段, so that 右侧是在标记这块图形，而不是整份说明书。
14. As an 操作员, I want 未选中时属性面板为空状态, so that 不会误改别人的字段。
15. As an 操作员, I want 在属性面板改数字即写入说明书, so that 和视口里拖是同一份真源。
16. As an 操作员, I want 垫图不出现在属性面板里, so that 选中一条线时不会看到题图透明度。
17. As an 操作员, I want 垫图是独立可停靠面板, so that 对齐题图时能一边看视口一边改透明度/位移/缩放。
18. As an 操作员, I want 默认 JSON 调试输出不再占属性面板, so that 生产界面不被契约原文挤满。
19. As an 操作员, I want 五块面板能并排、改大小、叠成标签, so that 可以按自己的习惯摆编辑器。
20. As an 操作员, I want 拖面板时只在停靠区内落位, so that 第一期不必和浮窗、弹出浏览器窗口搏斗。
21. As an 操作员, I want 出厂布局为左工具箱在上、对象列表在下，中视口，右属性在上、垫图在下, so that 第一次打开就接近 Unity 壳。
22. As an 操作员, I want 顶栏不进停靠区, so that 2D/3D、文件、撤销、格、分享、语言始终找得到。
23. As an 操作员, I want 本机记住我拖过的布局, so that 下次打开还是我的摆法。
24. As an 操作员, I want 布局不进说明书、不进分享链接, so that 同事打开链接只看到几何，看不到我的面板。
25. As an 操作员, I want 一键恢复默认布局, so that 拖乱了能回来。
26. As an 操作员, I want 读到损坏的布局数据时回到出厂, so that 坏掉的 localStorage 不会让编辑器空白。
27. As an 操作员, I want 视口永远不能关掉, so that 不会把画画的地方关没。
28. As an 操作员, I want 关掉工具箱、对象列表、属性面板或垫图, so that 小屏幕上可以腾地方给视口。
29. As an 操作员, I want 从顶栏勾选把关掉的面板再打开, so that 不必整页恢复默认。
30. As an 操作员, I want 选择工具下拖图元本体即平移整图元, so that 不必删了重画。
31. As an 操作员, I want 拖旋转柄旋转 2D 图元或 3D 参数体, so that 朝向能进说明书。
32. As an 操作员, I want 拖缩放柄缩放 2D 图元或 3D 参数体, so that 尺寸能进说明书。
33. As an 操作员, I want 圆被缩放时仍是圆（只等比）, so that 说明书里不会出现「扁的圆」。
34. As an 操作员, I want 椭圆可以旋转, so that 不再被锁死成轴对齐。
35. As an 操作员, I want 扇、弓、弧绕圆心旋转时改起止角, so that 变换仍是说明书里的几何字段。
36. As an 操作员, I want 选中后看到控制点, so that 能改端点、圆心、半径、起止角、多边形顶点、参数体尺寸，而不只是整体框。
37. As an 操作员, I want 指针在控制点上时只改那一处几何, so that 拖半径不会变成缩放整圆。
38. As an 操作员, I want 命中顺序为控制点优先于旋转/缩放柄、再才是拖本体, so that 密集控件不会抢错手势。
39. As an 操作员, I want 指针悬停在不同控件上时光标跟着变, so that 不必先切「移动/旋转/缩放」工具。
40. As an 操作员, I want 手势中只看到预览、松手才写入说明书, so that Undo 仍是一次手势一步。
41. As an 操作员, I want 体素在选择工具下点选、删除、拖到另一整数格, so that 已放的块能挪，而不只是删了重放。
42. As an 操作员, I want 3D 选择工具不放置新体素, so that 点选和创建不再抢左键。
43. As an 操作员, I want 3D 创建工具「单位立方体」点格才放一块, so that 堆叠仍然快。
44. As an 操作员, I want 体素没有旋转、缩放、控制点, so that 单位立方体语义不被拉扁。
45. As an 操作员, I want 单击放置参数体时落下默认尺寸, so that 轨道相机里不必拖出三维尺寸。
46. As an 操作员, I want 长方体默认 1×1×1、圆柱/圆锥半径 0.5 高 1、球半径 0.5、四棱锥底 1×1 高 1、三棱柱底边 1 高 1, so that 落下即可看见。
47. As an 操作员, I want 站立参数体的位置是底面中心、高沿 +Y, so that 「放在桌上」和说明书字段一致。
48. As an 操作员, I want 球的位置是球心, so that 半径题不必再减半高。
49. As an 操作员, I want 体素位置仍是最小角, so that 旧说明书和 Prompt 约定不改。
50. As an 操作员, I want 参数体旋转记三个欧拉角（度）、顺序 Y→X→Z, so that Agent 能看懂朝向，且能把圆柱放倒。
51. As an 操作员, I want 未旋转的参数体底面朝下站着, so that 三个角为 0 就是默认姿态。
52. As an 操作员, I want 四棱锥默认正方形底、拉开可变成长方形底, so that 不必单独一种「矩形底棱锥」。
53. As an 操作员, I want 三棱柱默认正三角形底、拉开可变成一般三角形, so that 体积题里的斜底也能画。
54. As an 操作员, I want 同一份 3D 说明书里体素和参数体能共存, so that 盖楼可以配一根圆柱。
55. As an 操作员, I want 2D 图元与参数体都吃当前格（1 / 1/2 / 关）, so that 半格立体也能对齐垫图。
56. As an 操作员, I want 体素永远落整数格，不理 1/2 和「关」, so that 说明书里不会出现半格体素。
57. As an 操作员, I want Alt 临时关吸附对 2D 和参数体有效、对体素无效, so that 修饰键不会写出非法体素。
58. As an 操作员, I want 格开关留在顶栏, so that 它不是一种图元，不进工具箱。
59. As an 操作员, I want 3D 中键/右键拖仍是转镜头, so that 创建和导航不打架。
60. As an 操作员, I want 打开旧的无 `rotationDeg` 椭圆说明书时当作 0°, so that 已有文件还能打开。
61. As an Agent, I want 新 3D 类型和椭圆旋转都写在浅层英文 JSON 里, so that 不必解一层矩阵。
62. As an Agent, I want Prompt 列出参数体语法、底面中心/球心/体素最小角、欧拉角顺序, so that 复原时轴和锚点不错。
63. As an 操作员, I want 分享链接仍只压说明书, so that 面板布局不会污染 hash。
64. As an 开源贡献者, I want 停靠用现成库而不是手写拖放, so that 分块布局可维护。

## Implementation Decisions

- 停靠库：`dockview-vue`（MIT）。Reka UI 仍管按钮、对话框、无头控件。视口仍是 Konva / Three 命令式投影器，不进 CSS 框架。见 ADR 0014。
- 面板五块：工具箱、对象列表、视口、属性面板、垫图。出厂：左列上工具箱下对象列表，中视口，右列上属性下垫图。只允许停靠区内并排/改大小/叠标签；无页内浮窗、无弹出浏览器窗口。
- 顶栏是整页铬：标题、空间切换、打开/保存、撤销/重做、格、分享/Prompt、语言、面板显隐勾选、恢复默认布局。
- 布局快照用 VueUse `useLocalStorage`。不进说明书、不进分享链接。损坏或无法解析则回出厂。视口不可从布局里移除；若快照缺视口，打开时补回。
- Pinia 仍只有 `document` 与 `editor`。面板显隐与当前工具、选中、格留在 `editor`。不新增 layout store。
- 工具：`select` 与创建工具互斥。2D 创建名单保持第一期平面图元。3D 创建名单：`voxel`、`box`、`cylinder`、`cone`、`sphere`、`pyramid`、`triangularPrism`。`toolsForSpace(space)` 为纯函数。
- 选择工具手势与创建手势分开。选择模式命中顺序：控制点 → 旋转/缩放柄 → 图元本体。未命中则取消选中（左键空白）。3D 选择模式左键不调用放置体素。
- 变换与控制点写入说明书几何，不另做 transform 矩阵。见 ADR 0015。椭圆加 `rotationDeg`（缺省 0）。圆只等比缩放。扇/弓/弧绕圆心改 `startDeg`/`endDeg`。
- 3D 参数体见 ADR 0016。站立体位置为底面中心 `(x,y,z)`，`y` 为底面高度，高沿 +Y。球为球心。体素仍为最小角整数。旋转字段 `rotationDegY`、`rotationDegX`、`rotationDegZ`，度，合成顺序 Y→X→Z；球与体素无旋转字段。
- 概念形状（契约以 Zod 为准；旧椭圆无旋转角时按 0 解析）：

```ts
type Box = {
  id: string
  type: "box"
  x: number
  y: number
  z: number
  width: number // X
  depth: number // Z
  height: number // Y
  rotationDegY: number
  rotationDegX: number
  rotationDegZ: number
}
type Cylinder = {
  id: string
  type: "cylinder"
  x: number
  y: number
  z: number
  r: number
  height: number
  rotationDegY: number
  rotationDegX: number
  rotationDegZ: number
}
type Cone = Cylinder & { type: "cone" }
type Sphere = {
  id: string
  type: "sphere"
  x: number
  y: number
  z: number
  r: number
}
type Pyramid = {
  id: string
  type: "pyramid"
  x: number
  y: number
  z: number
  width: number
  depth: number
  height: number
  rotationDegY: number
  rotationDegX: number
  rotationDegZ: number
}
type TriangularPrism = {
  id: string
  type: "triangularPrism"
  x: number
  y: number
  z: number
  height: number
  base: [{ x: number; z: number }, { x: number; z: number }, { x: number; z: number }]
  rotationDegY: number
  rotationDegX: number
  rotationDegZ: number
}
```

- 三棱柱 `base` 三个点在底面局部 XZ，默认正三角形、形心在原点。四棱锥默认 `width === depth`。单击放置的默认尺寸：box 1×1×1；cylinder/cone `r=0.5` `height=1`；sphere `r=0.5`；pyramid 底 1×1 高 1；triangularPrism 高 1、底边 1 的正三角。
- 格：`editor.grid` 同时约束 2D 与参数体。体素路径继续 `snapVoxel`，忽略非整数格与「关」。Alt 对体素无效。
- 3D 参数体创建：选择创建工具后单击落点（吸附后）提交一次 `addPrimitive`。预览跟随指针，松手前不写说明书。体素创建保持点格放置。
- 属性面板按选中图元的 type 展示可编辑字段（含 id/type 只读或可复制，几何数字可改）。垫图面板沿用现有垫图能力，只是从属性列拆出。
- Prompt / hash / 打开保存继续以说明书为唯一输入。Prompt 的 conventions 与 syntax 必须覆盖新类型与锚点/欧拉角。
- 测试缝优先已有两处，不新增第三套架构：
  1. **说明书模块**（已有）：Zod、不可变更新、命中、吸附、Prompt、hash 往返。变换/控制点的「世界坐标提交」作为对着图元的纯函数落在这里。
  2. **选择手势模块**（沿用绘制手势那种纯函数）：输入当前工具、选中、指针世界坐标、视口变换、格，输出预览与至多一次 commit。不测 Konva/Three/dockview 的拖放引擎。
- 工具目录与出厂布局是纯数据：`toolsForSpace`、默认布局快照、坏快照回出厂。不把 dockview 组件当单测缝。壳层可用现有「读源码断言关键装配」的弱测试补 dockview 已接入、五块面板 id 存在。

## Testing Decisions

- 只测外部行为：给说明书或手势输入，断言得到的说明书、拒绝原因、Prompt、预览/提交。不测 dockview 内部 DnD、不测 Konva 节点、不测 Three mesh、不测 localStorage 驱动细节（测「坏字符串 → 出厂快照」的纯函数即可）。
- 被测模块：说明书 Zod（新 3D 类型、椭圆 `rotationDeg` 缺省、2D 类型不得进入 3D 名单之外、体素仍拒绝非整数）；`updatePrimitive` 写入平移/旋转/缩放/控制点之后仍能 parse；命中（含参数体）；吸附（参数体吃 1/1/2/off，体素锁整数）；Prompt 含新语法且同一说明书两次生成相等；hash 往返；选择手势命中顺序（控制点 vs 柄 vs 本体）与一次 pointerup 一次 commit；`toolsForSpace`；布局快照校验。
- 既有先例：说明书旁的 `*.test.ts`；`draw-gesture.test.ts` 的预览后提交；`app-shell.test.ts` 对壳装配的源码断言。新手势测试抄绘制手势，不抄组件挂载。
- 旧椭圆 JSON 无 `rotationDeg` 必须仍打开成功且值为 0。
- 体素不得因格设为 1/2 或 off 而写出非整数角。

## Out of Scope

- 页内浮窗、弹出浏览器窗口
- 多选
- 独立的移动/旋转/缩放工具（不做 Unity QWER）
- 3D 体素的旋转、缩放、控制点
- 通用 transform 矩阵层
- 剖切、水面、教具盒、约束几何、时间轴
- 一份说明书里 2D+3D 图元共存
- 账号、云、短链后台
- 产出课件本身
- 手写停靠引擎、Golden Layout
- 把 JSON 原文调试器做成第六块面板（需要时用保存文件 / Prompt）

## Further Notes

- 原 `.scratch/geometry-editor/spec.md` 仍描述已落地的第一期。其中「轴对齐椭圆」「3D 只有体素」「测试缝只有说明书模块」被本 spec 与 ADR 0014–0016 局部取代；冲突时以本 spec 与更新后的 `CONTEXT.md` / `docs/todo.md` 为准。
- 下一站是 `/to-tickets`：把本 spec 拆成带阻塞边的 tracer-bullet，每张票一个新会话 `/implement`。
