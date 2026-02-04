import mongoose, { Schema, Document, Model } from "mongoose";

export interface IComponent extends Document {
  section: string;
  title?: string;
  description?: string;
  updatedAt: Date;
}

const ComponentSchema: Schema<IComponent> = new Schema({
  section: { type: String, required: true, unique: true , default:"home" },
  title: { type: String, default: "hi" },
  description: { type: String, default: "hi2" },
  updatedAt: { type: Date, default: Date.now },
});

export const ComponentModel: Model<IComponent> =
  mongoose.models.Component ||
  mongoose.model<IComponent>("Component", ComponentSchema);
