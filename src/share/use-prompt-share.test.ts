import { createPinia, setActivePinia } from "pinia";
import { beforeEach, describe, expect, test } from "vitest";
import {
  documentToHash,
  documentToPrompt,
  hashToDocument,
  parseDocument,
  type GeometryDocument,
} from "../document/index.ts";
import { messages } from "../i18n/messages.ts";
import { useDocumentStore } from "../stores/document.ts";
import { usePromptShare } from "./use-prompt-share.ts";

const lineDocument = {
  version: 1,
  space: "2d",
  underlay: null,
  primitives: [
    {
      id: "line-1",
      type: "line",
      points: [
        { x: 0, y: 0 },
        { x: 3, y: 4 },
      ],
    },
  ],
} as const;

function mustParse(input: unknown): GeometryDocument {
  const result = parseDocument(input);
  if (!result.success) {
    throw new Error(result.error);
  }
  return result.document;
}

describe("usePromptShare", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    window.location.hash = "";
  });

  test("loadHash restores the 说明书 encoded in the hash", () => {
    const store = useDocumentStore();
    const document = mustParse(lineDocument);
    const share = usePromptShare();

    const result = share.loadHash(documentToHash(document));

    expect(result.success).toBe(true);
    expect(store.current).toEqual(document);
    expect(store.hashError).toBeNull();
  });

  test("a damaged hash keeps the current 说明书 and reports the reason", () => {
    const store = useDocumentStore();
    store.openFromText(JSON.stringify(lineDocument));
    const before = structuredClone(store.current);
    const share = usePromptShare();

    const result = share.loadHash("not-a-valid-lz-payload");

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.length).toBeGreaterThan(0);
    expect(store.current).toEqual(before);
    expect(store.hashError).toBe(result.error);
  });

  test("copyPrompt returns the Prompt projection of the current 说明书", () => {
    const store = useDocumentStore();
    store.openFromText(JSON.stringify(lineDocument));
    const share = usePromptShare();

    expect(share.copyPrompt()).toBe(documentToPrompt(store.current));
  });

  test("copyShareUrl encodes the current 说明书 so opening the hash restores it", () => {
    const store = useDocumentStore();
    store.openFromText(JSON.stringify(lineDocument));
    const share = usePromptShare();

    const url = share.copyShareUrl();
    const parsed = new URL(url);
    const restored = hashToDocument(parsed.hash);

    expect(url).toContain(`#${documentToHash(store.current)}`);
    expect(restored.success).toBe(true);
    if (!restored.success) return;
    expect(restored.document).toEqual(store.current);
  });

  test("bootFromLocation restores from window.location.hash", () => {
    const store = useDocumentStore();
    const document = mustParse(lineDocument);
    window.location.hash = `#${documentToHash(document)}`;
    const share = usePromptShare();

    const result = share.bootFromLocation();

    expect(result.success).toBe(true);
    expect(store.current).toEqual(document);
  });

  test("bootFromLocation with a damaged hash does not clobber the current 说明书", () => {
    const store = useDocumentStore();
    store.openFromText(JSON.stringify(lineDocument));
    const before = structuredClone(store.current);
    window.location.hash = "#not-a-valid-lz-payload";
    const share = usePromptShare();

    const result = share.bootFromLocation();

    expect(result.success).toBe(false);
    expect(store.current).toEqual(before);
    expect(store.hashError).toBeTruthy();
  });

  test("bootFromLocation skips an empty hash", () => {
    const store = useDocumentStore();
    const share = usePromptShare();

    const result = share.bootFromLocation();

    expect(result.success).toBe(true);
    expect(store.current.primitives).toEqual([]);
    expect(store.hashError).toBeNull();
  });
});

describe("prompt and share copy", () => {
  test("zh and en expose prompt.copy and share.copy", () => {
    expect(messages.zh.prompt.copy).toMatch(/Prompt/);
    expect(messages.en.prompt.copy).toMatch(/Prompt/);
    expect(messages.zh.share.copy).toMatch(/分享/);
    expect(messages.en.share.copy).toMatch(/share/i);
    expect(messages.zh.share.restoreFailed).toMatch(/链接/);
    expect(messages.en.share.restoreFailed).toMatch(/link/i);
  });
});
