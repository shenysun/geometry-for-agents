# 11 — 复制 Prompt 与分享链接

**What to build:** 操作员能复制当前说明书对应的 Prompt，也能复制分享链接。别人打开带 hash 的 URL 即恢复同一份说明书（垫图仅当 URL 可访问时出现）。

**Blocked by:** 04 — Prompt 与分享编码；06 — 打开与保存 JSON

**Status:** ready-for-agent

- [ ] 一键复制 Prompt，内容由说明书生成
- [ ] 一键复制含 hash 的分享链接
- [ ] 用该链接打开应用后说明书与导出时一致
- [ ] 损坏的 hash 被拒绝并提示，不静默清空合法文档（若当前已有）
