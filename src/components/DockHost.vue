<script setup lang="ts">
import { useDebounceFn, useLocalStorage } from "@vueuse/core";
import {
  defineComponent,
  h,
  onBeforeUnmount,
  ref,
  watch,
  type Component,
  type PropType,
} from "vue";
import { useI18n } from "vue-i18n";
import {
  DockviewVue,
  themeLight,
  type DockviewApi,
  type DockviewPanelApi,
  type DockviewReadyEvent,
} from "dockview-vue";
import ObjectListPanel from "./ObjectListPanel.vue";
import PropertiesPanel from "./PropertiesPanel.vue";
import ToolboxPanel from "./ToolboxPanel.vue";
import UnderlayPanel from "./UnderlayPanel.vue";
import ViewportPanel from "./ViewportPanel.vue";
import {
  CLOSABLE_PANEL_IDS,
  LAYOUT_STORAGE_KEY,
  PANEL_IDS,
  PANEL_TITLE_KEYS,
  VIEWPORT_PANEL_ID,
  factoryLayoutSnapshot,
  sanitizeLayoutSnapshot,
  type ClosablePanelId,
  type LayoutSnapshot,
} from "./layout.ts";
import { useEditorStore } from "../stores/editor.ts";

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
const editor = useEditorStore();
let dockApi: DockviewApi | null = null;

/** 面板标签：标题 + 关闭钮；视口永不可关，不渲染关闭钮 */
const PanelTab = defineComponent({
  name: "PanelTab",
  inheritAttrs: false,
  props: {
    // dockview-vue 传的是单个 params 包着面板 api 的视图 props
    params: {
      type: Object as PropType<{ api: DockviewPanelApi }>,
      required: true,
    },
  },
  setup(tabProps) {
    const api = tabProps.params.api;
    const title = ref(api.title ?? "");
    const titleDisposable = api.onDidTitleChange((event) => {
      title.value = event.title;
    });
    onBeforeUnmount(() => titleDisposable.dispose());
    const closable = api.id !== VIEWPORT_PANEL_ID;
    return () =>
      h("div", { class: "flex h-full min-w-0 items-center gap-1 text-sm" }, [
        h("span", { class: "truncate" }, title.value),
        closable
          ? h(
              "button",
              {
                type: "button",
                class:
                  "flex h-5 w-5 shrink-0 items-center justify-center rounded text-zinc-400 hover:bg-zinc-200 hover:text-zinc-700",
                "aria-label": t("layout.closePanel"),
                onClick: () => api.close(),
              },
              "×",
            )
          : null,
      ]);
  },
});

// 布局快照只存这台浏览器，不进说明书、不进分享链接
const storedLayout = useLocalStorage<string>(LAYOUT_STORAGE_KEY, "");

function onReady(event: DockviewReadyEvent): void {
  dockApi = event.api;
  applySnapshot(sanitizeLayoutSnapshot(storedLayout.value));
  const saveLayout = useDebounceFn(() => {
    if (dockApi === null) return;
    storedLayout.value = JSON.stringify(dockApi.toJSON());
    editor.setClosedPanelIds(
      CLOSABLE_PANEL_IDS.filter((id) => dockApi?.getPanel(id) === undefined),
    );
  }, 150);
  dockApi.onDidLayoutChange(saveLayout);
  // fromJSON 不触发 onDidLayoutChange，打开即落一份初始快照
  saveLayout();
}

/** 清空后按快照重摆；dockview 认不出的快照退回出厂，编辑器仍能用 */
function applySnapshot(snapshot: LayoutSnapshot): void {
  if (dockApi === null) return;
  dockApi.clear();
  try {
    dockApi.fromJSON(snapshot);
  } catch {
    dockApi.clear();
    dockApi.fromJSON(factoryLayoutSnapshot());
  }
  applyPanelTitles();
}

/** 面板标题跟随当前语言（快照里存的是上次语言） */
function applyPanelTitles(): void {
  if (dockApi === null) return;
  for (const id of PANEL_IDS) {
    dockApi.getPanel(id)?.setTitle(t(PANEL_TITLE_KEYS[id]));
  }
}

// 语言切换后更新已停靠面板的标签标题
watch(locale, applyPanelTitles);

/** 从顶栏重新打开面板时落回的列：工具侧在左、属性侧在右 */
const reopenSide: Record<ClosablePanelId, "left" | "right"> = {
  toolbox: "left",
  "object-list": "left",
  properties: "right",
  underlay: "right",
};

// 顶栏只发命令，停靠宿主是唯一执行者
watch(
  () => editor.layoutCommand,
  (command) => {
    if (dockApi === null || command === null) return;
    if (command.kind === "reset") {
      applySnapshot(factoryLayoutSnapshot());
      return;
    }
    if (command.kind === "open") {
      if (dockApi.getPanel(command.panel) !== undefined) return;
      dockApi.addPanel({
        id: command.panel,
        component: command.panel,
        title: t(PANEL_TITLE_KEYS[command.panel]),
        position: { referencePanel: VIEWPORT_PANEL_ID, direction: reopenSide[command.panel] },
      });
      return;
    }
    dockApi.getPanel(command.panel)?.api.close();
  },
);
</script>

<template>
  <!-- 只允许停靠区内并排/改大小/叠标签；禁用浮窗，dockview 默认也不弹出浏览器窗口。
       主题必须走 prop：dockview v8 不传 theme 默认 abyss 深色并会覆盖根元素 class。 -->
  <DockviewVue
    :theme="themeLight"
    class="h-full w-full"
    :components="components"
    :default-tab-component="PanelTab"
    :disable-floating-groups="true"
    @ready="onReady"
  />
</template>
