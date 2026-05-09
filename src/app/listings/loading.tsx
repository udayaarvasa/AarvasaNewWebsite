import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="mx-auto max-w-7xl px-4 pb-24 pt-32 sm:px-6 lg:px-8">
      <Skeleton className="h-12 w-72" />
      <Skeleton className="mt-6 h-24 w-full max-w-3xl" />
      <div className="mt-10 grid gap-5 md:grid-cols-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <Skeleton key={index} className="h-96" />
        ))}
      </div>
    </div>
  );
}
