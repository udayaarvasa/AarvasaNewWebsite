import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

const PropertySchema = new Schema(
  {
    title: { type: String, required: true },
    price: { type: Number, required: true },
    location: { type: String, required: true },
    ROI: { type: Number, required: true },
    images: [{ type: String }],
    tags: [{ type: String }],
    type: { type: String, required: true },
  },
  { timestamps: true },
);

export type PropertyDocument = InferSchemaType<typeof PropertySchema>;

export const Property: Model<PropertyDocument> =
  mongoose.models.Property || mongoose.model("Property", PropertySchema);
