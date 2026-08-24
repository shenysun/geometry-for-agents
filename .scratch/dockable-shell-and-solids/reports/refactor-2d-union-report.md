# 重构报告：图元联合收窄为 2D/3D 两支

行为等价的类型重构。目的：2D 专属的穷尽 switch 不再靠 voxel/box 占位分支保穷尽，
下一波加 5 种 3D 参数体（cylinder/cone/sphere/pyramid/triangularPrism）时，
2D 侧文件零改动——编译器保证 3D 类型进不来。

## 一、契约层：Primitive = Primitive2d | Primitive3d

`src/document/parse-document.ts`：两个子联合从已有的 Zod schema 推导，不手抄成员名单：

```ts
export type Primitive2d = z.infer<typeof twoDPrimitiveSchema>;  // 9 种 2D 图元
export type Primitive3d = z.infer<typeof threeDPrimitiveSchema>; // voxel + box
export type Primitive = Primitive2d | Primitive3d;
```

原 `Primitive = GeometryDocument["primitives"][number]` 与新定义类型等价
（documentSchema 按 space 判别，primitives 字段就是两个子联合的数组），
全仓 tsc 0 错误即证。`src/document/index.ts` 转出口三个类型。

## 二、收窄的签名（语义上只属于 2D）

| 文件 | 签名 | 之前 |
|---|---|---|
| `src/document/hit.ts` | `contains(primitive: Primitive2d, …)` | `Primitive` |
| `src/document/hit.ts` | `area(primitive: Primitive2d)` | `Primitive` |
| `src/document/hit.ts` | `isClosed(primitive: Primitive2d)` | `Primitive` |
| `src/document/hit.ts` | `closedTypes: Set<Primitive2d["type"]>` | 含 "voxel" |
| `src/viewport2d/draw-primitives.ts` | `drawPrimitive(primitive: Primitive2d, …)` | `Primitive` |
| `src/viewport2d/draw-primitives.ts` | `previewPrimitive(…): Primitive2d \| null` | `Primitive \| null` |
| `src/viewport2d/draw-gesture.ts` | `DrawGestureResult.commit: Primitive2d \| null` 及 `result`/`commitAndIdle`/`commitSweep` 三处标注 | `Primitive` |
| `src/document/update-document.ts` | 删掉手抄的 `TwoDType` 名单与 `TwoDPrimitive = Extract<…>`，全文统一用 `Primitive2d`（translate/rotate/scale/moveControlPoint 的 Geometry 族纯函数、`primitiveAnchor`、`ellipseLocalOffset`） | 手抄名单 |

## 三、删掉的占位 case

- `hit.ts` `contains`：`case "voxel": return inVoxel(…)` 与 `case "box": return false`（含票 08 注释）
- `hit.ts` `area`：`case "voxel": return 1` 与 `case "box": return Number.POSITIVE_INFINITY`（含票 08 注释）
- `draw-primitives.ts` `drawPrimitive`：`case "voxel": return []` 与 `case "box": return []`（含票 08 注释）

### voxel 命中不是占位，移入 3D 分支（行为等价的关键）

hit.test.ts 有 3D 体素点命中的真实用例，`inVoxel` 是真实行为，不能删。
`hitTest` 改为按 space 分派：2D 走原 contains/area 路径（逐一未动）；
3D 走新的 `hitVoxels(primitives: Primitive3d[], point)`。

等价性推导：原 3D 路径里 box 的 contains 恒 false 永不进 hits；命中的全是 voxel，
voxel 在 closedTypes 里（恒闭合），area 恒 1，`area(candidate) <= area(best)`
在并列时取列表靠后者——即"最后一个命中的体素"。`hitVoxels` 的
`filter(voxel && inVoxel)` + `reduce((_, c) => c)` 精确复现该结果，
测试全部通过验证了这一点。

## 四、调用点跟随清单

| 文件 | 跟随 |
|---|---|
| `src/viewport2d/select-gesture.ts` | `TwoDPrimitive` → `Primitive2d`（从 document/index 导入），`handleReach`/`transformHandles`/`previewFromPrimitive`/`draggedPrimitive` 四处标注 |
| `src/viewport2d/control-points.ts` | `controlPoints(primitive: Primitive2d)`，import 改从 document/index |
| `src/viewport2d/draw-primitives.ts` | `drawDocumentPrimitives` 已有 `space !== "2d"` 早退，判别后 primitives 即 `Primitive2d[]`，无需新守卫 |
| `src/document/update-document.test.ts` | 类型 import 跟随（`Primitive2d` 改自 ./index.ts） |
| `src/viewport2d/control-points.test.ts` | 同上 |

无需跟随的：`Viewport2d.vue`（store 的 `addPrimitive/updatePrimitive(primitive: Primitive)`
接 `Primitive2d` 子类型）；`stores/document.ts`、`prompt.ts`、`hash.ts`（全空间语义，不动）；
`viewport3d/**`（`Extract<Primitive, { type: "voxel" | "box" }>` 在新联合上语义不变，领地外不动）；
`fill.ts` 的 `withFill`（default 兜底模式，非占位穷尽 switch，3D 图元运行时已返回 null，
收窄需向 PropertiesPanel 引入守卫函数，扰动大于收益，未动）。

## 五、前后测试对照

| | tsc --noEmit | vitest run |
|---|---|---|
| 重构前（基线） | 0 错误 | 293 过 / 0 败 |
| 重构后 | 0 错误 | 293 过 / 0 败 |

纯类型与等价结构重排，无运行时行为变化，无契约字段变化。

## 六、遗留疑虑（供后续票参考）

1. `parse-document.ts` 里 `twoDTypes`/`threeDTypes` 两个运行时 Set 仍是手抄名单
   （`spaceMismatchError` 的报错用）。下次加 3D 参数体时要记得同步它；
   可考虑改为从 `twoDPrimitiveSchema.options` 推导，一劳永逸（本次属运行时构造，
   超出"类型跟随"领地，未动）。
2. 波 5 加 5 种 3D 参数体后：`Primitive3d` 自动扩员，`hit.ts` 的 `hitVoxels`
   （只认 voxel）与 `viewport3d` 的 `BoxPrimitive` 提取都不受影响；
   2D 侧四个文件完全不用碰。
