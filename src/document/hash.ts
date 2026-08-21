import {
  compressToEncodedURIComponent,
  decompressFromEncodedURIComponent,
} from "lz-string";
import { parseDocument, type GeometryDocument } from "./parse-document.ts";

export function documentToHash(document: GeometryDocument): string {
  return compressToEncodedURIComponent(JSON.stringify(document));
}

export function hashToDocument(
  hash: string,
): ReturnType<typeof parseDocument> {
  const payload = hash.startsWith("#") ? hash.slice(1) : hash;
  if (payload === "") {
    return { success: false, error: "invalid document hash" };
  }

  let json: string | null;
  try {
    json = decompressFromEncodedURIComponent(payload);
  } catch (error) {
    const detail = error instanceof Error ? error.message : "decompress failed";
    return { success: false, error: `invalid document hash: ${detail}` };
  }

  if (json == null || json === "") {
    return { success: false, error: "invalid document hash" };
  }

  return parseDocument(json);
}
