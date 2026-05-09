import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-28 text-center">
      <div>
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-primary">
          404
        </p>
        <h1 className="mt-4 text-4xl font-semibold text-foreground">
          This investment room does not exist.
        </h1>
        <p className="mt-4 text-muted-foreground">
          The property may have moved or the link is no longer active.
        </p>
        <Button asChild className="mt-8">
          <Link href="/listings">Return to listings</Link>
        </Button>
      </div>
    </main>
  );
}
