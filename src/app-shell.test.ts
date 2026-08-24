import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createPinia, setActivePinia } from "pinia";
import { describe, expect, test } from "vitest";
import { useDocumentStore } from "./stores/document.ts";
import { useEditorStore } from "./stores/editor.ts";

const root = resolve(import.meta.dirname, "..");

describe("app shell", () => {
  test("package.json exposes vite dev, build, and preview scripts", () => {
    const pkg = JSON.parse(readFileSync(resolve(root, "package.json"), "utf8")) as {
      scripts?: Record<string, string>;
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };
    const scripts = pkg.scripts ?? {};
    const deps = { ...pkg.dependencies, ...pkg.devDependencies };

    expect(scripts.dev).toMatch(/vite/);
    expect(scripts.build).toMatch(/vite/);
    expect(scripts.preview).toMatch(/vite/);
    expect(deps.vue).toBeDefined();
    expect(deps.pinia).toBeDefined();
    expect(deps["vue-i18n"]).toBeDefined();
    expect(deps["reka-ui"]).toBeDefined();
    expect(deps["dockview-vue"]).toBeDefined();
    expect(deps.tailwindcss).toBeDefined();
    expect(deps["@vueuse/core"]).toBeDefined();
    expect(deps.three).toBeDefined();
  });

  test("vite config exists", async () => {
    const config = await import("../vite.config.ts");
    expect(config.default).toBeTypeOf("object");
  });

  test("LICENSE is MIT", () => {
    const license = readFileSync(resolve(root, "LICENSE"), "utf8");
    expect(license).toMatch(/MIT License/);
    expect(license).toMatch(/Permission is hereby granted, free of charge/);
  });

  test("object list is its own panel component with clickable items", () => {
    const source = readFileSync(
      resolve(root, "src/components/ObjectListPanel.vue"),
      "utf8",
    );

    expect(source).toMatch(/@click="[^"]*setSelectionId/);
    expect(source).toContain("editor.selectionId");
    expect(source).toContain("bg-zinc-100");
  });

  test("shell toggles 2d/3d and mounts the 3d viewport from 说明书 space", () => {
    const shell = readFileSync(
      resolve(root, "src/components/EditorShell.vue"),
      "utf8",
    );
    const viewportPanel = readFileSync(
      resolve(root, "src/components/ViewportPanel.vue"),
      "utf8",
    );

    expect(shell).toContain("requestSpaceChange");
    expect(shell).toContain("clearAndSetSpace");
    expect(viewportPanel).toContain("Viewport3d");
    expect(viewportPanel).toContain('current.space === "3d"');
    expect(viewportPanel).not.toMatch(/TresCanvas/i);
  });

  test("dockview-vue hosts the five dockable panels in the factory layout", () => {
    const dockHost = readFileSync(
      resolve(root, "src/components/DockHost.vue"),
      "utf8",
    );

    expect(dockHost).toContain("DockviewVue");
    // 只在停靠区内并排/改大小/叠标签，无浮窗
    expect(dockHost).toContain("disable-floating-groups");
    for (const id of [
      "toolbox",
      "object-list",
      "viewport",
      "properties",
      "underlay",
    ]) {
      expect(dockHost).toContain(`id: "${id}"`);
    }
    // 出厂摆法：左列上工具箱下对象列表，中视口，右列上属性下垫图
    expect(dockHost).toContain('position: { referencePanel: "toolbox", direction: "below" }');
    expect(dockHost).toContain('position: { referencePanel: "properties", direction: "below" }');
  });

  test("top bar stays outside the dock area and the shell drops raw JSON", () => {
    const shell = readFileSync(
      resolve(root, "src/components/EditorShell.vue"),
      "utf8",
    );
    const dockHost = readFileSync(
      resolve(root, "src/components/DockHost.vue"),
      "utf8",
    );

    expect(shell).toContain("<header");
    // dockview 装配只出现在停靠宿主里，顶栏不进停靠区
    expect(shell).not.toContain("DockviewVue");
    // 属性列不再内联对象列表、垫图与说明书 JSON 原文
    expect(shell).not.toContain("UnderlayPanel");
    expect(shell).not.toContain("serializedDocument");
    // 垫图、属性都是停靠面板，垫图不再是属性面板的一部分
    expect(dockHost).toContain("UnderlayPanel");
    expect(dockHost).toContain("PropertiesPanel");
    expect(dockHost).not.toContain("serializedDocument");
  });

  test("properties panel commits fill for a selected closed primitive", () => {
    const source = readFileSync(
      resolve(root, "src/components/PropertiesPanel.vue"),
      "utf8",
    );

    expect(source).toContain("withFill");
    expect(source).toContain("updatePrimitive");
    expect(source).toContain("FILLS");
    expect(source).toContain('value !== "none" && value !== "solid" && value !== "hatch"');
  });

  test("toolbox panel lists toolsForSpace and the top bar drops creation tools", () => {
    const toolbox = readFileSync(
      resolve(root, "src/components/ToolboxPanel.vue"),
      "utf8",
    );
    const drawToolbar = readFileSync(
      resolve(root, "src/components/DrawToolbar.vue"),
      "utf8",
    );

    // 工具箱渲染目录、图标加名称，点选即切 editor.tool
    expect(toolbox).toContain("toolsForSpace");
    expect(toolbox).toContain("setTool");
    expect(toolbox).toContain("editor.tool");
    expect(toolbox).toContain("<svg");
    // 顶栏不再放创建工具，格开关留下
    expect(drawToolbar).not.toContain("DRAW_TOOLS");
    expect(drawToolbar).not.toContain("isDrawTool");
    expect(drawToolbar).not.toContain("tool.select");
    expect(drawToolbar).toContain("setGrid");
  });

  test("Pinia has only document and editor modules", () => {
    const pinia = createPinia();
    setActivePinia(pinia);
    useDocumentStore();
    useEditorStore();

    expect(Object.keys(pinia.state.value).sort()).toEqual(["document", "editor"]);

    const storeFiles = Object.keys(import.meta.glob("./stores/*.ts"))
      .map((path) => path.replace("./stores/", ""))
      .filter((name) => !name.endsWith(".test.ts"))
      .sort();
    expect(storeFiles).toEqual(["document.ts", "editor.ts"]);
  });
});
