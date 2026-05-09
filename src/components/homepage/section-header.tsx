import { Badge } from "@/components/ui/badge";

interface SectionHeaderProps {
  badge?: string;
  title: string;
  description?: string;
  align?: "left" | "center";
  light?: boolean;
}

export function SectionHeader({
  badge,
  title,
  description,
  align = "left",
  light = false,
}: SectionHeaderProps) {
  return (
    <div
      className={`max-w-3xl ${align === "center" ? "mx-auto text-center" : ""}`}
    >
      {badge && (
        <Badge
          className={
            light
              ? "border-[#f5d27a]/40 bg-[#f5d27a]/15 text-[#f5d27a]"
              : "mb-4"
          }
        >
          {badge}
        </Badge>
      )}
      <h2
        className={`mt-4 text-4xl font-black tracking-tight sm:text-5xl ${
          light ? "text-white" : "text-foreground"
        }`}
      >
        {title}
      </h2>
      {description && (
        <p
          className={`mt-5 text-lg leading-8 ${
            light ? "text-white/70" : "text-muted-foreground"
          }`}
        >
          {description}
        </p>
      )}
    </div>
  );
}
