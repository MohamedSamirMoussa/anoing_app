import { Model } from "mongoose";
import { DBrepository } from "./db.repository";
import { IDonateSchema } from "../models/donate.model";

export class DonateRepository extends DBrepository<IDonateSchema> {
  constructor(protected override readonly model: Model<IDonateSchema>) {
    super(model);
  }
}
