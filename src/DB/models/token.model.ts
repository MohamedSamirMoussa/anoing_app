import { model, models, Schema, Types, HydratedDocument } from "mongoose";

export interface ITokenSchema {
  jti: string;
  expiresIn: number;
  userId: Types.ObjectId;
}

const tokenSchema = new Schema<ITokenSchema>(
  {
    jti: {
      type: String,
      required: true,
      unique: true,
    },
    expiresIn: {
      type: Number,
      required: true,
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

export const TokenModel = models.Token || model("Token", tokenSchema);
export type HTokenDoc = HydratedDocument<ITokenSchema>;
