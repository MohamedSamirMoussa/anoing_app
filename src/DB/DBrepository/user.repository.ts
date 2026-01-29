import { Model } from "mongoose";
import { IUserSchema } from "../models/user.model";
import { DBrepository } from "./db.repository";

export class UserRepository extends DBrepository<IUserSchema> {
  constructor(protected override readonly model: Model<IUserSchema>) {
    super(model);
  }
}
