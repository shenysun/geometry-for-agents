<script setup lang="ts">
import { defineComponent, h, watch, type Component } from "vue";
import { useI18n } from "vue-i18n";
import {
  DockviewVue,
  type DockviewApi,
  type DockviewReadyEvent,
} from "dockview-vue";
import ObjectListPanel from "./ObjectListPanel.vue";
import PropertiesPanel from "./PropertiesPanel.vue";
import ToolboxPanel from "./ToolboxPanel.vue";
import UnderlayPanel from "./UnderlayPanel.vue";
import ViewportPanel from "./ViewportPanel.vue";

/** 五块面板的 id，出厂布局、标题更新都从这里取 */
const PANEL_IDS = [
  "toolbox",
  "object-list",
  "viewport",
  "properties",
  "underlay",
] as const;

type PanelId = (typeof PANEL_IDS)[number];

const panelTitleKeys: Record<PanelId, string> = {
  toolbox: "panel.toolbox",
  "object-list": "panel.objectList",
  viewport: "panel.viewport",
  properties: "panel.properties",
  underlay: "panel.underlay",
};

/**
 * dockview 会向面板组件传 params/api 等 props；
 * 包一层并关掉 attrs 透传，面板内容组件保持零停靠耦合。
 */
function dockBody(content: Component): Component {
  return defineComponent({
    name: "DockPanelBody",
    inheritAttrs: false,
    setup: () => () => h(content),
  });
}

const components: Record<string, Component> = {
  toolbox: dockBody(ToolboxPanel),
  "object-list": dockBody(ObjectListPanel),
  viewport: dockBody(ViewportPanel),
  properties: dockBody(PropertiesPanel),
  underlay: dockBody(UnderlayPanel),
};

const { locale, t } = useI18n();
let dockApi: DockviewApi | null = null;

function onReady(event: DockviewReadyEvent): void {
  dockApi = event.api;
  layoutFactory(event.api);
}

/** 出厂摆法：左列上工具箱下对象列表，中视口，右列上属性面板下垫图 */
function layoutFactory(api: DockviewApi): void {
  api.addPanel({
    id: "toolbox",
    component: "toolbox",
    title: t(panelTitleKeys.toolbox),
    initialWidth: 240,
  });
  api.addPanel({
    id: "object-list",
    component: "object-list",
    title: t(panelTitleKeys["object-list"]),
    position: { referencePanel: "toolbox", direction: "below" },
    minimumWidth: 180,
  });
  api.addPanel({
    id: "viewport",
    component: "viewport",
    title: t(panelTitleKeys.viewport),
    position: { referencePanel: "toolbox", direction: "right" },
  });
  api.addPanel({
    id: "properties",
    component: "properties",
    title: t(panelTitleKeys.properties),
    position: { referencePanel: "viewport", direction: "right" },
    initialWidth: 320,
  });
  api.addPanel({
    id: "underlay",
    component: "underlay",
    title: t(panelTitleKeys.underlay),
    position: { referencePanel: "properties", direction: "below" },
  });
}

// 语言切换后更新已停靠面板的标签标题
watch(locale, () => {
  if (dockApi === null) return;
  for (const id of PANEL_IDS) {
    dockApi.getPanel(id)?.setTitle(t(panelTitleKeys[id]));
  }
});
</script>

<template>
  <!-- 只允许停靠区内并排/改大小/叠标签；禁用浮窗，dockview 默认也不弹出浏览器窗口 -->
  <DockviewVue
    class="dockview-theme-light h-full w-full"
    :components="components"
    :disable-floating-groups="true"
    @ready="onReady"
  />
</template>
