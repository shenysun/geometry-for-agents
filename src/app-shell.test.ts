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
    expect(deps.tailwindcss).toBeDefined();
    expect(deps["@vueuse/core"]).toBeDefined();
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

  test("object list items are clickable to set selectionId", () => {
    const source = readFileSync(
      resolve(root, "src/components/EditorShell.vue"),
      "utf8",
    );

    expect(source).toMatch(/@click="[^"]*setSelectionId/);
    expect(source).toContain("editor.selectionId");
    expect(source).toContain("bg-zinc-100");
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
