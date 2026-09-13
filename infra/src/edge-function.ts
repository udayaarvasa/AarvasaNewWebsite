import { readFileSync } from "node:fs";
import { join } from "node:path";
import { LIB_KEY_PATTERN, MEDIA_KEY_PATTERN, edgeExtensionAllowlist } from "../../shared/media-contract";

/** CloudFront Functions reject code larger than 10 KB. */
export const MAX_FUNCTION_BYTES = 10 * 1024;

const TEMPLATE_PATH = join(__dirname, "..", "..", "..", "functions", "viewer-request.js");

/** Encodes a value as JSON that is safe inside a single-quoted JS string literal. */
function jsonForSingleQuotedLiteral(value: unknown): string {
  return JSON.stringify(value).replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

/** Renders the viewer-request function with the environment's origins and the media contract. */
export function renderViewerRequestFunction(allowedOrigins: readonly string[]): string {
  const { media, lib } = edgeExtensionAllowlist();
  const replacements: Record<string, string> = {
    __ALLOWED_ORIGINS_JSON__: jsonForSingleQuotedLiteral(allowedOrigins),
    __MEDIA_KEY_PATTERN_JSON__: jsonForSingleQuotedLiteral(MEDIA_KEY_PATTERN.source),
    __LIB_KEY_PATTERN_JSON__: jsonForSingleQuotedLiteral(LIB_KEY_PATTERN.source),
    __MEDIA_EXTENSIONS_JSON__: jsonForSingleQuotedLiteral(media),
    __LIB_EXTENSIONS_JSON__: jsonForSingleQuotedLiteral(lib),
  };

  let code = readFileSync(TEMPLATE_PATH, "utf8");
  for (const [placeholder, value] of Object.entries(replacements)) {
    if (!code.includes(placeholder)) throw new Error(`Function template is missing ${placeholder}`);
    code = code.split(placeholder).join(value);
  }
  if (/__[A-Z_]+_JSON__/.test(code)) throw new Error("Function template has unreplaced placeholders");
  if (Buffer.byteLength(code, "utf8") > MAX_FUNCTION_BYTES) {
    throw new Error(`Rendered CloudFront Function exceeds ${MAX_FUNCTION_BYTES} bytes`);
  }
  return code;
}
