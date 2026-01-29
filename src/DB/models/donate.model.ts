import { Schema, model } from "mongoose";
export enum DonateEnum {
  stripe = "stripe",
  paypal = "paypal",
}
export enum StatusEnum {
  PENDING = "PENDING",
  COMPLETED = "COMPLETED",
}

export interface IDonateSchema {
  payerUsername: { given_name: string; surname: string };
  donateId: string;
  payerId: string;
  currency: string;
  provider: DonateEnum;
  status: StatusEnum;
  email?: string;
}

const donationSchema = new Schema<IDonateSchema>(
  {
    payerUsername: {
      given_name: String,
      surname: String,
    },
    donateId: { type: String, required: true },
    payerId: { type: String, required: true },
    provider: {
      type: String,
      enum: DonateEnum,
      default: DonateEnum.paypal,
      required: true,
    },
    status: {
      type: String,
      enum: StatusEnum,
      default: StatusEnum.PENDING,
      required: true,
    },
    email: String,
  },
  { timestamps: true },
);

export const DonateModel = model("Donation", donationSchema);
