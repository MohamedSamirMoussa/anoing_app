import { Model } from "mongoose";
import { DBrepository } from "./db.repository";
import { ITokenSchema } from './../models/token.model';

export class TokenRepository extends DBrepository<ITokenSchema> {
  constructor(protected override readonly model: Model<ITokenSchema>) {
    super(model);
  }
}
