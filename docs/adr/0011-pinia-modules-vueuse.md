# Pinia 分模块，能用 VueUse 就不用手写

编辑状态用 Pinia，拆两块：`document`（当前说明书 + undo/redo 快照；垫图 URL/对齐若要能分享也在说明书里）和 `editor`（空间、工具、选中、格）。不拆视口 / 历史 / 图元 store。浏览器侧能力优先 VueUse。Konva / Three 投影器在 Pinia 外面，只订阅说明书。
