import {
  ADDRESS_CLAMP_TO_EDGE,
  ADDRESS_REPEAT,
  CULLFACE_NONE,
  Entity,
  FILTER_LINEAR,
  Mesh,
  MeshInstance,
  PIXELFORMAT_SRGBA8,
  StandardMaterial,
  Texture,
  Vec3,
  type AppBase,
  type GraphicsDevice,
} from "playcanvas";
import type { PanoramaView } from "../types";
import { equirectUv, isEquirectangular, maxPanoramaWidth } from "../panorama-math";
import { directionFor, LookControls } from "./look-controls";
import type { SceneContent } from "./scene-content";

/** Radius of the panorama sphere; the camera sits at its centre, well inside the far clip plane. */
const SPHERE_RADIUS = 50;
const LONGITUDE_BANDS = 64;
const LATITUDE_BANDS = 32;
export const PANORAMA_CONTENT_TYPES = ["image/jpeg", "image/webp"] as const;

/** A UV sphere whose texture coordinates follow `equirectUv`, seen from inside. */
function buildSphere(device: GraphicsDevice): Mesh {
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  const direction = new Vec3();
  for (let lat = 0; lat <= LATITUDE_BANDS; lat++) {
    const pitch = 90 - (180 * lat) / LATITUDE_BANDS;
    for (let lon = 0; lon <= LONGITUDE_BANDS; lon++) {
      const yaw = -180 + (360 * lon) / LONGITUDE_BANDS;
      directionFor(yaw, pitch, direction);
      positions.push(direction.x * SPHERE_RADIUS, direction.y * SPHERE_RADIUS, direction.z * SPHERE_RADIUS);
      // The texture is uploaded without a vertical flip, so v = 0 samples the image's top row.
      uvs.push(...equirectUv(yaw, pitch));
    }
  }
  const row = LONGITUDE_BANDS + 1;
  for (let lat = 0; lat < LATITUDE_BANDS; lat++) {
    for (let lon = 0; lon < LONGITUDE_BANDS; lon++) {
      const a = lat * row + lon;
      const b = a + row;
      indices.push(a, b, a + 1, a + 1, b, b + 1);
    }
  }
  const mesh = new Mesh(device);
  mesh.setPositions(positions);
  mesh.setUvs(0, uvs);
  mesh.setIndices(indices);
  mesh.update();
  return mesh;
}

async function decode(blob: Blob, maxWidth: number): Promise<ImageBitmap> {
  const full = await createImageBitmap(blob);
  if (!isEquirectangular(full.width, full.height)) {
    full.close();
    throw new Error("Not an equirectangular (2:1) panorama");
  }
  if (full.width <= maxWidth) return full;
  // Downscale on the decode path rather than asking the GPU for a texture it cannot hold.
  try {
    return await createImageBitmap(full, { resizeWidth: maxWidth, resizeHeight: maxWidth / 2, resizeQuality: "high" });
  } finally {
    full.close();
  }
}

const abortError = () => new DOMException("Panorama load was superseded", "AbortError");

/**
 * Loads one equirectangular panorama and returns it as scene content: an
 * inside-out sphere with an unlit, sRGB texture, viewed from its centre.
 *
 * `url` must already have passed `resolvePanoramaUrl`; this function does no URL
 * policy of its own. `signal` cancels an obsolete load (a newer room was
 * selected): nothing is kept, and the promise rejects with an AbortError.
 */
export async function loadPanorama(app: AppBase, url: string, initialView: PanoramaView, signal: AbortSignal): Promise<SceneContent> {
  const response = await fetch(url, { signal, credentials: "omit" });
  if (!response.ok) throw new Error(`Panorama failed to load (HTTP ${response.status})`);
  const type = (response.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
  if (!(PANORAMA_CONTENT_TYPES as readonly string[]).includes(type)) throw new Error("Panorama is not a JPEG or WebP image");
  const blob = await response.blob();
  if (signal.aborted) throw abortError();

  const device = app.graphicsDevice;
  const coarse = typeof matchMedia === "function" && matchMedia("(pointer: coarse)").matches;
  const bitmap = await decode(blob, maxPanoramaWidth(device.maxTextureSize, coarse));
  if (signal.aborted) {
    bitmap.close();
    throw abortError();
  }

  const texture = new Texture(device, {
    name: "panorama",
    width: bitmap.width,
    height: bitmap.height,
    format: PIXELFORMAT_SRGBA8,
    mipmaps: false,
    minFilter: FILTER_LINEAR,
    magFilter: FILTER_LINEAR,
    addressU: ADDRESS_REPEAT,
    addressV: ADDRESS_CLAMP_TO_EDGE,
  });
  // ImageBitmap is a supported source at runtime; the typings list only DOM elements.
  texture.setSource(bitmap as unknown as HTMLImageElement);

  const material = new StandardMaterial();
  material.useLighting = false;
  material.useSkybox = false;
  material.useFog = false;
  material.useTonemap = false;
  material.diffuse.set(0, 0, 0);
  material.emissive.set(1, 1, 1);
  material.emissiveMap = texture;
  material.cull = CULLFACE_NONE;
  material.depthWrite = false;
  material.update();

  const mesh = buildSphere(device);
  const root = new Entity("panorama");
  root.addComponent("render", { meshInstances: [new MeshInstance(mesh, material)] });

  return {
    kind: "panorama",
    root,
    bounds: () => ({ center: new Vec3(0, 0, 0), radius: SPHERE_RADIUS }),
    applyTheme() {},
    createControls: (camera, element, onChange) => new LookControls(camera, element, onChange, initialView),
    destroy() {
      root.destroy();
      mesh.destroy();
      material.destroy();
      texture.destroy();
      bitmap.close();
    },
  };
}
