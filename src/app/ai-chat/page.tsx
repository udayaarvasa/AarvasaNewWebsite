import { Suspense } from "react";
import { ChatInterface } from "@/components/chatbot/chat-interface";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

export default async function AiChatPage({
  searchParams,
}: {
  searchParams: Promise<{ prompt?: string }>;
}) {
  const { prompt } = await searchParams;

  return (
    <main className="mx-auto min-h-screen max-w-7xl px-4 pb-24 pt-32 sm:px-6 lg:px-8">
      <div className="mb-8 max-w-3xl">
        <Badge>AI Property Advisor</Badge>
        <h1 className="mt-4 text-5xl font-semibold tracking-tight text-foreground sm:text-6xl">
          Ask the AI to rank deals by city, budget, ROI, and risk.
        </h1>
      </div>
      <Suspense fallback={<Skeleton className="h-[720px] w-full rounded-2xl" />}>
        <ChatInterface initialPrompt={prompt} />
      </Suspense>
    </main>
  );
}
