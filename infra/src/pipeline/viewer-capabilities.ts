/**
 * What the Phase 1 viewer's engine (playcanvas 2.22.2) can load. Verified against
 * node_modules/playcanvas/build/playcanvas/src/framework/parsers/glb in the repo;
 * test/pipeline/viewer-capabilities.test.ts re-checks the installed engine source.
 */

export const PLAYCANVAS_VERSION = "2.22.2";

/** glTF extensions implemented by the PlayCanvas 2.22.2 GLB parser. */
export const SUPPORTED_GLTF_EXTENSIONS: readonly string[] = [
  "EXT_mesh_gpu_instancing",
  "EXT_texture_webp",
  "KHR_draco_mesh_compression",
  "KHR_gaussian_splatting",
  "KHR_lights_punctual",
  "KHR_materials_anisotropy",
  "KHR_materials_clearcoat",
  "KHR_materials_dispersion",
  "KHR_materials_emissive_strength",
  "KHR_materials_ior",
  "KHR_materials_iridescence",
  "KHR_materials_pbrSpecularGlossiness",
  "KHR_materials_sheen",
  "KHR_materials_specular",
  "KHR_materials_transmission",
  "KHR_materials_unlit",
  "KHR_materials_variants",
  "KHR_materials_volume",
  "KHR_texture_basisu",
  "KHR_texture_transform",
];

/** Meshopt is not implemented by the engine's GLB parser, so these fail outright. */
export const REJECTED_GLTF_EXTENSIONS: readonly string[] = ["EXT_meshopt_compression", "KHR_meshopt_compression"];

/** Embedded image MIME types accepted in a GLB, and the extension each one needs. */
export const GLB_IMAGE_MIME_TYPES: Readonly<Record<string, string | null>> = {
  "image/png": null,
  "image/jpeg": null,
  "image/webp": "EXT_texture_webp",
  "image/ktx2": "KHR_texture_basisu",
};
