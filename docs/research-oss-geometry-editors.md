# 小学几何出题助手：开源 / 可嵌入工具调研

- 日期：2026-08-21
- 范围：小学 4–6 年级几何**出题**辅助（不是学生端游戏本身）
- 下游：约 557 个 AI 生成的交互几何游戏（p5.js 2D + three.js 3D）
- 痛点：AI 很难从题目图还原图形；现有 3 个单文件 HTML 助手可手工标图并导出结构化 prompt
- 计划栈：Vue 3 + VueUse + TypeScript + Reka UI
- 本文性质：**对比调研，不是选型推销**。不实现产品代码。

## 1. 结论摘要（先读这一节）

没有一个现成开源产品能同时覆盖：整数线段、圆/扇/弓/环/椭圆/多边形、体素单位立方、七巧板/图案积木/钉板/展开图/小棒，并且导出 **LLM 可稳定还原成 p5/three 的 IR**。

| 角色 | 建议 | 原因 |
|------|------|------|
| 出题助手内核 | **自研编辑器 + 自有 JSON IR** | 现有 3 个 helper 的语义已经对（整数坐标、函数式图元、体素集合），缺的是 UX 与可维护性 |
| UI 壳 | Vue 3 + VueUse + TS + Reka UI | 与团队计划一致；Reka 只管面板/对话框，不管画布 |
| 2D 画布 | **Konva + vue-konva**（MIT） | 官方 Vue 绑定、对象模型、拖拽/变换、`toJSON`、snap 可自写；不是数学内核 |
| 2D 几何计算（可选） | `@mathigon/euclid`（MIT） | 点/线/圆/多边形/交点；**不是** Polypad 编辑器 |
| 2D 布尔（环、拼合、展开图） | **Clipper2**（BSL-1.0）或 `polygon-clipping`（MIT） | Paper.js 布尔对贝塞尔更合适，小学多边形用整数 Clipper 更稳 |
| 3D 单位立方 | **自研体素网格 + three.js**（MIT） | MagicaVoxel / Blockbench / voxel.js 都不适合当嵌入式出题 IR |
| 约束动态几何（后期可选） | JSXGraph（LGPL **或** MIT） | 小学 4–6 多数题不需要约束；不要当主编辑器 |
| 教具 UX 参考 | Polypad **只看交互，不要当内核** | 教具最全，但 **非开源**，Amplify 商用限制明确 |
| 明确不要当内核 | GeoGebra、Desmos、tldraw、Cinderella/Cabri、几何画板、网络画板 | 许可证、闭源、或领域不对 |

**一句话：** 用 Vue 重建三个助手是合理路径；开源界能借的是 **画布引擎 + 几何/布尔库 + 交互参考**，不是完整「几何画板产品」。LLM 需要的 IR 必须自己定义，且要比 GeoGebra/Desmos 的不透明 state 更浅。

---

## 2. 现有三件套与目标 IR

当前自定义 helper（团队描述，本文未改代码）：

1. **2D 整数线段编辑器**：网格吸附，导出  
   `S = { (x1,y1)→(x2,y2); ... }`
2. **2D 曲线/形状编辑器**：圆、扇形、弓形、弧、圆环、轴对齐椭圆、多边形；函数语法导出
3. **3D 体素/单位立方编辑器**：Minecraft 式堆叠，导出  
   `S = { (x,y,z), ... }`，`z` 为高度

下游约束：

- 最终游戏是 **p5.js / three.js**，不是 GeoGebra applet
- IR 必须能被 LLM **确定性还原**（坐标整数、图元类型有限、少依赖闭包/约束图）
- 教具（七巧板、图案积木、钉板、瓷砖、展开图、小棒、立方体）是「任意绘制」诉求，但小学题里多数仍是 **离散积木 + 整数格**，不是自由矢量涂鸦

因此评估标准不是「像不像专业 DGS」，而是：

1. 许可证能否用于**商业教育产品**
2. 能否嵌进 Vue 应用（组件或薄封装，而不是 iframe 黑盒）
3. 2D / 3D
4. 网格吸附与数学坐标（不是像素涂鸦）
5. 标签与度量
6. 教具 / 学具
7. 导出结构化数据 vs 仅图片
8. 作为 LLM IR 的适合度
9. Footgun（太重、不开源、领域错、许可证陷阱）

---

## 3. 总对比（出题助手视角）

评分含义：适合度是针对「小学几何出题 IR」，不是软件综合质量。

