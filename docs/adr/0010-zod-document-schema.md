# 说明书用 Zod 作为运行时契约

图元封闭名单、字段英文、空间枚举都写在一份 Zod schema 里，并导出 TypeScript 类型。打开文件、解析分享链接、导入时 `safeParse`，不合法则拒绝并指出哪条图元坏了。不把 TypeScript 接口当成运行时校验，不另维护一份 JSON Schema。
