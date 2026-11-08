import { reefReference, reefSourceUrl } from "@/lib/reef-reference-data";

export function ReefReferenceSummary({ slug }: { slug: string }) {
  const reference = reefReference(slug);
  if (!reference) return null;
  return (
    <section className="mx-auto my-12 max-w-[1280px] border-y border-rule px-6 py-10" aria-label="Developer project specification">
      <p className="av-meta text-burgundy">Developer reference · Checked 8 November 2026</p>
      <h2 className="av-display mt-3 text-4xl">The project, in detail.</h2>
      <p className="mt-4 max-w-3xl text-ink-muted">{reference.summary}</p>
      <div className="mt-7 grid gap-8 md:grid-cols-2">
        <div>
          <p className="text-sm">{reference.residences} residences · {reference.location} · Target completion {reference.completion}</p>
          <dl className="mt-4 divide-y divide-rule">
            {reference.configurations.map((c) => <div key={c.label} className="flex justify-between gap-4 py-3 text-sm"><dt>{c.label}</dt><dd className="tabular-nums">{c.sqft} sq.ft</dd></div>)}
          </dl>
        </div>
        <div>
          <h3 className="av-meta">Amenities listed by the developer</h3>
          <ul className="mt-4 grid grid-cols-2 gap-3 text-sm text-ink-muted">{reference.amenities.map((a) => <li key={a}>{a}</li>)}</ul>
        </div>
      </div>
      <p className="mt-6 max-w-3xl text-xs leading-relaxed text-ink-muted">These are project-wide ranges from the developer&apos;s current website. Released-unit sizes, prices and availability in the inventory section are a separate, dated sales snapshot. Confirm current inventory with the desk.</p>
      <a href={reefSourceUrl(reference.number)} target="_blank" rel="noreferrer" className="mt-4 inline-block text-sm text-burgundy underline underline-offset-4">Read the developer&apos;s project page ↗</a>
    </section>
  );
}