| 候选 | 许可证 | Vue 嵌入 | 2D/3D | 网格/数学坐标 | 标签度量 | 教具 | 结构化导出 | LLM-IR | 主要 footgun |
|------|--------|----------|-------|---------------|----------|------|------------|--------|--------------|
| **自研 + Konva + three** | 可控（依赖 MIT） | 原生 | 2D+3D | 自控 | 自控 | 自建图元 | 自控 JSON | **最好** | 要自己做 UX |
| Mathigon **Polypad** | **专有**；非商用为主 | JS API / iframe | 2D（有 solids 图块） | 有格/钉 | 测量工具 | **最强** | JSON tiles+strokes | 中：图块语义好，但依赖 Amplify schema | 商用/付费墙/自托管受限 |
| **JSXGraph** | **LGPL 或 MIT** | script，可包 Vue | 2D + View3D | boundingbox、snapToGrid | Label/Measurement/Tapemeasure | 弱 | Dump JSON / JessieCode / JS | 中高：图元丰富，约束图对 LLM 偏深 | 3D 非体素；API 老派 |
| **GeoGebra** | 源码 EUPL；**产品非商用** | deployggb.js | 2D+3D | 强 | 强 | 弱（不是积木盘） | getFileJSON / XML / ggb | 低：state 不透明、过重 | **商业教育产品必须谈授权** |
| **tldraw** | 源码可见，**非 OSI 开源**；生产要 license key | 官方 Vue 模板（底层 React） | 2D | 像素无限画布 | 弱 | 无 | snapshot JSON | 低 | 生产许可；数学坐标差 |
| **Excalidraw** | MIT | npm，**React** | 2D | 手绘风格 | 弱 | 无（可 shape library） | `.excalidraw` JSON | 低 | 手绘≠几何；Vue 不匹配 |
| **Desmos Geometry** | 专有；API key / 合作 | script embed | 2D（另有 3D 计算器） | 强 | 强 | 无 | getState **不透明** | 低 | 非开源；state 禁止手改 |
| **CindyJS** | Apache-2.0 | script | 2D（CindyGL 3D 着色） | 约束几何 | 有 | 无 | 构造 JSON + CindyScript | 低中 | 大学 DGS；CindyScript |
| Cinderella / Cabri | 专有 | 差 | 2D（Cabri 3D 另售） | 强 | 强 | 无 | 专有文件 | 低 | 闭源、过时分发 |
| three.js editor | MIT（three 本体） | 可抄源码，非组件 | 3D 网格 | 世界坐标，非体素格 | 无小学度量 | 无 | 场景 JSON | 低 | 通用 3D，不是单位立方 |
| MagicaVoxel | **免费闭源工具** | 不可嵌入 | 体素 | 体素格 | 无 | 无 | `.vox` | 中（若只当离线编辑） | 不能进 Vue |
| Blockbench | **GPL-3.0** | 不适合当库 | 低模 3D | Minecraft 格式 | 无 | 无 | 多种模型格式 | 低 | GPL 传染；领域是游戏资产 |
| voxel.js | MIT（生态已死） | 理论可以 | 体素游戏 | 体素 | 无 | 无 | 各模块自定 | 低 | 停更 |
| Goxel | **GPL-3.0** | 否 | 体素 | 体素 | 无 | 无 | VOX/OBJ 等 | 低 | GPL；非 Web 组件 |
| fabric.js | MIT | 可包 | 2D | 像素对象 | 文本 | 无 | `toJSON` / SVG | 中低 | 无数学格；Vue 非官方 |
| paper.js | MIT | 可包 | 2D 矢量 | 矢量 | 弱 | 无 | JSON 项目 | 中低 | 布尔慢/脆；非对象编辑器 |
| **Konva** | MIT | **vue-konva 官方** | 2D | 自写 snap | 自写 | 自写 | `stage.toJSON()` | **高（配合自有 schema）** | 不是几何库 |
| PixiJS | MIT | 社区 Vue | 2D GPU | 游戏坐标 | 无 | 无 | 无标准几何 JSON | 低 | 渲染器，不是编辑器 |
| 几何画板 / 网络画板 / 希沃 | 专有 | PPT/白板生态 | 2D | 强 | 强 | 弱到中 | 专有 | 低 | 无法合法当内核 |

---

## 4. 逐个候选（第一手来源）

### 4.1 Mathigon Polypad（Amplify）

**官方入口**

- 产品：<https://mathigon.org/>（声明 Polypad 已迁至 Amplify）
- FAQ：<https://polypad.amplify.com/faqs>
- API 文档：<https://mathigon.io/polypad/>
- 使用指南：<https://amplify.com/dc-usage-guidelines/>
- Mathigon 开源库组织：<https://github.com/mathigon>（**没有 Polypad 源码仓库**）

**开源吗？**

