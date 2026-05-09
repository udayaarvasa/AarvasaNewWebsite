import { randomUUID } from "crypto";

export type BlockchainTransaction = {
  hash: string;
  status: "pending" | "verified";
  propertyId: string;
  amount: number;
  smartContract: string;
  events: string[];
  createdAt: string;
};

const globalForTransactions = globalThis as typeof globalThis & {
  aarvasaTransactions?: BlockchainTransaction[];
};

export const transactionStore =
  globalForTransactions.aarvasaTransactions ??
  (globalForTransactions.aarvasaTransactions = []);

export function createTransaction(input: {
  propertyId?: string;
  amount?: number;
}) {
  const transaction: BlockchainTransaction = {
    hash: `0x${randomUUID().replaceAll("-", "")}${Date.now().toString(16)}`.slice(0, 66),
    status: "pending",
    propertyId: input.propertyId || "goa-cliff-villas",
    amount: input.amount || 2500000,
    smartContract: "AARVASA_ESCROW_V1",
    events: [
      "Biometric consent captured",
      "MPC node quorum initiated",
      "Smart contract escrow simulation executed",
    ],
    createdAt: new Date().toISOString(),
  };
  transactionStore.unshift(transaction);
  return transaction;
}

export function resolveStatus(transaction: BlockchainTransaction) {
  const age = Date.now() - new Date(transaction.createdAt).getTime();
  return age > 4500 ? "verified" : transaction.status;
}
