import { SortOrder } from "mongoose";
import {
  CreateOptions,
  DeleteResult,
  FlattenMaps,
  HydratedDocument,
  Model,
  MongooseBaseQueryOptions,
  MongooseUpdateQueryOptions,
  ProjectionType,
  QueryOptions,
  Types,
  UpdateQuery,
  UpdateWriteOpResult,
} from "mongoose";

export type LeanType<T> = HydratedDocument<FlattenMaps<T>>;

export abstract class DBrepository<TDocument> {
  constructor(protected readonly model: Model<TDocument>) {}

  async create({
    data,
    options,
  }: {
    data: Partial<TDocument>[];
    options?: CreateOptions;
  }): Promise<HydratedDocument<TDocument>[] | undefined> {
    return await this.model.create(data as any[], options);
  }

  async findOne({
    filter,
    options,
    select,
  }: {
    filter: any;
    options?: QueryOptions<TDocument>;
    select?: ProjectionType<TDocument>;
  }): Promise<LeanType<TDocument> | HydratedDocument<TDocument> | null> {
    const doc = this.model
      .findOne(filter, undefined, options)
      .select(select || "");
    if (options?.lean) {
      doc.lean(options.lean);
    }

    return await doc.exec();
  }

  async findById({
    id,
    options,
  }: {
    id: Types.ObjectId | string;
    options?: QueryOptions<TDocument>;
  }): Promise<HydratedDocument<TDocument> | null> {
    return await this.model.findById(id, undefined, options);
  }

  async updateOne({
    filter,
    update,
    options,
  }: {
    filter: any;
    update: UpdateQuery<TDocument>;
    options?: MongooseUpdateQueryOptions<TDocument>;
  }): Promise<UpdateWriteOpResult> {
    return await this.model.updateOne(filter, update, options);
  }

  async deleteOne({
    filter,
    options,
  }: {
    filter: any;
    options?: MongooseBaseQueryOptions<TDocument>;
  }): Promise<DeleteResult> {
    return await this.model.deleteOne(filter, options);
  }

  async findOneAndUpdate({
    filter,
    update,
    options,
  }: {
    filter: any;
    update: UpdateQuery<TDocument>;
    options?: QueryOptions;
  }) {
    return await this.model.findOneAndUpdate(filter, update, options);
  }

  async bulkWrite({ data, options }: { data: any[]; options?: any }) {
    if (!data || data.length === 0) return;
    return await this.model.bulkWrite(data, options);
  }

  async find({
    filter = {},
    options,
    sort = "",
    select = "",
  }: {
    filter: any;
    options?: QueryOptions<TDocument>;
    sort?: string | { [key: string]: SortOrder };
    select?: string;
  }) {
    return await this.model
      .find(filter, undefined, options)
      .sort(sort)
      .select(select);
  }
}
