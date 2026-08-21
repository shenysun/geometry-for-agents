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
    space: {
      label: "空间",
      twoD: "2D",
      threeD: "3D",
      confirmTitle: "切换空间会清空图元",
      confirmBody:
        "同一份说明书不能同时放平面图元和立体图元。确认后将清空当前图元并切换空间。",
      confirm: "清空并切换",
      cancel: "取消",
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
      circle: "圆",
      sector: "扇形",
      bow: "弓形",
      arc: "弧",
      ring: "圆环",
      ellipse: "椭圆",
      label: "点名",
    },
    fill: {
      label: "填充",
      none: "无",
      solid: "实心",
      hatch: "阴影",
    },
    grid: {
      label: "格",
      unit: "1",
      half: "1/2",
      off: "关",
    },
    underlay: {
      label: "垫图",
      url: "题图地址",
      applyUrl: "应用地址",
      importFile: "导入本机题图",
      opacity: "透明度",
      x: "X",
      y: "Y",
      scale: "缩放",
      clear: "清除垫图",
      localOnly: "本机题图不进入说明书",
      httpOnly: "仅 http(s) 地址会写入说明书",
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
    space: {
      label: "Space",
      twoD: "2D",
      threeD: "3D",
      confirmTitle: "Switching space clears primitives",
      confirmBody:
        "A document cannot mix planar and solid primitives. Confirming clears the current primitives and switches space.",
      confirm: "Clear and switch",
      cancel: "Cancel",
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
      circle: "Circle",
      sector: "Sector",
      bow: "Bow",
      arc: "Arc",
      ring: "Ring",
      ellipse: "Ellipse",
      label: "Label",
    },
    fill: {
      label: "Fill",
      none: "None",
      solid: "Solid",
      hatch: "Hatch",
    },
    grid: {
      label: "Grid",
      unit: "1",
      half: "1/2",
      off: "Off",
    },
    underlay: {
      label: "Underlay",
      url: "Image URL",
      applyUrl: "Apply URL",
      importFile: "Import local image",
      opacity: "Opacity",
      x: "X",
      y: "Y",
      scale: "Scale",
      clear: "Clear underlay",
      localOnly: "Local image stays on this device",
      httpOnly: "Only http(s) URLs enter the document",
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
