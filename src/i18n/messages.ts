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
      placeholder: "视口占位（投影器尚未接入）",
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
    locale: {
      zh: "中文",
      en: "English",
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
      placeholder: "Viewport placeholder (projector not wired yet)",
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
    locale: {
      zh: "中文",
      en: "English",
    },
  },
} as const;
