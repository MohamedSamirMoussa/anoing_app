import { Model, QueryOptions, Types } from "mongoose";
import { DBrepository } from "./db.repository";
import { IBlogSchema } from "../models/blog.model";

export class BlogRepository extends DBrepository<IBlogSchema> {
  constructor(protected override readonly model: Model<IBlogSchema>) {
    super(model);
  }


  async findByIdAndDelete({
    id,
    options
  }:{
    id:Types.ObjectId
    options?:QueryOptions<IBlogSchema>
  }) {
    return this.model.findByIdAndDelete(id , options)
  }

}