- **Polypad 本身不是开源产品。** GitHub 上 Mathigon 开源的是课程与库：`euclid.js`、`fermat.js`、`studio`、`textbooks` 等。
- 教科书仓库声明 `© Mathigon 2016–2022, All rights reserved`（见 [mathigon/textbooks](https://github.com/mathigon/textbooks) README）。
- `@mathigon/euclid` 是 **MIT** 的 2D 几何类库，不是积木画布。

**许可证 / 商用**

FAQ 原文（2024 迁域后仍有效）：

> You can only use Polypad for non-commercial purposes: this includes in schools or universities, for educational research, or embedding on personal blogs and websites.  
> If you want to use Polypad for something else, visit Amplify usage guidelines.

Amplify *Classroom and Polypad Free and Commercial Use Guidelines* 更细：

- 个人/学校教学嵌入 Polypad：**允许**
- **营利组织**嵌入且 **>1 万次请求/年**：**必须联系**
- Polypad 链接/截图/iframe/API **放在付费墙后**：**必须联系**
- 把 JS **白标、自托管、复杂集成进更大应用**：**必须联系**
- EdTech / 教育出版商使用或链接 Amplify Classroom 内容与工具：**必须联系**
- 允许路径：iframe（Amplify 托管）或 **带 API Key 的 JS API**（文档称可 self-host；指南又把「在自有基础设施托管 Amplify JS」列为需审批）

Mathigon 首页仍写：向其他组织 **授权技术和内容**，联系 `support@mathigon.org`。

**嵌入与 API**

`Polypad.create(el, options)`，脚本形如  
`https://static.mathigon.org/api/polypad-en-v5.0.5.js`（另有 `cn` 等 locale bundle）。

可序列化 schema（官方 TypeScript 接口）：

- `tiles: Record<id, TileData>`：`name, x, y, rot, color, isFlipped, status, labels, ...`
- `strokes: Record<id, StrokeData>`：`points` 为 SVG path 或几何表达式
- `options.grid`：方格、点阵、三角格等
- 实例方法：`serialize` / `unSerialize` / `add` / `update` / `image` / `setTool`

侧栏图块包括：`geometry, polygons, polyominoes, tangram, penrose, solids, measuring, patterns, number-tiles, fraction-circles, algebra, ...` —— 这是调研范围内 **最接近「小学教具盘」** 的产品。

**2D/3D、吸附、度量、教具**

- 主体 2D 画布；`solids` 是 3D 图块式学具，不是体素编辑器
- 网格/钉板、吸附、测量工具齐全
- 七巧板、多连方、图案、分数圆、数轴等 **一等公民**

**导出与 LLM-IR**

- JSON 比截图好得多：图块类型 + 位姿
- 对 LLM：tangram/polyomino 很好还原；自由 `strokes`（SVG path）仍然难
- schema 受 Amplify 版本绑定；`tiles`/`strokes` 默认上限约 2000
- **不能**当作你们自己的稳定 IR：许可证不允许把 Polypad 当商业产品内核（未经授权）

**Footgun**

- 领域最对，法律最不对
- 依赖 Amplify CDN / API Key；产品已并入 Amplify/Desmos Classroom
- 中文 bundle 存在（locale `cn`），但是 **产品中文 ≠ 可商用嵌入**
- 不要把「Mathigon 开源库」和「Polypad」混为一谈

**若只借鉴 UX：** 侧栏分类、网格模式、图块 merge/split、测量尺，都值得抄交互，不要抄二进制/API。

---

### 4.2 JSXGraph

**来源**

- 仓库：<https://github.com/jsxgraph/jsxgraph>
- 站点：<https://jsxgraph.org/>
- 文档：<https://jsxgraph.uni-bayreuth.de/docs/>
- View3D：<https://jsxgraph.uni-bayreuth.de/docs/symbols/View3D.html>
- Dump：<https://jsxgraph.uni-bayreuth.de/docs/symbols/JXG.Dump.html>
- npm/CDN：`jsxgraphcore.js` + `jsxgraph.css`

**许可证**

官方 README：

> JSXGraph is free software dual licensed under the GNU LGPL or MIT License.

商业闭源产品可选 **MIT** 条款，这是调研里少数「真·可商用 DGS 内核」。

**嵌入 Vue**

无官方 Vue 组件，但是普通 JS 库：`JXG.JSXGraph.initBoard('div-id', { boundingbox: [-8,8,8,-8] })`。在 Vue 里 `onMounted` 初始化、`onBeforeUnmount` 销毁即可。体积相对小，无插件依赖。

**图元与约束**

2D 元素（文档 Class Index）包括：Point, Line, Segment, Circle, Arc, Sector, Ellipse, Polygon, RegularPolygon, Angle, Intersection, Midpoint, Parallel, Perpendicular, Glider, Slider, Tapemeasure, Measurement, Label, Text, CurveUnion / CurveIntersection / CurveDifference 等。

这是 **动态几何（DGS）**：子对象随父对象约束更新。小学出题多数只要静态整数图，约束是能力也是复杂度。

**3D**

`board.create('view3d', [[x,y],[w,h], [[x1,x2],[y1,y2],[z1,z2]]])`。有 Point3D, Line3D, Plane3D, Sphere3D, Polygon3D, Polyhedron3D, Functiongraph3D 等。投影 `parallel` / `central`。这是 **连续 3D 几何**，不是单位立方堆叠。文档还建议关闭 board pan，否则触摸旋转冲突。

**吸附、坐标、度量**

- `boundingbox` 用户坐标
- 元素属性 `snapToGrid`、`handleSnapToGrid`、`snapToPoints`
- Label / Measurement / Tapemeasure / Smartlabel

**教具**

没有七巧板盘。可用 RegularPolygon + 变换硬拼，UX 远差于 Polypad。

**导出**

`JXG.Dump`：

- `toJSON(board)`
- `toJavaScript(board)`
- `toJessie(board)`（JessieCode）

JSON 是构造序列，含依赖，不是你们现在的 `S = { segments }` 那么浅。

**LLM-IR**

- 优点：图元与 p5 接近（circle, segment, polygon, arc）
- 缺点：约束、函数父元素、3D 投影参数会让 LLM 胡编 JessieCode
- 若只用「自由点 + 线段/圆/多边形」、禁止 glider/交点依赖，可当内部引擎，但仍要 **再导出一层浅 IR**

**Footgun**

- API 是 2008–2010 风格（`var board`），和 Vue/TS 文化摩擦
- 3D 不能替代体素助手
- 把 JSXGraph 当「万能画板」会做出学生端 GeoGebra，而不是出题 IR 工具

---

### 4.3 GeoGebra

**来源**

- 许可证：<https://www.geogebra.org/license>（文中写 2025-11 更新）
- 嵌入：<https://geogebra.github.io/docs/reference/en/GeoGebra_Apps_Embedding/>
- Apps API：<https://geogebra.github.io/docs/reference/en/GeoGebra_Apps_API/>
- 源码：<https://github.com/geogebra/geogebra>
- 示例：<https://github.com/geogebra/integration>

**许可证（商业教育产品的红线）**

官方区分三层：

1. **源码**：EUPL v1.2（相对宽松，允许衍生；与 GPL 互操作复杂）
2. **安装包、Web 服务、Materials 平台**：GeoGebra 自有条款，**仅非商用**
3. **语言包 / UI 图 / 文档**：CC BY-NC-SA 4.0

关键句：

> Any use of GeoGebra for a commercial purpose is subject to and requires a special license. Contact office@geogebra.org.

「商用」按 **用途** 不按「是不是学校」：

- 用 GeoGebra **生成/开发将收费或用于商业优势的教育资源**
- 在非学术 ebook / 教材中使用
- 用它获取广告或赞助收入

FAQ 明确：完整程序 **不会被开源社区视为 free software**，因为安装包/语言文件限制商用。

若你们的 557 个游戏或出题工具是 **商业教育产品**，默认 **不能** 嵌 GeoGebra 网页应用，除非签 License and Collaboration Agreement。

**嵌入 / API**

```html
<script src="https://www.geogebra.org/apps/deployggb.js"></script>
```

`new GGBApplet({ appName: 'geometry', width, height, showToolBar: true, ... }).inject(el)`  
也有 ES module：`mathApps.create(...).inject(el).getAPI()`。

API 能力很强：`evalCommand`、`getAllObjectNames`、`getCommandString`、`getXcoord`、`getFileJSON` / `setFileJSON`、`getBase64`、`exportSVG`、`getPNGBase64`。有 Geometry / 3D / Graphing 等 app。

离线：下载 Math Apps Bundle，`applet.setHTML5Codebase(...)`。离线分发仍受产品许可证约束。

**2D/3D、吸附、度量、教具**

动态几何 + 代数 + 3D 视图，中小学教师极熟。**不是** 七巧板/图案积木盘。3D 是几何体，不是单位立方计数。

**导出与 LLM-IR**

- `getFileJSON()`：XML + 图片的包装，官方未把它设计成可手改的 IR
- 命令字符串（`Circle(A,B)` 等）对 LLM 友好，但方言、命名、中文命令、版本差异会导致不稳定
- 过重：CAS、电子表格、3D 一并进来

**Footgun**

- 「源码开源」≠「产品可商用嵌入」——国内二次开发最常见的误读
- 体积与品牌绑定（必须标注 Made with GeoGebra®）
- 即便 EUPL 衍生自己的内核，UI 资源是 NC-SA，不能直接用官方皮肤做商业壳

---

### 4.4 tldraw

**来源**

- 文档许可：<https://tldraw.dev/community/license>
- GitHub：<https://github.com/tldraw/tldraw>
- Vue 模板：<https://github.com/tldraw/vue-template>（模板 MIT；SDK 仍是 tldraw license）

**许可证**

官方：

> Under its default terms, the tldraw SDK license permits use **only in development**.  
> To use the tldraw SDK **in production**, you need a trial / commercial / hobby license key.  
> While the tldraw SDK is source available, it is **not permissively licensed** and would not be Open Source by any definition.

Hobby 许可必须保留 “made with tldraw” 水印。Trial 会向 tldraw ping 许可哈希。

**嵌入**

React 18/19 组件 `<Tldraw />`。Vue 只能「逃到 React 根」；官方 vue-template 也这么做。和「Vue 3 + Reka」栈摩擦大。

**画布 UX vs 数学**

无限画布、吸附到形状、压力笔、导出图片——白板一流。

数学不适合处：

- 坐标是画布像素，不是整数网格数学坐标
- 没有圆/扇/弓/环作为数学对象（只有 geo 形状）
- 没有度量、教具、体素
- snapshot JSON 是编辑器 document，不是几何 IR

**Footgun**

- 源码可见造成「开源」错觉
- 生产无 key 不可用
- 为了 UX 引入 React 双运行时，不值得

---

### 4.5 Excalidraw

**来源**

- GitHub：<https://github.com/excalidraw/excalidraw>（README：**MIT**）
- 导出 API：<https://docs.excalidraw.com/docs/@excalidraw/excalidraw/api/utils/export>
- npm：`@excalidraw/excalidraw`（依赖 **React**）

**许可证：** MIT，可商用。

**嵌入：** 官方是 React 组件。Vue 需包装或 iframe。有 `serializeAsJSON`、`.excalidraw` 开放格式、PNG/SVG、shape libraries。

**不适合数学处：**

- 明确「hand-drawn like」
- 椭圆/圆是近似手绘，不是 `circle(cx,cy,r)`
- 无网格数学坐标、无扇形弓形圆环、无 3D
- 元素 JSON 含粗糙度、种子、绑定箭头——LLM 还原成 p5 会走样

**Footgun：** 白板开源标杆，领域是线框/示意图。Shape library 可放七巧板贴图，但那是图片不是可度量多边形。

---

### 4.6 Desmos Geometry

**来源**

- Geometry API：<https://www.desmos.com/api/v1.12/docs/geometry.html>
- 主 API：<https://www.desmos.com/api>
- 申请 key：<https://www.desmos.com/my-api>
- API ToS 入口：<https://www.desmos.com/api-terms>
- Amplify 指南明确：**Desmos Studio 计算器与 Amplify Classroom/Polypad 分开授权**，须联系 Desmos Studio

**许可证：** 专有。嵌入必须 `?apiKey=`。自托管仅 **partners**。

**能力：** `Desmos.Geometry(el, options)`；`getState` / `setState` / `screenshot`；可定制工具条（`authorFeatures`）。点、线、圆、弧、多边形、角等建设式几何，网格与中学课堂 UX 极好。

**导出陷阱（官方原文）：**

> Calculator/geometry states should be treated as **opaque values**. Manipulating states directly may produce a result that cannot be loaded by setState.

这对 LLM-IR 是 **一票否决**：不能当可编辑中间表示。

**Footgun：** 产品优秀；合作与费用未知；3D 是另一套计算器，不是体素；中文课堂常见但不等于可嵌入商用出题流水线。

---

### 4.7 Cinderella / Cabri / 开源替代

**Cinderella** — <https://www.cinderella.de/>

- Java 桌面 DGS；2019-12 公告：新版本将 **免费提供全部功能**，并改善导出到 **CindyJS**
- 仍是 **专有** 软件，不是 OSI 开源
- 大学级射影/双曲几何 + CindyScript + 物理模拟；过重、过时分发（Java）

**Cabri** — 法国 Grenoble 路线，Cabri II Plus / Cabri 3D，**专有**（Cabrilog）。无可用的现代 Web embed 给商业产品。SourceForge 上有古老的 JCabri（GPL、alpha、已死）。

**更接近开源替代的 DGS（都不适合当你们的主 UX）：**

| 软件 | 许可 | 备注 |
|------|------|------|
| [CindyJS](https://github.com/CindyJS/CindyJS) | Apache-2.0 | Cinderella 的 Web 伴侣，见下一节 |
| [JSXGraph](https://github.com/jsxgraph/jsxgraph) | LGPL 或 MIT | 见 4.2 |
| [GNU Dr. Geo](https://github.com/Dynamic-Book/DrGeo) | GPL-3.0 | Smalltalk/Cuis，不是 JS 组件 |
| C.a.R. / CaRMetal | GPL | Java 桌面 |
| Kig | GPL | KDE 桌面 |
| GeoGebra | 见 4.3 | 功能上最接近 Cabri/GSP，许可证不自由 |

**Geometer's Sketchpad（几何画板）** 是 Key Curriculum 专有软件，人教社曾引入中文版，**无开源实现可嵌入**。

---

### 4.8 CindyJS（约束几何）

**来源**

- <https://cindyjs.org/>
- <https://github.com/CindyJS/CindyJS> — **Apache License 2.0**
- 嵌入文档：仓库 `ref/createCindy.md`

**是什么：** 网页端动态几何 + CindyScript 解释器，目标兼容 Cinderella。有 CindyGL（GPU 着色）做复分析等，不是小学体素。

**嵌入：** `CindyJS({ scripts, geometry: [ {name, type:'Free', pos, ...} ] })`。几何可放在 JSON 数组里，比 Desmos state 更可读，但仍是 **构造语言**。

**适合度：** 若未来要做「拖动顶点、约束保持」的探究课件，CindyJS / JSXGraph 都比 Konva 合适。作为 4–6 年级 **出题 IR**，CindyScript 对 LLM 是另一种方言税。社区比 JSXGraph 小，编辑器 UX 偏研究原型。

**Footgun：** 「开源 Cinderella」≠ 积木教具；维护节奏需自行评估（仍有提交，但不是 Vue 生态）。

---

### 4.9 three.js editor / MagicaVoxel / voxel.js / Blockbench / Goxel

#### three.js 与 three.js editor

- three.js：**MIT**（<https://github.com/mrdoob/three.js/blob/dev/LICENSE>）
- 在线编辑器：<https://threejs.org/editor/>，源码在仓库 `editor/` 目录
- 这是 **通用 3D 场景编辑器**（网格、材质、灯光、相机），导出场景 JSON/GLTF
- **不是** 整数单位立方；没有「一层一层堆方块、z=高度」的小学体积模型
- 可借鉴：orbit 控制、Gizmo；不要当出题工具

你们的游戏已经用 three.js，**3D helper 应输出体素集合，运行时再实例化 InstancedMesh**，不要输出通用场景图。

#### MagicaVoxel

官方页（ephtracy）：<http://ephtracy.github.io/index.html?page=mv_main>

站点常见条款（社区与镜像多次引用官方 *License* 列表）：

- Free to use for any project
- Credits appreciated
- **Selling or distributing the software (original or modified) in other packages are disallowed**

即：**免费闭源工具**，作品可用，程序本身不能当嵌入库、不能二次分发。无 Web 组件。`.vox` 对游戏资产友好，对「LLM → three 单位立方」多余。调色板/物体/场景模型比 `{(x,y,z)}` 重。

#### voxel.js

<https://voxel.github.io/voxeljs-site> — MIT 模块生态（maxogden / substack，约 2013）。浏览器 Minecraft 工具包，**多年停滞**。不建议新项目依赖。体素 meshing 算法可参考 Mikola Lysenko 的公开文章与 `voxel` npm 包（MIT），那是算法不是编辑器。

#### Blockbench

<https://github.com/jannisx11/blockbench> — **GPL-3.0**。低模 + 像素贴图，Minecraft 格式一流。FAQ：软件免费，**作品归作者**。作为 **库嵌入 Vue 商用闭源** 会触发 GPL 传染。领域是游戏模型，不是小学体积计数。

#### Goxel

<https://github.com/guillaumechereau/goxel> — **GPL-3.0**；作者称商用代码需另谈。桌面/移动体素编辑器，不是 Web 组件。

**3D 建议：** 继续自研「整数格上放置/删除单位立方」，three.js 只负责显示。导出保持 `S = { (x,y,z), ... }` 或等价 JSON。若要离线美术，可用 MagicaVoxel 再写 `.vox` → 坐标集合的转换器，不要把 MagicaVoxel 嵌进产品。

---

### 4.10 fabric.js / paper.js / Konva / PixiJS

共同点：都是 **2D 渲染/对象模型**，不是 DGS，也不是教具盘。许可证均为 **MIT**（官方仓库）。

#### fabric.js — <https://github.com/fabricjs/fabric.js>

- 对象模型 + 缩放旋转手柄 + SVG 导入导出 + `canvas.toJSON()` / `loadFromJSON`
- 适合设计工具、图片编辑
- **无官方 Vue 绑定**；数学网格、扇/弓/环要自写
- 性能与 API 稳定性在大场景下常被比较文章列为弱项

#### paper.js — <https://paperjs.org/> ，<https://github.com/paperjs/paper.js>

- 矢量/贝塞尔、PaperScript、布尔：`Path#unite/intersect/subtract/exclude`
- 布尔实现历史上 bug 多、大路径慢（官方 issue 长期标签 `boolean-operations`；Photopea 作者 2024 仍报慢）
- 适合生成艺术、路径运算；**不是** 带 transformer 的积木编辑器
- 小学多边形布尔更建议 Clipper，而不是 Paper 布尔

#### Konva — <https://konvajs.org/> ，Vue：<https://github.com/konvajs/vue-konva>

- MIT；**官方 Vue 3 绑定** `vue-konva`
- 场景图、拖拽、`Transformer`、事件冒泡、`stage.toJSON()` / `Konva.Node.create(json)`
- FAQ 写明支持 drag bounds、**snap-to-grid**（教程级，需自己写吸附逻辑）
- 文档把自己定位为：设计编辑器、白板、注释、图表 —— 与「出题画布」同类
- **没有** 数学度量、没有扇形弓形；这些应做自定义 `Konva.Shape` + 自有 IR
- `vue-konva` 可用 core build 做 tree-shaking

这是与「Vue3 + TS 自研助手」**叠得最齐** 的画布层。

#### PixiJS — <https://github.com/pixijs/pixi.js>

- MIT，WebGL 2D 游戏渲染器
- 高性能精灵；**没有** 编辑器语义、没有标准几何 JSON
- 适合学生端游戏，不适合出题编辑器（除非你们已经在 pixi 上做了完整 editor）

**2D 库怎么选（出题助手）：** Konva 做交互层；几何计算用 euclid.js 或自写；布尔用 Clipper2；不要用 Pixi 做编辑器；不要用 Paper 当主编辑器。

---

### 4.11 国内：几何画板、超级画板/网络画板、希沃、101

| 产品 | 性质 | 对本研究 |
|------|------|----------|
| **几何画板** (The Geometer's Sketchpad) | 美国 Key Curriculum 专有；1996 年人教社引入中文版 | 无开源 Web 内核；课件 `.gsp` 不能当 LLM IR |
| **超级画板 / 网络画板** <https://www.netpad.net.cn/> | 张景中团队，自主知识产权动态几何；可嵌 PPT/希沃 | **闭源平台**；声明服务超 2 万校。有网络交互与 AI，但是产品不是开源库 |
| **希沃白板 / 希沃 PPT** | 商业整机+软件 | 无开放几何 API 可供你们的 Vue 出题工具复用 |
| **101 教育 PPT** | 商业课件生态 | 同上 |
| 开源「希沃周边」如 Ink Canvas 系 | 批注白板（WPF），GPL/MIT 不等 | 屏幕画笔，不是几何对象 |

国内老师迁移路径大致是：几何画板 → GeoGebra / 网络画板。社区里把 GeoGebra 叫「开源」的文章很多，**与 GeoGebra 官方许可证冲突**（见 4.3）。

**没有** 一个可商用、可 npm 安装、可导出浅 JSON 的「开源几何画板克隆」达到 Polypad/GGB 的完成度。`ggb 多页模板` 等民间工具基于 GeoGebra 网页版，继承同一许可风险。

---

## 5. 2D 布尔 / CSG 库（环、拼合、展开图）

小学场景：圆环 = 大圆差小圆；图案积木拼合；展开图贴边。需要的是 **多边形布尔**，不是 3D CSG。

| 库 | 许可 | 输入 | 备注 |
|----|------|------|------|
| **Clipper2**（Angus Johnson） | **Boost Software License 1.0** | 整数/缩放后的多边形 | 工业级稳健；offset（膨胀/收缩）；自交、洞、EvenOdd/NonZero。[概述](https://www.angusj.com/clipper2/Docs/Overview.htm)、[LICENSE](https://github.com/AngusJohnson/Clipper2/blob/main/LICENSE)。JS：`clipper2-ts` / `clipper2-wasm`（BSL-1.0）或 `js-angusj-clipper`（MIT 包装，WASM 调 Clipper） |
| **polygon-clipping** | MIT | GeoJSON 多边形 | Martinez–Rueda–Feito；npm 使用量大。[仓库](https://github.com/mfogel/polygon-clipping) |
| **martinez-polygon-clipping** | MIT | GeoJSON | 同源算法的另一实现 |
| **Paper.js Path 布尔** | MIT | 贝塞尔 | 对曲线友好，稳健性/性能不如 Clipper（见 4.10） |
| **JSXGraph** CurveUnion / Intersection / Difference | LGPL 或 MIT | JSXGraph 曲线 | 绑死在 JSXGraph 对象模型 |
| 3D CSG（three-bvh-csg 等） | 各异 | 三角网格 | **不要** 用于 2D 小学环/多边形 |

**建议：** 编辑器里圆环、多边形差集用 **Clipper2（整数坐标）**，与现有「整数格」IR 一致。Paper.js 仅当以后要真正的三次贝塞尔布尔时再考虑。

---

## 6. 约束几何 vs 小学出题

| 需求 | 要不要约束 DGS |
|------|----------------|
| 画指定整数坐标的线段、圆、扇、多边形 | **不要** |
| 钉板拉皮筋、七巧板旋转 45°、体素堆叠 | **不要**（离散对称 + 网格即可） |
| 「过两点作圆、交点随动」探究 | 要（JSXGraph / CindyJS / GGB） |
| 给 LLM 的还原稿 | **浅 IR 不要约束图** |

CindyJS 与 JSXGraph 解决的是 Cinderella/Cabri 那类问题。你们的失败案例是「AI 看不懂题目图」，不是「AI 不会维护垂足约束」。先做 **静态可编辑图元 + 整数格**，约束作为 v2 实验层。

---

## 7. 作为 LLM IR：什么算「好」

现有 helper 的设计其实已经接近最优 IR：

```text
好：S = { (0,0)→(3,0); (3,0)→(3,4); (3,4)→(0,0) }
好：circle({cx:0, cy:0, r:2}); sector({cx:0,cy:0,r:2, a0:0, a1:90})
好：voxels = [[0,0,0],[0,0,1],[1,0,0]]
差：GeoGebra XML / Desmos opaque state / Excalidraw 手绘点列
差：SVG path 无类型（弧和贝塞尔混在一起）
差：JessieCode / CindyScript（又一门语言）
```

推荐 **一份 Zod 可校验的 JSON Schema**，三个助手共用 `kind` 字段，例如：

```json
{
  "version": 1,
  "space": { "dim": 2, "unit": "grid", "snap": 1 },
  "elements": [
    { "id": "s1", "kind": "segment", "a": [0, 0], "b": [4, 0] },
    { "id": "c1", "kind": "circle", "c": [0, 0], "r": 3 },
    { "id": "sec1", "kind": "sector", "c": [0, 0], "r": 3, "startDeg": 0, "endDeg": 90 },
    { "id": "ring1", "kind": "ring", "c": [0, 0], "rOuter": 3, "rInner": 1 },
    { "id": "p1", "kind": "polygon", "points": [[0,0],[2,0],[1,1]], "role": "tangram-triangle" }
  ]
}
```

3D：

```json
{
  "version": 1,
  "space": { "dim": 3, "unit": "cube" },
  "voxels": [[0,0,0], [0,0,1], [1,0,0]]
}
```

教具不要做成「任意画笔」，而做成 **有限图元目录**（与 Polypad 的 `tile.name` 同一思路，但是自己的枚举）：

- tangram 7 片（固定形状，只允许平移/旋转/翻转）
- pattern blocks（正三角、菱形、梯形、六边…）
- geoboard（钉阵 + 皮筋多边形）
- unit tiles / 方格纸
- 展开图（面 + 铰链边）
- 小棒（整数长度 segment）
- 体素立方、层数标注

LLM 还原规则：只允许 schema 内 `kind`；坐标必须为整数（或半整数，钉板）；禁止 SVG path 作为主对象。

---

## 8. 与「Vue3 + VueUse + Reka UI」如何拼

这是调研结论下的 **参考拼法**（仍不实现）：

```
┌─────────────────────────────────────────┐
│  Reka UI：工具条、侧栏、对话框、导出面板 │
│  VueUse：快捷键、useDropZone、useStorage │
├─────────────────────────────────────────┤
│  2D：vue-konva  Stage                    │
│      snap-to-grid / 45° 旋转             │
│      自定义 Shape：扇、弓、环、椭圆      │
│      @mathigon/euclid：交点、长度（可选） │
│      clipper2：圆环/并差                 │
├─────────────────────────────────────────┤
│  3D：three.js InstancedMesh 单位立方     │
│      自写拾取：点击格放置/删除           │
├─────────────────────────────────────────┤
│  IR：Zod schema → JSON + 人类可读 S=     │
│      同时给 LLM prompt 与运行时编译器     │
└─────────────────────────────────────────┘
```

不要：

- iframe Polypad/GGB/Desmos 当保存格式
- 为了「好看的白板」引入 tldraw/Excalidraw
- 用 three.js editor 当体素工具
- 把教具做成纯画笔（否则 IR 退回 SVG，AI 又不会还原）

**更好 UX（相对现有单文件 HTML）且仍开源可控的点：**

1. 撤销/重做、图层、锁定（Konva 易做）
2. 导入题目图半透明垫底，对齐网格后描图 —— **直接打中「AI 不会看图」**
3. 图元属性面板（Reka）：坐标、半径、角度用数字输入，不只拖
4. 实时预览 p5/three 小窗（同一 IR）
5. 教具调色盘（学 Polypad 侧栏，数据自有）
6. 导出双通道：JSON IR + 旧版 `S = {...}` 文本，兼容现有 prompt

---

## 9. 许可证红线清单（给法务/负责人）

| 动作 | 风险 |
|------|------|
| 商业产品内嵌 **GeoGebra App**（含离线 bundle） | 需 GeoGebra 商业协议 |
| 商业产品内嵌 **Polypad API/iframe**，尤其付费墙后或高请求量 | 需 Amplify 批准 |
| 生产环境用 **tldraw SDK** 无 license key | 违反默认许可 |
| 把 **Blockbench / Goxel** 源码链进闭源 Vue 应用 | GPL-3.0 传染 |
| 分发 **MagicaVoxel** 程序 | 作者禁止再打包分发 |
| 使用 **JSXGraph** 选 MIT 条款 | 通常可商用（保留版权声明） |
| 使用 **Konva / euclid.js / three / polygon-clipping / Clipper2 BSL** | 许可友好 |
| 使用 GeoGebra **源码**做衍生 | EUPL；**不能**连带使用官方 UI 资源（CC BY-NC-SA）当商业皮肤 |

「老师上课免费用」≠「你们把引擎装进商业出题流水线」。

---

## 10. 建议决策

1. **重建三个 helper 为 Vue 应用是正确的**；不要幻想一个开源 Polypad 能合法替换。
2. **画布用 Konva，3D 用 three，IR 自有**；这比接入任何完整 DGS 更贴近 p5/three 下游。
3. **教具用「有限积木目录 + 网格」**，交互可对标 Polypad，数据不要对标 Polypad。
4. JSXGraph 仅作为 **可选的约束几何实验页**，不要替换整数线段/体素工具。
5. GeoGebra / Desmos / Polypad 最多做「教师对照」或另签协议的增值嵌入，**不能当默认 IR**。
6. 2D 布尔用 Clipper2；不要用 Paper.js 布尔撑圆环。
7. 垫底题目图 + 吸附描图，比换更炫的白板更能提高 557 个游戏的还原率。

---

## 11. 主要第一手链接

- Polypad API：<https://mathigon.io/polypad/>
- Polypad FAQ：<https://polypad.amplify.com/faqs>
- Amplify 使用指南：<https://amplify.com/dc-usage-guidelines/>
- Mathigon 开源组织：<https://github.com/mathigon>
- Euclid.ts：<https://github.com/mathigon/euclid.js>
- JSXGraph 仓库与双许可：<https://github.com/jsxgraph/jsxgraph>
- JSXGraph View3D：<https://jsxgraph.uni-bayreuth.de/docs/symbols/View3D.html>
- JSXGraph Dump：<https://jsxgraph.uni-bayreuth.de/docs/symbols/JXG.Dump.html>
- GeoGebra License：<https://www.geogebra.org/license>
- GeoGebra Embedding：<https://geogebra.github.io/docs/reference/en/GeoGebra_Apps_Embedding/>
- GeoGebra Apps API：<https://geogebra.github.io/docs/reference/en/GeoGebra_Apps_API/>
- tldraw License：<https://tldraw.dev/community/license>
- Excalidraw：<https://github.com/excalidraw/excalidraw>
- Desmos Geometry API：<https://www.desmos.com/api/v1.12/docs/geometry.html>
- CindyJS：<https://github.com/CindyJS/CindyJS> / <https://cindyjs.org/>
- Cinderella：<https://www.cinderella.de/>
- Konva FAQ（许可与选型）：<https://konvajs.org/docs/faq.html>
- vue-konva：<https://github.com/konvajs/vue-konva>
- fabric.js：<https://github.com/fabricjs/fabric.js>
- Clipper2：<https://www.angusj.com/clipper2/Docs/Overview.htm>
- polygon-clipping：<https://github.com/mfogel/polygon-clipping>
- MagicaVoxel：<http://ephtracy.github.io/>
- Blockbench：<https://github.com/jannisx11/blockbench>
- Goxel：<https://github.com/guillaumechereau/goxel>
- three.js LICENSE：<https://github.com/mrdoob/three.js/blob/dev/LICENSE>
- 网络画板：<https://www.netpad.net.cn/>
- DGS 列表（背景，非规范）：<https://en.wikipedia.org/wiki/List_of_interactive_geometry_software>
