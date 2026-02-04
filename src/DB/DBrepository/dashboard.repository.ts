import { Model } from "mongoose";
import { DBrepository } from "./db.repository";
import { IComponent } from "../models/app.model";

export class DashboardRepository extends DBrepository<IComponent> {
  constructor(protected override readonly model: Model<IComponent>) {
    super(model);
  }
}
