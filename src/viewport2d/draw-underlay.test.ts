import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createPinia, setActivePinia } from "pinia";
import { beforeEach, describe, expect, test } from "vitest";
import {
  documentToHash,
  documentToPrompt,
  hashToDocument,
  parseDocument,
} from "../document/index.ts";
import { serializeDocument } from "../io/open-save.ts";
import { useDocumentStore } from "../stores/document.ts";
import { useEditorStore } from "../stores/editor.ts";
import {
  assignUnderlaySource,
  isHttpUnderlayUrl,
} from "./draw-underlay.ts";

const alignment = {
  opacity: 0.4,
  x: 1,
  y: -2,
  scale: 1.5,
} as const;

const httpsUrl = "https://example.com/problem.png";

describe("isHttpUnderlayUrl", () => {
  test("accepts http and https URLs", () => {
    expect(isHttpUnderlayUrl(httpsUrl)).toBe(true);
    expect(isHttpUnderlayUrl("http://example.com/problem.png")).toBe(true);
  });

  test("rejects file paths, blob URLs, and data URLs", () => {
    expect(isHttpUnderlayUrl("file:///tmp/problem.png")).toBe(false);
    expect(isHttpUnderlayUrl("/tmp/problem.png")).toBe(false);
    expect(isHttpUnderlayUrl("C:\\\\images\\\\problem.png")).toBe(false);
    expect(isHttpUnderlayUrl("blob:http://localhost:5173/abc")).toBe(false);
    expect(isHttpUnderlayUrl("data:image/png;base64,aaaa")).toBe(false);
  });
});

describe("assignUnderlaySource", () => {
  test("https source writes url and alignment onto document.underlay", () => {
    const assignment = assignUnderlaySource(httpsUrl, alignment);

    expect(assignment.documentUnderlay).toEqual({
      url: httpsUrl,
      opacity: 0.4,
      x: 1,
      y: -2,
      scale: 1.5,
    });
    expect(assignment.sessionUnderlay).toBeNull();
  });

  test("file path and blob stay on the session and omit document.underlay", () => {
    const fileAssignment = assignUnderlaySource("file:///tmp/problem.png", alignment);
    const blobAssignment = assignUnderlaySource(
      "blob:http://localhost:5173/abc",
      alignment,
    );

    expect(fileAssignment.documentUnderlay).toBeNull();
    expect(fileAssignment.sessionUnderlay).toEqual({
      url: "file:///tmp/problem.png",
      ...alignment,
    });
    expect(blobAssignment.documentUnderlay).toBeNull();
    expect(blobAssignment.sessionUnderlay?.url).toBe(
      "blob:http://localhost:5173/abc",
    );
  });
});

describe("applying underlay through stores", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  test("https URL sets document.underlay.url and alignment roundtrips", () => {
    const documentStore = useDocumentStore();
    const editorStore = useEditorStore();
    const assignment = assignUnderlaySource(httpsUrl, alignment);

    editorStore.setSessionUnderlay(assignment.sessionUnderlay);
    const result = documentStore.setUnderlay(assignment.documentUnderlay);

    expect(result.success).toBe(true);
    expect(documentStore.current.underlay).toEqual({
      url: httpsUrl,
      opacity: 0.4,
      x: 1,
      y: -2,
      scale: 1.5,
    });
    expect(editorStore.sessionUnderlay).toBeNull();

    const json = serializeDocument(documentStore.current);
    const parsed = parseDocument(json);
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect(parsed.document.underlay).toEqual(documentStore.current.underlay);
  });

  test("local file and blob stay out of JSON, hash, and Prompt", () => {
    const documentStore = useDocumentStore();
    const editorStore = useEditorStore();
    const blobUrl = "blob:http://localhost:5173/session-image";
    const assignment = assignUnderlaySource(blobUrl, alignment);

    editorStore.setSessionUnderlay(assignment.sessionUnderlay);
    documentStore.setUnderlay(assignment.documentUnderlay);

    expect(editorStore.sessionUnderlay?.url).toBe(blobUrl);
    expect(documentStore.current.underlay).toBeNull();

    const json = serializeDocument(documentStore.current);
    expect(json).not.toContain(blobUrl);
    expect(json).not.toMatch(/blob:/);
    expect(json).not.toMatch(/file:/);
    expect(json).not.toContain("/tmp/");

    const prompt = documentToPrompt(documentStore.current);
    expect(prompt).not.toContain(blobUrl);
    expect(prompt.toLowerCase()).not.toContain("underlay");
    expect(prompt).not.toMatch(/data:image/i);
    expect(prompt).not.toContain("problem.png");

    const hash = documentToHash(documentStore.current);
    const decoded = hashToDocument(hash);
    expect(decoded.success).toBe(true);
    if (!decoded.success) return;
    expect(decoded.document.underlay).toBeNull();
    expect(JSON.stringify(decoded.document)).not.toContain(blobUrl);
  });

  test("opening a 说明书 clears the in-session local underlay", () => {
    const documentStore = useDocumentStore();
    const editorStore = useEditorStore();
    editorStore.setSessionUnderlay({
      url: "blob:http://localhost:5173/session-image",
      ...alignment,
    });

    const opened = documentStore.openFromText(
      JSON.stringify({
        version: 1,
        space: "2d",
        underlay: null,
        primitives: [],
      }),
    );

    expect(opened.success).toBe(true);
    expect(editorStore.sessionUnderlay).toBeNull();
  });
});

describe("2d projector underlay layer", () => {
  test("underlay sits between grid and primitives, and is not a vue-konva tree", () => {
    const source = readFileSync(resolve(import.meta.dirname, "projector.ts"), "utf8");

    expect(source).toContain("drawUnderlay");
    expect(source).toMatch(
      /stage\.add\(\s*gridLayer,\s*underlayLayer,\s*primitiveLayer,\s*previewLayer\s*\)/,
    );
    expect(source).not.toMatch(/vue-konva/);
  });
});
