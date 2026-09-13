import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ViewerLab } from "./viewer-lab";

/**
 * Development-only test benches, served at /labs/<name>. Not linked from anywhere.
 *
 * Production exclusion happens at the routing layer: no params are generated in
 * production and `dynamicParams = false` rejects everything else, so /labs/*
 * returns a real 404 without rendering. A notFound() inside the page is not
 * enough on its own here: the root loading.tsx streams a 200 response before
 * the page runs, which turned it into a soft 404.
 */
const LABS = process.env.NODE_ENV === "production" ? [] : ["viewer"];

export const dynamicParams = false;

export function generateStaticParams() {
  return LABS.map((lab) => ({ lab }));
}

export const metadata: Metadata = {
  title: "Viewer lab | Aarvasa",
  robots: { index: false, follow: false, nocache: true },
};

export default async function LabPage({
  params,
  searchParams,
}: {
  params: Promise<{ lab: string }>;
  searchParams: Promise<{ load?: string }>;
}) {
  // Defence in depth: never render a lab in a production build.
  if (process.env.NODE_ENV === "production") notFound();

  const { lab } = await params;
  if (lab !== "viewer") notFound();

  // ?load=interaction starts in click-to-load mode, to confirm the engine is
  // not downloaded until asked for.
  const { load } = await searchParams;
  return <ViewerLab initialLoadOn={load === "interaction" ? "interaction" : "visible"} />;
}
