import { HydratedDocument, model, models, Schema, Types } from "mongoose";

export interface IBlogSchema {
  title: string;
  description: string;
  image?: { secure_url: string; public_id: string };
  userId?: Types.ObjectId;
}

const schema = new Schema<IBlogSchema>(
  {
    title: { type: String, required: true },
    description: { type: String, required: true },
    image: {
      secure_url: String,
      public_id: String,
    },
    userId: {
      type: Types.ObjectId,
      required: true,
      ref: "User",
    },
  },
  {
    timestamps: true,
  },
);

export const BlogModel = models.Blog || model("Blog", schema);
export type HBlogDoc = HydratedDocument<IBlogSchema>;
