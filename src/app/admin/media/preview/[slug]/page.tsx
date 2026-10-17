import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { Wrap } from "@/components/av/primitives";
import { getProject } from "@/lib/projects";
import { loadProjectModel } from "@/lib/services/project-models";
import { ImmersiveExperience } from "@/app/projects/[slug]/immersive-viewer";
import { ExploreArea } from "@/components/property/explore-area";
import { REEF_996_BASE_OFFSET_M, exploreAreaMode } from "@/lib/maps/google-3d";
import { ImmersiveTour } from "@/components/property/immersive-tour";
import { loadImmersiveTour } from "@/lib/services/immersive-tour";

/**
 * Authorised internal preview of a project's withheld media.
 *
 * Media that is PUBLISHED but INTERNAL is deliberately invisible to public
 * property browsing — that is the whole point of the visibility column. It still
 * has to be reviewable before anyone decides to release it, and reviewing a 3D
 * model means looking at it in the viewer the public would use, not at a
 * download link. This renders the real resolver output through the real viewer,
 * with the visibility filter relaxed and nothing else changed.
 *
 * ADMIN only, every request, read from the database rather than the session
 * token: a role that changed a minute ago takes effect now. The page is
 * noindex and is linked only from the admin panel.
 */
export const dynamic = "force-dynamic";

export const metadata = {
  title: "Internal media preview | Aarvasa",
  robots: { index: false, follow: false, nocache: true },
};

export default async function InternalMediaPreview({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login?callbackUrl=%2Fadmin");

  // The token's role is not trusted; the row is.
  const user = await prisma.user
    .findUnique({ where: { id: session.user.id }, select: { role: true } })
    .catch(() => null);
  if (user?.role !== "ADMIN") notFound();

  const { slug } = await params;
  const project = getProject(slug);
  if (!project) notFound();

  const model = await loadProjectModel(project, { includeInternal: true });
  const publicModel = await loadProjectModel(project);
  /* Withheld films too, so a reviewer can watch a tour before deciding to
     release it. Same resolver as the public page with the visibility filter
     relaxed — never the provenance floor. */
  const films = await loadImmersiveTour(project, { includeInternal: true });
  const publicFilms = await loadImmersiveTour(project);

  return (
    <div className="pb-[var(--s-24)] pt-[var(--s-14)]">
      <Wrap>
        <Link href="/admin" className="av-label text-gold hover:underline">
          ← Admin
        </Link>
        <p className="av-label mt-[var(--s-5)] inline-block border border-rule-firm px-2 py-1 text-ink-muted">
          Internal preview
        </p>
        <h1 className="av-display mt-3 text-[clamp(26px,4vw,40px)] leading-tight">
          {project.name}
        </h1>
        <p className="mt-3 max-w-[64ch] text-[14px] leading-relaxed text-ink-muted">
          Media that is published but still withheld from the public. This is the
          same resolver and the same viewer a visitor would get, with the
          visibility filter relaxed for this page only.
        </p>

        <dl className="mt-[var(--s-6)] grid max-w-[60ch] grid-cols-[auto_1fr] gap-x-[var(--s-5)] gap-y-2 text-[14px]">
          <dt className="av-label text-ink-muted">Public resolver</dt>
          <dd>{publicModel ? "returns this model" : "returns nothing — withheld"}</dd>
          <dt className="av-label text-ink-muted">Provenance</dt>
          <dd>{model?.provenance?.label ?? "—"}</dd>
          <dt className="av-label text-ink-muted">Tour films</dt>
          <dd>
            {films
              ? `${films.length} scenes resolve here; ${publicFilms ? `${publicFilms.length} publicly` : "none publicly"}`
              : "none published"}
          </dd>
          <dt className="av-label text-ink-muted">Opening camera</dt>
          <dd>{model ? "set by a reviewer; narrow viewers get their own" : "—"}</dd>
        </dl>

        {model?.provenance?.note && (
          <p className="mt-[var(--s-5)] max-w-[64ch] border-l-2 border-rule-firm pl-4 text-[14px] leading-relaxed text-ink-muted">
            {model.provenance.note}
          </p>
        )}

        {/* Explore Area with the withheld model standing in Google's scene.
            Here and not on the project page, because this is where an INTERNAL
            asset is legitimately resolvable — the overlay inherits that
            authorisation rather than adding one of its own. */}
        {(() => {
          const area = exploreAreaMode({
            coordinates: project.coordinates,
            apiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY,
          });
          if (area.kind === "unavailable") return null;
          const url = model?.source.kind === "model" ? model.source.url : null;
          return (
            <div className="mt-[var(--s-8)]">
              <h2 className="av-label text-ink-muted">Explore area</h2>
              <p className="mt-1 text-[14px] text-ink-muted">
                The surroundings, with the withheld model placed at the project&rsquo;s recorded
                coordinate. That coordinate is locality precision, so the placement is approximate.
              </p>
              <div className="mt-[var(--s-5)]">
                <ExploreArea
                  name={project.name}
                  location={`${project.location}, ${project.city}`}
                  coordinates={area.center}
                  apiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY ?? null}
                  modelOverlay={url ? { url, baseOffsetMetres: REEF_996_BASE_OFFSET_M } : null}
                />
              </div>
            </div>
          );
        })()}

        {films && (
          <div className="mt-[var(--s-8)] bg-stage p-[var(--s-6)]">
            <h2 className="av-label text-stage-ink">Immersive tour</h2>
            <div className="mt-[var(--s-5)]">
              <ImmersiveTour scenes={films} projectName={project.name} />
            </div>
          </div>
        )}

        <div className="mt-[var(--s-8)]">
          {model ? (
            <ImmersiveExperience model={model} tour={null} splat={null} analyticsId={project.slug} />
          ) : (
            <p className="max-w-[56ch] border border-rule-firm bg-paper-raised p-[var(--s-6)] text-[14px] leading-relaxed text-ink-muted">
              No published model for this project, withheld or otherwise.
            </p>
          )}
        </div>
      </Wrap>
    </div>
  );
}
