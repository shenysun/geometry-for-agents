# 07 — 3D 选择与体素分家、整格拖 实施报告

**Commit:** `02ec5fc`

## 改动文件清单

领地内（全部在 `src/viewport3d/**`）：

- `src/viewport3d/select-gesture-3d.ts`（新）— 3D 选择手势纯函数（沿 2D select-gesture 的 start/move/up/click/esc 模式）：`Select3dState` 只有 `idle | drag`（体素无旋转/缩放/控制点态）；`Select3dCommit` 单一 `translate`；`integerDelta` 各轴 `Math.round` 取整——`grid`（1/1/2/off）与 `alt` 声明在上下文里但路径完全不读，结构上写不出半格。`startSelect3d` 命中体素进拖动态并选中；`clickSelect3d` 命中选中/点空取消；`moveSelect3d` 只出目标整数角预览（不足一格不出）；`upSelect3d` 一次 pointerup 至多一次 commit。命中由上下文 `hitId` 传入（Three 拾取在接线层），票 11 加参数体拾取时只需扩 hit 来源。
- `src/viewport3d/select-gesture-3d.test.ts`（新）— 13 个用例：点体素选中进拖动/点空不动/命中非体素（box）不拖不选；单击选中/点空取消；拖过一格预览整数角/不足一格无预览；格 1/2、关、Alt 三种输入输出同一整数角；多次 move 零 commit + 一次 up 一次 commit（dx=1, dy=0, dz=1）；原地松手不提交；Esc 回 idle。
- `src/viewport3d/voxel-commit.ts` — 新 `translateVoxel(document, id, delta)`：位移取整、零位移拒绝、目标格被其它体素占用拒绝、非 3D 说明书与未知 id 拒绝；新 `voxelOccupying(document, corner, exceptId?)` 占用检查（`commitVoxel` 改为复用它，原私有 `occupies` 删除）。
- `src/viewport3d/voxel-commit.test.ts` — 追加 `translateVoxel` 5 个用例：整格平移不可变（原体素对象不动）、非整数位移取整（0.4/0.6/0.5 → 0/1/1）、占用格拒绝、零位移拒绝、未知 id 与 2D 拒绝。占用格不重复放的放置用例原有保留。
- `src/viewport3d/projector.ts` — `controls.mouseButtons = { LEFT: null, MIDDLE: THREE.MOUSE.ROTATE, RIGHT: THREE.MOUSE.ROTATE }`：左键让位给编辑器手势（选择/放置/拖动），中键/右键拖转镜头，滚轮缩放不变；新 `setSelection(id)`（选中体素换亮黄材质 0xfacc15，重放 lastDocument）；新 `pickOnPlane(screen, y)`（射线打到指定高度水平面，拖动取指针世界落点用）；渲染提为 `renderDocument` 局部函数（render/setSelection 共用）；`destroy` 补 selectedVoxelMaterial 释放。
- `src/viewport3d/Viewport3d.vue` — 左键路径分家：选择工具（select/null）pointerdown 走 `startSelect3d`（不放置、无放置预览），pointermove 拖动态在按下同高平面（`selectGesture.startWorld.y`）上取落点喂 `moveSelect3d`，pointerup `upSelect3d` 一次 commit → `translateVoxel` → 一次 `updatePrimitive`（一次手势一步 Undo）；单击（未进拖动态）`clickSelect3d` 选中/取消。创建工具保持点格放置（`wasDragging` 让路相机拖）。右键单击删除、Delete/Backspace 删选中或 hover 体素，现状保留。新增 watch：selectionId → `setSelection` 高亮、tool 切换 → 手势回 idle 清预览；Escape 中断拖动；pointermove 挂 window（拖出视口不断流，与 2D 一致）。
- `src/viewport3d/host.test.ts` — 弱断言扩展：选择手势接线（startSelect3d/moveSelect3d/upSelect3d/clickSelect3d/translateVoxel/setSelection）、放置预览有 `!isCreateTool()` 守卫且 `isSelectTool()` 分支文本位置先于 `commitVoxel(`；projector 的 mouseButtons（`LEFT: null` + `THREE.MOUSE.ROTATE`）。原 render 签名断言随 `renderDocument` 提取更新。
- `src/viewport3d/index.ts` — 汇出 select-gesture-3d 全部手势与类型、translateVoxel/voxelOccupying。

