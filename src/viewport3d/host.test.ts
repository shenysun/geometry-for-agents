import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, test } from "vitest";

const dir = import.meta.dirname;

describe("3d viewport host", () => {
  test("Vue host creates a full-size element for the imperative Three projector", () => {
    const source = readFileSync(resolve(dir, "Viewport3d.vue"), "utf8");

    expect(source).toContain("data-viewport-3d");
    expect(source).toContain("createViewport3dProjector");
    expect(source).toContain("projector.render");
    expect(source).toContain("setPreview");
    expect(source).toContain("addPrimitive");
    expect(source).toContain("removePrimitive");
    expect(source).not.toMatch(/TresCanvas|TresMesh|vue-konva/i);
  });

  test("projector is render plus setPreview using THREE.WebGLRenderer", () => {
    const source = readFileSync(resolve(dir, "projector.ts"), "utf8");

    expect(source).toContain("renderDocument(document: GeometryDocument)");
    expect(source).toContain("setPreview");
    expect(source).toContain("new THREE.WebGLRenderer");
    expect(source).toContain("OrbitControls");
    expect(source).toMatch(/["']Y["']/);
    expect(source).not.toMatch(/TresCanvas|TresJS|vue-konva/i);
  });

  test("选择工具接线：选择手势在左键先于放置，平移提交走 translateVoxel", () => {
    const source = readFileSync(resolve(dir, "Viewport3d.vue"), "utf8");

    expect(source).toContain("startSelect3d");
    expect(source).toContain("moveSelect3d");
    expect(source).toContain("upSelect3d");
    expect(source).toContain("clickSelect3d");
    expect(source).toContain("translateVoxel");
    expect(source).toContain("setSelection");
    // 放置预览有创建工具守卫：选择工具的左键到不了放置路径
    expect(source).toContain("!isCreateTool()");
    expect(source.indexOf("isSelectTool()")).toBeLessThan(
      source.indexOf("commitVoxel("),
    );
  });

  test("左键让位给编辑器手势，中键/右键拖转镜头", () => {
    const source = readFileSync(resolve(dir, "projector.ts"), "utf8");

    expect(source).toContain("mouseButtons");
    expect(source).toContain("LEFT: null");
    expect(source).toContain("THREE.MOUSE.ROTATE");
  });
});
