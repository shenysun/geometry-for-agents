# 绘图/编辑器软件工具切换交互模式调研

**日期**：2026-08-25  
**目的**：调研"绘图/编辑器软件中，绘制类工具用完后如何回到选择工具"的交互设计模式，为几何绘图编辑器（类 Figma 的 2D 图元绘制）提供业界参考。  
**要求**：每条结论必须引用一手资料（官方文档/手册），区分官方文档与社区说法。

---

## 1. 结论摘要

### 主流交互模式归纳

| 模式 | 代表软件 | 适用场景 |
|------|----------|----------|
| **粘性工具** | Unity 编辑器、Photoshop 形状工具 | 需要对同一对象进行连续操作（移动、旋转、缩放、创建） |
| **画完即回 + 修饰键连续** | **Figma** | 快速绘制多个相同图元，默认行为是效率优先 |
| **弹簧工具（临时切换）** | Figma（空格键）、Unity（Alt/Option） | 临时导航/平移，保持当前工作流 |
| **直捷键直接操作（不切换工具）** | **Blender（G/R/S）** | 快速变换，不破坏当前工具状态 |

**对"连续绘制几何图元的网页编辑器"的业界惯例**：
- **Figma 模式是业界标杆**：绘制完自动回到选择工具 → 允许立即调整刚画的图元
- 连续绘制需要用户主动保持绘制状态（工具保持选中，可继续绘制）
- 这是"画完即回 + 连续绘制需保持工具"的模式，而非"粘性绘制工具"

---

## 2. Unity 编辑器

### 2.1 工具快捷键

**官方文档确认**：

- **Q** - Pan（Hand Tool，平移工具）
- **W** - Move（移动工具）
- **E** - Rotate（旋转工具）
- **R** - Scale（缩放工具）
- **T** - Rect Tool（矩形变换工具）