未动：`src/components/toolbox.ts`（3D 名单已是 select+voxel+box）、`src/stores/editor.ts`（工具类型不变）、`src/i18n/messages.ts`（tool.select/voxel/box 文案已有）、`src/document/**`（体素平移提交纯函数放 viewport3d，document 模块零改动）。

## 验收框逐条勾验

- [x] 选择工具左键不调用放置；点体素选中，点空取消 — `Viewport3d.vue` 左键先走 `isSelectTool()` 分支（start/click/up 手势）并 return，放置提交只在创建工具段；预览路径有 `!isCreateTool()` 守卫。纯函数层 `Select3dCommit` 只有 `translate` 一种；测试「点在体素上：不产生任何提交」「单击命中选中/点空取消」。
- [x] 单位立方体工具点格放置；占用格不重复放 — 创建工具路径保持 `commitVoxel`（点格放置）；`voxelOccupying` 复用后原有「does not write a second voxel into an occupied cell」用例仍绿。
- [x] 选择工具下可把体素拖到另一整数格，松手一次提交 — `moveSelect3d` 预览目标整数角、`upSelect3d` 一次 commit、`translateVoxel` 拒占用格后一次 `updatePrimitive`（一步 Undo）；测试「拖到另一整数格松手：一次 commit」串了两次 move（均零 commit）+ 一次 up（一次 commit）。
- [x] 格为 1/2 或关时体素仍只落整数；Alt 不能写出半格体素 — 手势层测试对同一拖动分别传 `grid: 0.5`、`grid: "off"`、`alt: true`，输出与默认格 `toEqual` 同一整数角；提交层 `translateVoxel` 对 {0.4, 0.6, 0.5} 取整为 {0, 1, 1}；接线层体素路径不读格与 Alt（box 的格吸附是票 11 的事，现状保持 `editor.grid`）。
- [x] 体素无变换手柄与控制点；轨道旋转镜头不被创建手势抢走 — 手势状态机只有 idle/drag，无 rotate/scale/handle 概念（3D 视口也没有 2D 那套柄 DOM）；OrbitControls 左键解绑（`LEFT: null`），中键/右键拖 = ROTATE，创建/选择手势只吃左键（`event.button !== 0` 早退），互不抢；host.test 弱断言锁住 mouseButtons 配置。

## 测试命令与输出摘要

- `npx tsc --noEmit` → TypeScript compilation completed（0 错误，全仓库，含并行票的 2D 改动）。
- `npx vitest run src/viewport3d src/components/toolbox.test.ts src/stores/editor.test.ts` → PASS 45 / FAIL 0。
- `npx vitest run`（全量，确认未波及并行领地）→ PASS 293 / FAIL 0。

## 疑虑

1. **右键从平移改为转镜头**：OrbitControls 默认右键是 PAN。按 spec 用户故事 59「3D 中键/右键拖仍是转镜头」执行，PAN 手势（右键拖）在本票后没有了（滚轮缩放保留）。若操作员依赖右键平移，需后续票定夺。
2. **体素拖动是水平平面语义**：拖动全程锁定按下格同高的水平面（`startWorld.y`），即拖动只整格平移 XZ、不改层——把块拖到别的体素面上不会自动堆高。垂直挪层用放置/删除完成。票面「拖到另一整数格平移」未要求换层，若要支持需三维拖动平面方案，建议票 11 一并考虑。
3. 选中视觉是体素换亮黄材质；box（参数体）在选择工具下仍不可拾取（票 11），点 box 现在等于点空（取消选中），与票面前状态一致。
