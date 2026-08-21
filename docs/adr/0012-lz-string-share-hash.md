# 分享链接用 lz-string 压进 URL hash

说明书 JSON 经 `lz-string` 的 `compressToEncodedURIComponent` 放进 `#` 后。不压缩会在图元或垫图 URL 变长时顶破地址栏；第一期不上 fflate/WASM gzip。
