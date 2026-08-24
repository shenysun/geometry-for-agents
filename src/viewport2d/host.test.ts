import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, test } from "vitest";

const dir = import.meta.dirname;

describe("2d viewport host", () => {
  test("Vue host creates a full-size element for the imperative Konva stage", () => {
    const source = readFileSync(resolve(dir, "Viewport2d.vue"), "utf8");

    expect(source).toContain("data-viewport-2d");
    expect(source).toContain("createViewport2dProjector");
    expect(source).toContain("projector.render");
    expect(source).not.toMatch(/vue-konva|v-circle|v-layer|TresCanvas/i);
  });

  test("projector is render plus setPreview, not a vue-konva tree", () => {
    const source = readFileSync(resolve(dir, "projector.ts"), "utf8");

    expect(source).toContain("render(document: GeometryDocument)");
    expect(source).toContain("setPreview");
    expect(source).toContain("setTool");
    expect(source).toContain("new Konva.Stage");
    expect(source).not.toMatch(/vue-konva/);
    expect(source).toContain("crosshair");
  });

  test("Vue host wires draw gestures when the tool is line or polygon", () => {
    const source = readFileSync(resolve(dir, "Viewport2d.vue"), "utf8");

    expect(source).toContain("startDraw");
    expect(source).toContain("clickDraw");
    expect(source).toContain("escDraw");
    expect(source).toContain("addPrimitive");
    expect(source).toContain("startSelect");
    expect(source).toContain("removePrimitive");
    expect(source).not.toMatch(/vue-konva|v-circle|v-layer|TresCanvas/i);
  });
});
