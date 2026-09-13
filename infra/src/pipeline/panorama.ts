import { PANORAMA_DIMENSIONS } from "../media-budgets";
import type { Findings } from "./findings";
import { readJpeg, readWebp } from "./formats";

export type PanoramaFormat = "EQUIRECT_JPEG" | "EQUIRECT_WEBP";

export interface PanoramaResult {
  readonly format: PanoramaFormat;
  readonly width: number;
  readonly height: number;
}

/**
 * Validates an equirectangular panorama from its header only. The pipeline
 * publishes source bytes unchanged, so metadata that would leak (GPS) fails
 * rather than being silently stripped.
 */
export function validatePanorama(bytes: Uint8Array, kind: "jpeg" | "webp", findings: Findings): PanoramaResult | null {
  let width: number;
  let height: number;
  let format: PanoramaFormat;

  if (kind === "jpeg") {
    const info = readJpeg(bytes);
    if (!info) {
      findings.fail("panorama.header", "JPEG frame header could not be read");
      return null;
    }
    ({ width, height } = info);
    format = "EQUIRECT_JPEG";
    if (info.components !== 3 && info.components !== 1) {
      findings.fail("panorama.color", `JPEG has ${info.components} colour components (CMYK is not supported by browsers/WebGL); use RGB`);
    }
    if (info.progressive) findings.warn("panorama.progressive", "Progressive JPEG; baseline JPEG decodes with less memory on mobile");
    if (info.hasGps) {
      findings.fail("panorama.gps", "EXIF contains GPS location data; strip it before publishing (sources are published unchanged)");
    } else if (info.hasExif) {
      findings.warn("panorama.exif", "EXIF metadata present (no GPS found); consider stripping it");
    }
  } else {
    const info = readWebp(bytes);
    if (!info) {
      findings.fail("panorama.header", "WebP header could not be read");
      return null;
    }
    ({ width, height } = info);
    format = "EQUIRECT_WEBP";
    if (info.animated) findings.fail("panorama.animated", "Animated WebP is not a valid panorama");
    if (info.lossless) findings.warn("panorama.lossless", "Lossless WebP panorama; lossy encoding is usually far smaller");
    if (info.hasGps) {
      findings.fail("panorama.gps", "EXIF contains GPS location data; strip it before publishing (sources are published unchanged)");
    } else if (info.hasExif) {
      findings.warn("panorama.exif", "EXIF metadata present (no GPS found); consider stripping it");
    }
  }
  findings.pass("panorama.header", `${width}×${height}`);

  if (width !== height * 2) {
    findings.fail("panorama.aspect-ratio", `Equirectangular panoramas must be exactly 2:1; got ${width}×${height}`);
  } else {
    findings.pass("panorama.aspect-ratio", "Exactly 2:1 equirectangular");
  }

  if (width > PANORAMA_DIMENSIONS.maxWidth) {
    findings.fail(
      "panorama.resolution",
      `Width ${width} exceeds ${PANORAMA_DIMENSIONS.maxWidth}; larger panoramas need tiled delivery, which is not supported yet`,
    );
  } else if (width > PANORAMA_DIMENSIONS.mobileWidth) {
    findings.warn("panorama.resolution", `Width ${width} exceeds the mobile target of ${PANORAMA_DIMENSIONS.mobileWidth}; desktop only`);
  } else if (width < PANORAMA_DIMENSIONS.minWidth) {
    findings.warn("panorama.resolution", `Width ${width} is below ${PANORAMA_DIMENSIONS.minWidth}; the panorama will look soft`);
  } else {
    findings.pass("panorama.resolution", `Width ${width} is within the mobile target`);
  }

  return { format, width, height };
}
