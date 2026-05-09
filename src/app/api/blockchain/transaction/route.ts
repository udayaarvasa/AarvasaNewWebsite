import { NextResponse } from "next/server";
import { z } from "zod";
import { createTransaction } from "@/lib/blockchain";
import { connectDb } from "@/lib/db";
import { Transaction } from "@/models/Transaction";

const TransactionSchema = z.object({
  propertyId: z.string().optional(),
  amount: z.coerce.number().optional(),
});

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const parsed = TransactionSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid transaction payload" }, { status: 400 });
  }

  const transaction = createTransaction(parsed.data);

  try {
    await connectDb();
    await Transaction.create(transaction);
  } catch {
    // Demo mode keeps an in-memory transaction when MongoDB is unavailable.
  }

  return NextResponse.json({
    transaction,
    smartContract: {
      name: transaction.smartContract,
      execution: "simulated",
      escrowLocked: true,
      mpcQuorum: "4/5 nodes",
    },
  });
}
