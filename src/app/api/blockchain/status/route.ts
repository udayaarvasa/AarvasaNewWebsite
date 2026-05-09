import { NextResponse } from "next/server";
import { resolveStatus, transactionStore } from "@/lib/blockchain";
import { connectDb } from "@/lib/db";
import { Transaction } from "@/models/Transaction";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const hash = url.searchParams.get("hash");

  try {
    await connectDb();
    const record = hash
      ? await Transaction.findOne({ hash }).lean()
      : await Transaction.findOne().sort({ createdAt: -1 }).lean();

    if (record) {
      const createdAt = record.createdAt
        ? new Date(record.createdAt).toISOString()
        : new Date().toISOString();
      const status = resolveStatus({
        hash: record.hash,
        status: record.status as "pending" | "verified",
        propertyId: record.propertyId,
        amount: record.amount,
        smartContract: record.smartContract,
        events: record.events || [],
        createdAt,
      });

      if (status === "verified" && record.status !== "verified") {
        await Transaction.updateOne({ hash: record.hash }, { status });
      }

      return NextResponse.json({ transaction: { ...record, status } });
    }
  } catch {
    // Fall through to in-memory demo store.
  }

  const transaction = hash
    ? transactionStore.find((item) => item.hash === hash)
    : transactionStore[0];

  if (!transaction) {
    return NextResponse.json({
      transaction: {
        hash: "0xdemo",
        status: "verified",
        propertyId: "goa-cliff-villas",
        amount: 2500000,
        smartContract: "AARVASA_ESCROW_V1",
        events: ["Demo verification ready"],
        createdAt: new Date().toISOString(),
      },
    });
  }

  const status = resolveStatus(transaction);
  transaction.status = status;
  return NextResponse.json({ transaction: { ...transaction, status } });
}
