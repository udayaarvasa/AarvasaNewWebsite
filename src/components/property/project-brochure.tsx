import { Download, FileText, ArrowUpRight } from "lucide-react";
import { brochureSize, type ProjectBrochure } from "@/lib/project-brochures";

export function ProjectBrochurePanel({ brochure, name }: { brochure: ProjectBrochure; name: string }) {
  return (
    <div className="rounded-[24px] border border-rule bg-paper-raised p-6 sm:p-8">
      <div className="flex items-start gap-4">
        <FileText className="mt-1 h-7 w-7 shrink-0 text-gold-ink" aria-hidden="true" />
        <div>
          <h3 className="av-display text-[28px] leading-tight text-ink">{name} brochure</h3>
          <p className="mt-2 max-w-xl text-[14px] leading-relaxed text-ink-muted">Project overview, specifications, pricing, amenities, location and enquiry details in one downloadable guide.</p>
          <p className="av-meta mt-3 text-[10px] text-ink-muted">Aarvasa project guide · PDF · {brochure.pages} pages · {brochureSize(brochure.bytes)}</p>
        </div>
      </div>
      <div className="mt-6 flex flex-wrap gap-3">
        <a href={brochure.href} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-full bg-ink px-5 py-3 text-[13px] text-paper transition-opacity hover:opacity-80">View brochure <ArrowUpRight className="h-4 w-4" aria-hidden="true" /></a>
        <a href={brochure.href} download className="inline-flex items-center gap-2 rounded-full border border-rule px-5 py-3 text-[13px] text-ink transition-colors hover:border-gold">Download PDF <Download className="h-4 w-4" aria-hidden="true" /></a>
        <a href={brochure.sourceHref} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 px-2 py-3 text-[13px] text-ink-muted underline underline-offset-4">Developer document <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" /></a>
      </div>
    </div>
  );
}
