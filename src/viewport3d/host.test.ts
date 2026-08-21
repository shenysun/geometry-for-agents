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

    expect(source).toContain("render(document: GeometryDocument)");
    expect(source).toContain("setPreview");
    expect(source).toContain("new THREE.WebGLRenderer");
    expect(source).toContain("OrbitControls");
    expect(source).toMatch(/["']Y["']/);
    expect(source).not.toMatch(/TresCanvas|TresJS|vue-konva/i);
  });
});
