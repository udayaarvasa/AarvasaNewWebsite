export function PropertyCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-2xl border border-[#DCCDCE]/40 bg-white shadow-sm animate-pulse">
      <div className="aspect-[4/3] bg-[#DCCDCE]/30" />
      <div className="p-4 space-y-3">
        <div className="h-5 w-3/4 rounded bg-[#DCCDCE]/30" />
        <div className="h-3 w-1/2 rounded bg-[#DCCDCE]/20" />
        <div className="flex gap-4 border-t border-[#DCCDCE]/20 pt-3">
          <div className="h-3 w-14 rounded bg-[#DCCDCE]/20" />
          <div className="h-3 w-14 rounded bg-[#DCCDCE]/20" />
          <div className="h-3 w-20 rounded bg-[#DCCDCE]/20" />
        </div>
      </div>
    </div>
  )
}

export function PropertyGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: count }).map((_, i) => (
        <PropertyCardSkeleton key={i} />
      ))}
    </div>
  )
}
