# 04 — Prompt 与分享编码

**What to build:** 说明书可以确定性地生成 Prompt（含坐标约定与图元列表），也可以压进 URL hash 再解回同一份说明书。Prompt 不是真源；垫图像素不出现在 Prompt 里。

**Blocked by:** 02 — 说明书契约

**Status:** done

- [x] 同一份说明书两次生成的 Prompt 字符串相等
- [x] Prompt 写明 Y 向上、角度为度、3D Y 为高度，并列出版本图元
- [x] Prompt 不含垫图像素或本地文件路径
- [x] lz-string 压缩进 hash 再解开与原说明书结构相等
- [x] 上述有测试
