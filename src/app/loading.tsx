import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="mx-auto max-w-7xl px-4 pt-32 sm:px-6 lg:px-8">
      <Skeleton className="h-14 w-80" />
      <Skeleton className="mt-6 h-40 w-full" />
    </div>
  );
}
