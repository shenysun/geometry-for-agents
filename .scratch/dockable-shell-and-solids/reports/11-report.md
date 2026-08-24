# 11 报告：参数体变换手柄、控制点与格

- 票 11 commit：`1aaa7de` feat: 参数体变换手柄、控制点与格
- 验证：`npx tsc --noEmit` 零错误；`npx vitest run` 全量 380 通过（基线 342 → 新增 38）；另跑 `vite build` 确认 SFC 模板编译（tsc 不查 .vue）。

## 改动清单（1aaa7de）

| 文件 | 改动 |
| --- | --- |
| `src/document/update-document.ts` | 3D 参数体变换节：`SolidPrimitive`（= `Exclude<Primitive3d, voxel>`）/`SolidAxis`；`rotateEulerYxz`/`unrotateEulerYxz`（合成顺序 Y→X→Z，矩阵 Ry·Rx·Rz，与渲染端 three 内旋 'YXZ' 同一约定）与 `solidAnchor`；几何纯函数 `translateSolidGeometry`（只写锚点）、`rotateSolidGeometry`（逐轴增量写欧拉字段并归一 [0,360)，球恒等）、`scaleSolidGeometry`（尺寸字段等比，三棱柱连底面点同乘）、`moveSolidControlPointGeometry`（世界点逆旋转回局部后只改一处：宽深 = 2×局部投影绝对值、圆族 r = 底面径向距离、高 = 局部 Y、球 r = 到球心距离、prism base-i 写局部 XZ、未知 id 恒等）；提交函数 `translateSolid`（位移先吃格 1/1/2/关，零位移返回原说明书）、`rotateSolid`、`scaleSolid`（非正因子报错）、`moveSolidControlPoint`（目标点先吃格），全部不可变、经 parse 往返、体素与 2D 说明书拒绝 |
| `src/document/update-document.test.ts` | 新 describe「3D 参数体变换（票 11）」13 测：欧拉合成与逆、平移三档格、零位移同对象、逐轴旋转归一、球恒等、等比缩放（含 prism 底面同乘）、控制点各类型语义、旋转体按局部轴度量、吸附后写入、拒绝路径 |
| `src/viewport3d/placement-preview.ts`（新） | `PlacementPreview` 与 `solidPlacementPreview` 从 projector 抽出为纯模块（不 import three），预览变体带上三欧拉角——选择手势可纯函数地生成带姿态预览 |
| `src/viewport3d/solid-control-points.ts`（新） | 参数体控制点目录（世界坐标）：box/pyramid 的 width/depth/height、cylinder/cone 的 r/height、sphere 的 r、prism 的 height + base-0/1/2；局部位置经欧拉角转世界，pointId 与提交函数同源 |
| `src/viewport3d/solid-control-points.test.ts`（新） | 目录逐类型精确断言 + 旋转体（Y 90°）控制点随姿态转世界 |
| `src/viewport3d/select-gesture-3d.ts` | 参数体手势全套：状态机加 `solid-translate`/`solid-rotate`/`solid-scale`/`solid-control`；`Ray3` 与视线小几何（垂距命中、射线∩平面、绕轴方位角）；`solidTransformHandles` 布局（头顶 Y 柄、+Z 侧 X 柄、+X 侧 Z 柄、地面斜角缩放柄，间距 4×容差，随姿态旋转；球只有缩放柄）；命中顺序控制点 → 旋转/缩放柄 → 本体（hitId 含体素与参数体）；手势中只预览、pointerup 至多一次 commit（`translateSolid` 带原始位移、`rotateSolid` 带轴与增量角、`scaleSolid` 带因子、`solidControlPoint` 带已吸附目标点）；零位移/零角/单位因子/拖回原位不提交；体素路径原样（整格、无柄） |
| `src/viewport3d/select-gesture-3d.test.ts` | 新增 6 组 describe 共 17 测：柄布局、命中顺序（控制点压过别体本体、柄压过本体、未选中无柄、体素回归、球无旋转柄）、平移三档格 + Alt、旋转 Y 90°/X 放倒增量、缩放因子 2、控制点拖 r 吃格、单击选中/取消 |
| `src/viewport3d/projector.ts` | pick 纳入参数体本体（体素/参数体取更近者，新增 `solid` 拾取变体带命中点世界坐标）；`rayAt`/`toScreen`/`worldPerPixel`/`onViewChange` 四个新接口喂手势与覆盖层；预览网格应用三欧拉角（放置与变换预览同一路径）；选中参数体换亮黄材质；**修正旋转锚点**：box/cylinder/cone 网格中心 = 锚点 + 欧拉旋转后的 (0,height/2,0)（此前绕中点旋转，旋转体一转就漂）；destroy 补释放 |
| `src/viewport3d/Viewport3d.vue` | 选择上下文带 ray + 像素换算的世界容差（HANDLE/CONTROL 各 10px）；提交分派体素（原 `translateVoxel`）与参数体（四个新提交函数，吃 pointerup 时的格）；HTML 覆盖层画三旋转柄、缩放柄、控制点（pointer-events-auto，悬停光标 alias/ew-resize/move，与 2D 同一套），随文档/选中/工具/视图/尺寸变化重算；宿主光标选择工具 grab、创建工具回默认；体素工具悬停/点击参数体不再取不存在的整数角 |
| `src/viewport3d/index.ts` | 导出更新（placement-preview 独立成源、手势与目录新符号） |

