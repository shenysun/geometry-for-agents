# geometry-for-agents

开源的几何说明书编辑器:操作员对照题图画出几何结构,产出一份结构化的「说明书」(JSON),交给 Agent 去生成互动课件。

An open-source geometry spec editor: operators draw geometric structures, and the tool produces a structured JSON spec for AI agents to consume and build interactive courseware from.

**[在线体验](https://shenysun.github.io/geometry-for-agents/)**

## 它是什么,不是什么

- **是**:几何结构的**生产工具**。一个页面,视口可在 2D / 3D 间切换,由可停靠面板组成(工具箱、对象列表、视口、属性面板、垫图)。
- **不是**:课件本身,也不是老师或学生用的教具沙盘。下游的互动课件由 Agent 用 p5 / three 等生成。

## 核心概念

- **说明书**:描述图形结构的 JSON,是交给 Agent 的真源。可存为本地文件,也可编码进分享链接。
- **Prompt**:说明书的可读投影,给人粘贴给 Agent,永远可从说明书生成、不反向当真源。
- **垫图**:半透明铺在图元底下的题目原图,只帮助对齐;分享链接只带垫图地址,不把像素当几何。
- **重叠填充**:引用式图元,标记两个封闭图形的交集(曲边精确),不存几何,渲染期推导。

## 功能

- **2D 图元**:线段、多边形、矩形、三角形、平行四边形、梯形、正多边形、圆、椭圆、环、弧、扇形、弓形、角度、尺寸标注、文字标签、重叠填充
- **3D**:体素搭建与参数体(盒、圆柱、圆锥、球、棱锥、棱柱)
- **精确编辑**:控制点、变换手柄、格吸附、同点循环选择(选中重叠图形的下层)
- **可停靠布局**:面板可并排、叠标签、改大小,布局持久化
- **分享**:说明书编码进 URL,打开即见同一份结构;本地导入/导出 JSON
- **撤销/重做**,中英双语界面

## 快速开始

```bash
pnpm install
pnpm dev        # 开发服
pnpm test       # 全量测试
pnpm typecheck  # 类型检查
```

## 文档

- [CONTEXT.md](CONTEXT.md) — 项目词汇表(领域语言)
- [docs/adr/](docs/adr/) — 架构决策记录(ADR)
- [docs/todo.md](docs/todo.md) — 路线图与范围边界

## 许可

[MIT](LICENSE)