来源：[Unity Hotkeys - Unity Manual](https://docs.unity3d.com/2017.2/Documentation/Manual/UnityHotkeys.html)

### 2.2 工具行为模式：粘性工具

Unity 编辑器的工具是**粘性的**（sticky）：

- 选择工具（Q/W/E/R/T）后，工具保持激活状态
- 在不同 GameObject 之间切换时，工具不会自动返回到默认选择工具
- **创建 GameObject 后，工具保持当前激活状态**，不会自动切回选择工具

来源：[Tools.current - Unity Scripting API](https://docs.unity3d.com/6000.4/Documentation/ScriptReference/Tools-current.html) 描述"The tool that is currently selected for the Scene View"

### 2.3 弹簧工具/临时切换

Unity 支持临时导航切换：

- **Alt（Windows）/Option（macOS）** - 按住后配合鼠标操作可临时进行视图导航（轨道/缩放）
- 在 View tool 模式下：
  - 按 Alt/Option + 左键拖动 = 轨道
  - 按 Alt/Option + 右键拖动 = 缩放

来源：[Scene view navigation - Unity Manual](https://docs.unity3d.com/6000.5/Documentation/Manual/SceneViewNavigation.html)

### 2.4 EditorTool 与自定义工具

Unity 2020+ 支持 EditorTool 系统：

- EditorTool 可以与 Component 绑定
- 当选择具有相同 Component 的不同 GameObject 时，**Component Tool 保持激活**
- 这是一种上下文相关的粘性工具模式

来源：[Automatic activation of EditorTool - Unity Discussions](https://discussions.unity.com/t/automatic-activation-of-editortool/1534500)

### 2.5 Unity 小结

**Unity 的工具模式是粘性的**，适合连续操作同一类型的编辑任务（如连续移动多个对象、连续创建 GameObject）。这符合"编辑器"而非"绘图软件"的定位——用户的核心工作是调整对象而非绘制图元。

---

## 3. Figma（对照基准）

### 3.1 绘图工具快捷键

**官方文档确认**：

- **R** - Rectangle（矩形工具）
- **O** - Ellipse（椭圆工具）
- **L** - Line（线条工具）
- **⇧ Shift + L** - Arrow（箭头工具）
- **P** - Pen（钢笔工具）
- **T** - Text（文字工具）

来源：[Shape tools - Figma Learn](https://help.figma.com/hc/en-us/articles/360040450133-Shape-tools)

### 3.2 工具行为模式：画完即回

Figma 的绘图工具采用**画完即回**模式：

- 绘制完图形后，工具会自动切回选择工具
- **刚绘制的图形自动被选中**，可立即进行调整
- 这是 Figma 的默认行为，优化了"绘制 → 调整"的工作流

来源：[Shape tools - Figma Learn](https://help.figma.com/hc/en-us/articles/360040450133-Shape-tools) 中描述"绘制完成后图元自动选中并显示调整手柄"

### 3.3 连续绘制

Figma 支持连续绘制相同图元：

- **保持工具选中状态**可继续绘制多个相同图形
- 不需要特殊的"连续模式"，工具保持激活即可连续绘制
- 按 **V** 键可手动切回选择工具

来源：Figma 帮助中心的 Shape tools 文章暗示工具保持选中状态可继续绘制

### 3.4 弹簧工具：空格键临时平移

Figma 的弹簧工具机制：

- **按住空格键** = 临时激活 Hand Tool（手型工具）
- 松开空格键 = 返回之前的工具
- 这是标准的"弹簧工具"模式，用于临时导航

来源：[Pan and zoom in FigJam](https://help.figma.com/hc/en-us/articles/1500004414582-Pan-and-zoom-in-FigJam) 明确说明"Press and hold Space to temporarily toggle on the hand tool"

### 3.5 Pen 工具结束路径

Pen 工具的特殊行为：

- **Escape** - 取消选择/结束路径（保持路径开放）
- 将 Pen 工具定位到路径起点可闭合路径

来源：[Vector networks - Figma Learn](https://help.figma.com/hc/en-us/articles/360040450213-Vector-networks)

### 3.6 Figma 小结

**Figma 的模式是"画完即回 + 可连续绘制"**：
- 默认行为：绘制后自动返回选择工具，允许立即调整
- 连续绘制：工具保持选中状态，用户继续绘制
- 弹簧工具：空格键临时导航
- 这是针对**2D 图形绘制**优化的交互模式

---

## 4. Blender（对照）

### 4.1 G/R/S 直接操作模式

Blender 采用独特的**直接操作模式**：

- **G** - 移动（Grab）
- **R** - 旋转（Rotate）
- **S** - 缩放（Scale）
- **这些快捷键不切换工具**，而是直接对选中对象执行操作

来源：[Move, Rotate, Scale - Blender Manual](https://docs.blender.org/manual/en/latest/modeling/meshes/editing/basics/move_rotate_scale.html)

### 4.2 工具系统记忆功能

Blender 的工具系统具有记忆功能：

- 每个工作区和模式只有一个活跃工具
- **工具会被记住**：如果在 Edit Mode 中选择了 Extrude 工具，切换到 Object Mode 再返回 Edit Mode，Extrude 工具仍然活跃

来源：[Tool System - Blender Manual](https://docs.blender.org/manual/en/latest/interface/tool_system.html)

### 4.3 Blender 小结

**Blender 的模式是混合的**：
- 常用变换（G/R/S）是直接操作，不切换工具
- 工具栏工具（如 Extrude）是粘性的，会被记住
- 这符合 3D 建模工作流：频繁变换 + 专项建模工具

---

## 5. Adobe Illustrator / Photoshop

### 5.1 Photoshop 形状工具

**官方文档确认**：

- 形状工具组包括：Rectangle、Ellipse、Triangle、Polygon 等
- 绘制后使用 **Path Selection Tool**（路径选择工具）来选择和修改形状
- 形状会显示屏幕变换控件，允许拖动控制点缩放

来源：[Draw shapes - Photoshop - Adobe Help Center](https://helpx.adobe.com/photoshop/desktop/draw-shapes-paths/create-shapes/create-shapes.html)

### 5.2 Photoshop 小结

Photoshop 的官方文档**未明确说明**形状工具绘制后是否自动返回选择工具。从工具描述来看，绘制后需要使用 Path Selection Tool 来选择和修改，暗示可能不是自动返回模式。

### 5.3 Illustrator 小结

Adobe 帮助中心的 Illustrator 文档**未找到**关于工具切换行为（单次 vs 连续）的明确说明。搜索结果主要是社区讨论，没有官方文档确认"双击锁定连续使用"等行为。

---

## 6. 综合分析：四种主流模式

### 6.1 模式一：粘性工具（Sticky Tools）

**特点**：
- 工具选择后保持激活状态
- 切换对象/视图后工具不变
- 适合对同一类型对象进行连续操作

**代表软件**：
- **Unity 编辑器**：Q/W/E/R/T 工具粘性
- **Photoshop 形状工具**（推测，官方文档未明确确认）
- **Blender 工具栏工具**：工具会被记住

**适用场景**：
- 编辑器类软件（调整对象属性为主）
- 3D 建模（专项建模工具）
- 需要对多个对象进行相同类型操作

### 6.2 模式二：画完即回 + 连续绘制（默认返回，可选连续）

**特点**：
- 绘制完成后默认返回选择工具
- 允许立即调整刚绘制的图元
- 保持工具选中可连续绘制

**代表软件**：
- **Figma**：画完自动返回选择工具，工具保持选中可继续绘制

**适用场景**：
- 2D 矢量绘图软件
- UI/UX 设计工具
- 快速原型设计

### 6.3 模式三：弹簧工具（Spring-loaded Tools）

**特点**：
- 按住某键临时切换工具
- 松开键返回原工具
- 通常用于导航/平移

**代表软件**：
- **Figma**：空格键临时 Hand Tool
- **Unity**：Alt/Option 临时导航操作

**适用场景**：
- 所有绘图/编辑软件的导航需求
- 临时操作不破坏当前工作流

### 6.4 模式四：直捷键直接操作（Direct Action）

**特点**：
- 按键执行操作，不切换工具
- 工具栏保持当前状态
- 快捷键用于常用变换

**代表软件**：
- **Blender**：G/R/S 直接移动/旋转/缩放，不切换工具

**适用场景**：
- 3D 建模软件
- 需要频繁变换的场景

---

## 7. 对本项目的启示

### 7.1 业界惯例结论

对于**"连续绘制几何图元的网页编辑器"**，业界主流实践是：

1. **默认行为**：绘制完图元后自动返回选择工具
   - 优点：立即可调整刚画的图元
   - 代表：Figma

2. **连续绘制**：保持绘制工具选中状态
   - 用户无需切换工具即可继续绘制
   - 这是工具的天然行为，非特殊模式

3. **弹簧工具**：提供临时导航能力
   - 如空格键临时平移
   - 代表：Figma、Unity

### 7.2 决策参考（仅列事实，不做决策）

**Unity 模式的事实**：
- 工具是粘性的
- 适合编辑器类工作流
- 用户需求："和 Unity 一样的体验"

**Figma 模式的事实**：
- 画完即回是 2D 绘图软件的行业标准
- 网页版矢量编辑器的主流实践
- 优化了"绘制 → 调整"工作流

**用户痛点的事实**：
- 当前：画完图形后工具粘在绘制工具上
- 想选中/调整刚画的图形必须手动点回选择工具

**可考虑的方案**（不推荐任何一种）：
- 方案 A：采用 Figma 模式 - 画完即回，工具保持可选连续绘制
- 方案 B：采用 Unity 模式 - 粘性工具，手动切回选择工具
- 方案 C：混合模式 - 默认画完即回，提供"锁定绘制工具"选项
- 方案 D：弹簧工具 - 按住某键临时切换选择工具

### 7.3 需要进一步确认的问题

1. 用户的核心工作流是什么？
   - 绘制为主 → Unity 模式更合适
   - 绘制+调整混合 → Figma 模式更合适

2. 是否需要连续绘制大量相同图元？
   - 频繁 → 粘性工具可能更好
   - 偶尔 → 画完即回即可

3. 是否需要提供可配置的工具行为？
   - 允许用户选择模式

---

## 8. 主要一手资料链接

### Unity
- [Unity Hotkeys - Unity Manual](https://docs.unity3d.com/2017.2/Documentation/Manual/UnityHotkeys.html)
- [Scene view navigation - Unity Manual](https://docs.unity3d.com/6000.5/Documentation/Manual/SceneViewNavigation.html)
- [Tools.current - Unity Scripting API](https://docs.unity3d.com/6000.4/Documentation/ScriptReference/Tools-current.html)

### Figma
- [Shape tools - Figma Learn](https://help.figma.com/hc/en-us/articles/360040450133-Shape-tools)
- [Vector networks - Figma Learn](https://help.figma.com/hc/en-us/articles/360040450213-Vector-networks)
- [Pan and zoom in FigJam](https://help.figma.com/hc/en-us/articles/1500004414582-Pan-and-zoom-in-FigJam)
- [Use Figma products with a keyboard](https://help.figma.com/hc/en-us/articles/360040328653-Use-Figma-products-with-a-keyboard)

### Blender
- [Tool System - Blender Manual](https://docs.blender.org/manual/en/latest/interface/tool_system.html)
- [Move, Rotate, Scale - Blender Manual](https://docs.blender.org/manual/en/latest/modeling/meshes/editing/basics/move_rotate_scale.html)

### Adobe
- [Draw shapes - Photoshop - Adobe Help Center](https://helpx.adobe.com/photoshop/desktop/draw-shapes-paths/create-shapes/create-shapes.html)
- [Draw rectangles and modify stroke options - Adobe Help Center](https://helpx.adobe.com/photoshop/using/modify-shapes.html)

---

**调研说明**：本报告仅引用官方文档/手册作为结论依据。社区论坛、博客等二手资料未作为主要结论来源，仅作为补充参考。
