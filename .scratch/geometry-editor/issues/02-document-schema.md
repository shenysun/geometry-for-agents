# 02 — 说明书契约

**What to build:** 说明书是带 Zod 校验的 JSON：`version`、`space`（2d 或 3d）、`underlay`、图元封闭名单。合法文件能解析；未知图元或图元与空间不符会被拒绝并说明原因。这是整份产品的测试缝。

**Blocked by:** None — can start immediately

**Status:** done

- [x] Zod schema 覆盖 spec 中的图元 `type`（含 `line`/`bow`/`voxel` 等），字段英文
- [x] 合法说明书 parse 成功并得到类型
- [x] 未知 `type`、缺字段、2D 图元放进 `space: "3d"`（及反过来）均失败
- [x] 坐标约定写在 schema 说明里：2D Y 向上；3D Y 为高度，voxel 占 `[x,x+1]×[y,y+1]×[z,z+1]`
