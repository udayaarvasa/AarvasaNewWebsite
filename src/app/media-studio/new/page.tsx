import Link from "next/link";
import { redirect } from "next/navigation";
import { Lock } from "lucide-react";
import { auth } from "@/auth";
import { Wrap, SectionHead } from "@/components/av/primitives";
import { DraftingGrid, Grain, MeasureRule, SectionIndex } from "@/components/av/graphics";
import { TextReveal, Reveal } from "@/components/av/motion";
import { activeCapabilities } from "@/lib/entitlements/service";
import { publishedProjects } from "@/lib/projects";
import { getIngestUploadSigner } from "@/lib/media/ingest-storage";
import { UploadModel } from "./upload-model";

/**
 * New immersive experience — Mode A, uploading a model you already have.
 *
 * The entitlement is read server-side to decide whether to render the uploader
 * at all, but that is presentation: /api/media/upload-intent checks again, so
 * rendering the form to someone without a plan would still get them nowhere.
 *
 * Whether object storage is configured is also checked here, because a form
 * that cannot possibly succeed should say so before someone picks a 200 MB file
 * rather than after.
 */
export const metadata = {
  title: "New immersive experience | Aarvasa",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function NewExperiencePage() {
  const session = await auth();
  if (!session?.user) redirect("/login?callbackUrl=%2Fmedia-studio%2Fnew");

  const held = await activeCapabilities(session.user.id);
  const canUpload = held.includes("PROCESS_MEDIA");

  // Null when the ingest bucket/region are not configured for this environment.
  const storageReady = getIngestUploadSigner() !== null;

  const projects = publishedProjects().map((p) => ({
    slug: p.slug,
    name: p.name,
    location: `${p.location}, ${p.city}`,
  }));

  return (
    <div className="pb-[var(--s-24)]">
      <section
        data-surface="stage"
        className="relative isolate overflow-hidden bg-stage pb-[var(--band-tight)] pt-[var(--s-14)]"
      >
        <DraftingGrid tone="stage" size={56} fade="top" className="opacity-25" />
        <Grain opacity={0.06} />
        <Wrap className="relative z-[3]">
          <Link href="/media-studio" className="av-label text-gold hover:underline">
            ← Media Studio
          </Link>
          <TextReveal
            as="h1"
            text="New immersive experience"
            className="av-display mt-3 max-w-[18ch] text-[clamp(30px,4.6vw,52px)] leading-[1.03] text-stage-ink"
          />
          <p className="mt-[var(--s-4)] max-w-[56ch] text-[16px] leading-relaxed text-stage-muted">
            Upload a model you already have. It is validated by its actual contents, kept
            private to your account, and only becomes visible on a project page once you
            publish it.
          </p>
        </Wrap>
      </section>

      <Wrap className="pt-[var(--band-tight)]">
        <SectionIndex n={1} total={1} className="mb-[var(--s-3)]" />
        <SectionHead
          label="Upload a 3D model"
          title="GLB or glTF"
          note="Checked by magic bytes, not by file extension, in the browser and again on the server."
        />

        {!canUpload ? (
          <Reveal>
            <div className="max-w-[60ch] border border-rule-firm bg-paper-raised p-[var(--s-6)]">
              <p className="flex items-center gap-2">
                <Lock className="h-4 w-4 text-ink-disabled" aria-hidden="true" />
                <span className="av-label text-ink-muted">Locked</span>
              </p>
              <h3 className="av-display mt-3 text-[22px] leading-tight">
                Immersive creation requires an active Aarvasa plan.
              </h3>
              <p className="mt-3 text-[14px] leading-relaxed text-ink-muted">
                Plans and payment are not open yet — there is nothing to buy today. Browsing
                and comparing property on Aarvasa stays free.
              </p>
              <Link
                href="/listings"
                className="av-label mt-[var(--s-5)] inline-block rounded-xs border border-rule-firm bg-paper px-3 py-[8px] text-ink transition-colors hover:border-burgundy hover:text-burgundy"
              >
                Browse listings
              </Link>
            </div>
          </Reveal>
        ) : !storageReady ? (
          <Reveal>
            <div className="max-w-[60ch] border border-rule-firm bg-paper-raised p-[var(--s-6)]">
              <h3 className="av-display text-[22px] leading-tight">
                Processing infrastructure is not configured in this environment.
              </h3>
              <p className="mt-3 text-[14px] leading-relaxed text-ink-muted">
                Object storage for private uploads is not set up here, so a file could be
                chosen but never stored or processed. The form is withheld rather than shown
                as though it would work.
              </p>
              <p className="av-meta mt-[var(--s-5)] text-ink-disabled">
                Needs the media ingest bucket and processing queue to be configured
              </p>
            </div>
          </Reveal>
        ) : projects.length === 0 ? (
          <Reveal>
            <p className="max-w-[56ch] text-[14px] leading-relaxed text-ink-muted">
              There are no published projects to attach a model to yet.
            </p>
          </Reveal>
        ) : (
          <Reveal>
            <UploadModel projects={projects} />
          </Reveal>
        )}

        <div className="mt-[var(--s-8)] max-w-[420px]">
          <MeasureRule />
        </div>
      </Wrap>
    </div>
  );
}
