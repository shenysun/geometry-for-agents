# 两轴审查修复报告

- Commit：`f4042ed176306a2b7a236c690cc4150815074956`（`fix: 审查修复——3D 格开关可见与去重归一`）
- 验证：`npx tsc --noEmit` 零错误；`npx vitest run` 380/380；`npm run build` 成功（chunk >500 kB 警告为既有状况，非错误）。
- 修法基调：全部走「归一到一份、让编译器/数据推导」的路线，无 workaround。

## 逐项修复说明

### 1. 3D 下格开关不可见（Spec，最重要）

- 文件：`src/components/DrawToolbar.vue`
- 修法：删掉 ToggleGroupRoot 上的 `v-if="is2d"`，格开关在 2D/3D 两空间常驻；随之删除不再使用的 `is2d` computed 与 `computed` 导入，并加注释说明「2D 图元与 3D 参数体吃同一套格，体素仍锁整数角」。
- 补测试：`src/app-shell.test.ts` 顶栏测试新增断言 `expect(drawToolbar).not.toContain("is2d")`，防止回归。
- 行为边界：体素不受影响——voxel 提交路径（integerDelta/snapVoxel）本来就不看格步长。

### 2. Select3dContext.alt 死参数

- 文件：`src/viewport3d/select-gesture-3d.ts`、`src/viewport3d/Viewport3d.vue`、对应 test。
- 修法：删 `alt?: boolean` 字段与 Viewport3d 的 `alt: event.altKey` 传参；Alt 的真实链路是视口层 `gridForEvent(event)` 把 altKey 折算成 `grid: "off"`，手势层注释改写为说明这一点。
- 测试清理：删 baseContext/solidContext 的 `alt: false`、体素预览测试里的 altHeld 变体（体素与格/Alt 无关，offGrid 变体已覆盖等价语义）、参数体关格测试的 `alt: true`（保留 `grid: "off"` 本体）。

### 3. parse-document 手抄类型名单与注释自相矛盾

- 文件：`src/document/parse-document.ts`
- 修法：删除手抄的 `twoDTypes`/`threeDTypes` Set，新增 `typeNamesOf(union)` 从判别联合的 `options.map(o => o.shape.type.value)` 推导（zod v4 实测可用），报错文案来源与 schema 单一来源化——新增图元类型不再需要同步改两处。

### 4. SolidPrimitive 双定义

- 文件：`src/document/update-document.ts`、`src/document/index.ts`、`src/viewport3d/solid-commit.ts`
- 修法：保留 document 层 `Exclude<Primitive3d, { type: "voxel" }>` 这份定义，`document/index.ts` 增加导出；solid-commit.ts 删掉自己的六成员联合，改为 import + `export type { SolidPrimitive }` 转手导出，projector/属性面板等既有引用路径全部不断链。两份定义语义等价已由 tsc 在 re-export 切换下全量编译证实。

### 5. toolbox 手抄 3D 名单

- 文件：`src/components/toolbox.ts`
- 修法：`TOOLS_PER_SPACE["3d"] = ["select", "voxel", ...SOLID_TOOLS]`，与 editor store 同一写法；顺序不变（select、voxel、box、cylinder、cone、sphere、pyramid、triangularPrism），既有 toolbox.test 顺序断言原样通过。

### 6. box 残留（boxAnchorFromWorld 重复 / commitBox 手写欧拉角）

- 文件：`src/viewport3d/solid-commit.ts`（+）、`src/viewport3d/box-commit.ts`（删）、`src/viewport3d/index.ts`、`src/viewport3d/projector.ts`、测试并入。
- 修法：box 本就是 SOLID_TOOLS 六参数体之一，commitSolid 早已分发到 commitBox，两个文件并立是波 3 → 波 5 的历史残留。把 `commitBox`/`BOX_DEFAULTS`/`BoxPrimitive` 移入 solid-commit.ts，commitBox 改用通用的 `solidAnchorFromWorld()` 与 `solidRotation()`，`boxAnchorFromWorld` 整体删除；box-commit.ts 与 box-commit.test.ts 删除，用例（含改为测 solidAnchorFromWorld 的 anchor 断言）并入 solid-commit.test.ts。这样也避免了「box-commit 反向 import solid-commit」的循环依赖。
- barrel 与 projector 的 import 路径同步更新。

### 7. snap3d 副本

- 文件：`src/document/snap.ts`、`src/document/index.ts`、`src/document/update-document.ts`、`src/viewport3d/solid-commit.ts`、`src/viewport3d/select-gesture-3d.ts`、`src/viewport3d/index.ts`、删 `src/viewport3d/snap3d.ts`。
- 修法：snap3d 落户 `document/snap.ts`（复用同文件的 `snapCoord`，含 `-0` 归一，与原实现逐位一致），document/index.ts 导出；update-document.ts 删自持的 `snap3dInDocument` 副本改引同一份；视口层三个消费方与 barrel 改引 document 层，viewport3d/snap3d.ts 删除；其测试原样迁入 `src/document/snap.test.ts`。行为零变化。

## 测试前后对照

| 时点 | tsc | vitest | build |
| --- | --- | --- | --- |
| 修前基线 | 零错误 | 380/380 | 成功 |
| 每项修完（1-7 逐项跑全量） | 零错误 | 380/380 | — |
| 终态 | 零错误 | 380/380 | 成功 |

测试数不变的原因：删除的只有断言块（altHeld）与文件迁移（box-commit.test → solid-commit.test、snap3d.test → snap.test），未删测试用例；另在 app-shell.test 既有用例内新增一条格开关回归断言。

## 明确不做（审查判断题，留待专门票）

projector 姿态五函数去重、Viewport2d/3d 壳层共享、SolidPose 类型收拢、hit.ts reduce 写法、samePrimitive 的 JSON.stringify 比较——均按指令未动。

## 疑虑

1. **格开关测试是源码文本断言**（app-shell.test.ts 既有风格是 readFileSync + toContain），只能防 `is2d` 字面回归，防不住换成其他写法的空间隐藏；组件级渲染测试（挂载后切 3D 断言开关可见）本仓库尚无先例基建，未引入。
2. **box-commit 文件消失**：commit hash 的 diff 里是删除 + 迁移，若后续有人基于旧文件 cherry-pick 会冲突；但引用面已全部收拢（`rg box-commit` 零残留）。
3. **parse-document 的 `option.shape.type.value`** 依赖 zod v4 discriminatedUnion 的公开形态（4.4.3 实测通过）；zod 若大版本变动此处可能需要跟进（与 schema 本身同源的演进成本，可接受）。
4. **solid-commit.ts 体量增长**：并入 commitBox 后约 280 行，仍远低于 800 行上限；七个参数体提交聚在一起与 SOLID_TOOLS 单一来源互为印证，判断为更优结构。
