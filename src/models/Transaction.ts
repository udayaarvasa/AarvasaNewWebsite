import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

const TransactionSchema = new Schema(
  {
    hash: { type: String, required: true, unique: true },
    status: { type: String, enum: ["pending", "verified"], default: "pending" },
    propertyId: { type: String, required: true },
    amount: { type: Number, required: true },
    smartContract: { type: String, required: true },
    events: [{ type: String }],
  },
  { timestamps: true },
);

export type TransactionDocument = InferSchemaType<typeof TransactionSchema>;

export const Transaction: Model<TransactionDocument> =
  mongoose.models.Transaction ||
  mongoose.model("Transaction", TransactionSchema);
