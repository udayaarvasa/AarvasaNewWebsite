import type { Findings } from "./findings";
import { readKtx2, type Ktx2Info } from "./formats";

/**
 * Standalone KTX2 texture (e.g. future environment or shared material maps).
 * Recognised and structurally validated; Phase 2A defined no byte budget for it,
 * so that gap is surfaced as a warning rather than an invented limit.
 */
export function validateKtx2Texture(bytes: Uint8Array, findings: Findings): Ktx2Info | null {
  const info = readKtx2(bytes);
  if (!info) {
    findings.fail("ktx2.header", "KTX2 header or data format descriptor could not be read");
    return null;
  }
  findings.pass(
    "ktx2.header",
    `${info.width}×${info.height}, ${info.levels} level(s), ${info.faces === 6 ? "cubemap, " : ""}supercompression ${info.supercompression}`,
  );
  if (info.encoding === "gpu-format") {
    findings.warn("ktx2.basis", `vkFormat ${info.vkFormat} is a GPU-specific format, not Basis Universal; it may not load on every device`);
  } else {
    findings.pass("ktx2.basis", `Basis Universal (${info.encoding === "basis-etc1s" ? "ETC1S" : "UASTC"}); the viewer transcodes it via lib/basis/{version}/`);
  }
  findings.warn("size.no-approved-budget", "Phase 2A defined no size budget for standalone KTX2 textures; review the size manually");
  return info;
}
