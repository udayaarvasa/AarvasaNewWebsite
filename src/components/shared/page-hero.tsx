import { type LucideIcon } from "lucide-react";

interface PageHeroProps {
  badge?: string;
  title: string;
  titleAccent?: string;
  description?: string;
  icon?: LucideIcon;
  children?: React.ReactNode;
  centered?: boolean;
}

export function PageHero({
  badge,
  title,
  titleAccent,
  description,
  icon: Icon,
  children,
  centered = false,
}: PageHeroProps) {
  return (
    <section
      className={`mx-auto max-w-7xl px-4 pb-10 pt-32 sm:px-6 lg:px-8 ${
        centered ? "text-center" : ""
      }`}
    >
      {badge && (
        <div
          className={`mb-4 inline-flex items-center gap-2 rounded-full border border-[#DCCDCE]/60 bg-[#F5F4F1] px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-[#72383D] ${
            centered ? "mx-auto" : ""
          }`}
        >
          {Icon && <Icon className="h-3.5 w-3.5" />}
          {badge}
        </div>
      )}
      <h1
        className={`text-4xl font-bold tracking-tight text-[#50080E] sm:text-5xl lg:text-6xl ${
          centered ? "mx-auto max-w-4xl" : "max-w-3xl"
        }`}
      >
        {title}
        {titleAccent && (
          <>
            {" "}
            <span className="gold-text">{titleAccent}</span>
          </>
        )}
      </h1>
      {description && (
        <p
          className={`mt-5 text-lg leading-relaxed text-[#72383D]/80 ${
            centered ? "mx-auto max-w-2xl" : "max-w-2xl"
          }`}
        >
          {description}
        </p>
      )}
      {children && <div className="mt-8">{children}</div>}
    </section>
  );
}
