import { Model } from "mongoose";
import { DBrepository } from "./db.repository";
import { IBlogSchema } from "../models/blog.model";

export class BlogRepository extends DBrepository<IBlogSchema> {
  constructor(protected override readonly model: Model<IBlogSchema>) {
    super(model);
  }
}
