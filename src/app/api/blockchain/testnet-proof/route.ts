import { readTestnetProof, type TestnetProof } from "@/lib/testnet-proof";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
let cached: {at:number;proof:TestnetProof} | null = null;
let pending: Promise<TestnetProof> | null = null;
export async function GET() {
  try {
    if (!cached || Date.now()-cached.at > 30_000) {
      pending ??= readTestnetProof();
      try { cached = {at:Date.now(),proof:await pending}; } finally {pending=null;}
    }
    return Response.json(cached.proof,{headers:{"Cache-Control":"public, max-age=0, s-maxage=30"}});
  } catch {
    return Response.json({error:"Testnet evidence is unavailable right now. Try again or inspect the explorer receipts directly."},{status:503,headers:{"Cache-Control":"no-store"}});
  }
}
