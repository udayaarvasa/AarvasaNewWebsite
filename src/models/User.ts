import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

const UserSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true },
    password: { type: String, required: true },
    preferences: {
      budget: { type: Number, default: 50000000 },
      locations: [{ type: String }],
      propertyTypes: [{ type: String }],
      risk: { type: String, default: "Balanced" },
    },
  },
  { timestamps: true },
);

export type UserDocument = InferSchemaType<typeof UserSchema>;

export const User: Model<UserDocument> =
  mongoose.models.User || mongoose.model("User", UserSchema);
