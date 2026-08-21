export const messages = {
  zh: {
    app: {
      title: "几何说明书编辑器",
    },
    file: {
      open: "打开",
      save: "保存",
      openFailed: "无法打开说明书",
    },
    history: {
      undo: "撤销",
      redo: "重做",
    },
    viewport: {
      label: "视口",
    },
    objectList: {
      label: "对象列表",
      empty: "空说明书，没有图元",
    },
    properties: {
      label: "属性",
      empty: "未选中图元",
      space: "空间",
      primitiveCount: "图元数量",
    },
    tool: {
      select: "选择",
      line: "线段",
      polygon: "多边形",
    },
    grid: {
      label: "格",
      unit: "1",
      half: "1/2",
      off: "关",
    },
    locale: {
      zh: "中文",
      en: "English",
    },
    prompt: {
      copy: "复制 Prompt",
    },
    share: {
      copy: "复制分享链接",
      restoreFailed: "无法从链接恢复说明书",
    },
  },
  en: {
    app: {
      title: "Geometry Document Editor",
    },
    file: {
      open: "Open",
      save: "Save",
      openFailed: "Could not open document",
    },
    history: {
      undo: "Undo",
      redo: "Redo",
    },
    viewport: {
      label: "Viewport",
    },
    objectList: {
      label: "Object list",
      empty: "Empty document, no primitives",
    },
    properties: {
      label: "Properties",
      empty: "No primitive selected",
      space: "Space",
      primitiveCount: "Primitive count",
    },
    tool: {
      select: "Select",
      line: "Line",
      polygon: "Polygon",
    },
    grid: {
      label: "Grid",
      unit: "1",
      half: "1/2",
      off: "Off",
    },
    locale: {
      zh: "中文",
      en: "English",
    },
    prompt: {
      copy: "Copy Prompt",
    },
    share: {
      copy: "Copy share link",
      restoreFailed: "Could not restore document from link",
    },
  },
} as const;
