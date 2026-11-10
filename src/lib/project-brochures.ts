import manifest from "../../public/brochures/manifest.json";

export type ProjectBrochure = {
  href: string;
  pages: number;
  bytes: number;
  sourceHref: string;
};

export function projectBrochure(slug: string): ProjectBrochure | null {
  return (manifest as Record<string, ProjectBrochure>)[slug] ?? null;
}

export function brochureSize(bytes: number): string {
  return bytes >= 1024 * 1024 ? `${(bytes / (1024 * 1024)).toFixed(1)} MB` : `${Math.ceil(bytes / 1024)} KB`;
}
