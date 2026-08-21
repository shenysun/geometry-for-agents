# 2D 视口 Konva，3D 视口 Three.js

说明书是与渲染器无关的 JSON。2D 用 Konva（层、选择、拖拽），3D 用 Three.js（与现有课件和旧体素工具一致）。Reka UI 只做壳。不把 Konva `toJSON()` 或 Three 场景树当说明书；不用 Three 正交相机兼做 2D 编辑器；不用 JSXGraph/GeoGebra 当内核。2D 的 Y 向上在适配层换算，因为 Konva 默认 Y 向下。