### 验收框逐条勾验

- [x] 长方体/圆柱/圆锥/球/四棱锥/三棱柱选中后可平移、旋转、缩放，预览后一次提交 — 六类型共用同一套联合分支（update-document 几何函数按 type 穷尽，tsc 保证）；手势测试断言 move 只预览 commit 恒 null、up 恰一次 commit；球无旋转（专测：视线落在旋转柄位置不产生手势）
- [x] 控制点改尺寸；命中顺序控制点优先于柄、再才是本体 — 目录 + `moveSolidControlPointGeometry` 各类型专测；手势专测「控制点压过身后别参数体的本体」「缩放柄压过本体」「未选中时无控制点直接本体平移」
- [x] 欧拉角顺序 Y→X→Z；0 仍是底面朝下 — `rotateEulerYxz` 合成专测（(Y90,X90) 作用 +Z 得 −Y，逆变换还原）；`rotateSolidGeometry` 只加对应字段并归一；渲染端修为中心偏移随欧拉转（绕底面中心转，0 姿态即站立不变）；零增量不写入
- [x] 参数体吸附当前格；Alt 关吸附；体素仍忽略 1/2 与关 — `translateSolid` 三档格专测（1/0.5/off）；视口 `gridForEvent` 把 Alt 映射 off（手势专测 off 档保留原始位移）；体素既有专测全绿（1/2、off、Alt 下仍同一整数角）
- [x] 体素选中后仍无旋转缩放控制点 — 手势专测（选中体素视线再近也无柄，进整格拖动）；覆盖层只为参数体画柄（体素选中时刷新为空）

## 测试摘要

- 新文件：`solid-control-points.test.ts`（目录）、`placement-preview.ts`（纯模块，其映射由手势测试间接覆盖）。
- 扩展：`update-document.test.ts`（+13）、`select-gesture-3d.test.ts`（+17，含一条票 07 旧断言按票 11 行为改写：参数体从「不拾取」变为「进平移态并选中」）。
- 全量 380 通过、tsc 零错误、vite build 过（模板编译）；不测 Three mesh 内部与轨道相机，沿 spec 两缝。

## 疑虑

1. **平移只在水平面**：拖动平面取按下时指针落点的高度（与体素拖动同一约定），dy 恒为 0——抬高参数体走属性面板。这是沿票 07 的既有口径，若要「垂直拖动抬升」需要选垂直拖动平面，未在本票范围。
2. **已旋转体的旋转柄是近似**：柄增量按世界轴平面量测后加进对应欧拉字段；对 0 姿态精确，对已旋转体是「世界轴增量 → 字段增量」的近似（字段语义本身仍精确，属性面板输入不受影响）。
3. **`snap3dInDocument` 私有副本**：说明书模块不能反向 import viewport3d/snap3d（分层），update-document.ts 里按同一约定自持 6 行吸附（有注释互指）；若日后统一，应把 snap3d 下沉进 document/snap.ts（本票领地不含 snap.ts）。
4. **tsc 不查 .vue**：Viewport3d.vue 的类型只由 vite build 兜底（本次就靠它抓到一处 projector 导出搬移）；工程层面建议引入 vue-tsc，另行安排。
