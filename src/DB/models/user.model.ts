import { model, models, Schema } from "mongoose";
import { HydratedDocument, Model, Types } from "mongoose";
export enum GenderEnum {
  male = "male",
  female = "female",
}

export enum RoleEnum {
  super = "super",
  admin = "admin",
  user = "user",
}

export enum ProvidersEnum {
  system = "system",
  google = "google",
  discord = "discord",
}

export interface IUserSchema {
  username: string;
  password?: string;
  email?: string;
  resetpasswordOtp?: string;
  confirmEmailOtp?: string;
  gender: GenderEnum;
  role: RoleEnum;
  provider: ProvidersEnum;
  createdAt: Date;
  updatedAt?: Date;
  confirmedAt: Date;
  changedCredentialsAt: Date;
  expireAt: Date;
  expiredOtpAt: Date;
  forgetPasswordOtp: string;
  forgetPasswordOtpExpireAt: Date;
  confirmForgetPasswordAt: Date;
  blogId?: Types.ObjectId;
  googleId?: string;
  discordId?: string;
  avatar?: string;
  displayName?: string;

  isLogged: boolean;
}

const schema = new Schema<IUserSchema>(
  {
    username: {
      type: String,
      required: true,
      minLength: 2,
      maxLength: 50,
    },
    email: {
      type: String,
      required: function (): any {
        return this.provider === ProvidersEnum.system;
      },
      unique: true,
    },
    password: {
      type: String,

      required: function (): any {
        return this.provider === ProvidersEnum.system;
      },
    },
    role: {
      type: String,
      required: true,
      enum: Object.values(RoleEnum),
      default: RoleEnum.user,
    },
    gender: {
      type: String,
      required: function (): any {
        return this.provider === ProvidersEnum.system;
      },
      enum: Object.values(GenderEnum),
      default: GenderEnum.male,
    },
    blogId: {
      type: Types.ObjectId,
      ref: "Blog",
    },
    changedCredentialsAt: Date,
    confirmedAt: Date,
    createdAt: Date,
    updatedAt: Date,
    expireAt: Date,
    confirmEmailOtp: String,
    resetpasswordOtp: String,
    expiredOtpAt: Date,
    forgetPasswordOtp: String,
    forgetPasswordOtpExpireAt: Date,
    confirmForgetPasswordAt: Date,
    provider: {
      type: String,
      required: true,
      enum: Object.values(ProvidersEnum),
      default: ProvidersEnum.system,
    },

    googleId: {
      type: String,
      sparse: true,
      unique: true,
    },
    discordId: {
      type: String,
      sparse: true,
      unique: true,
    },
    avatar: String,
    displayName: String,
    isLogged: { type: Boolean, default: false },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

schema.index({ expireAt: 1 }, { expireAfterSeconds: 0 });
export const UserModel: Model<IUserSchema> =
  (models.User as any) || model<IUserSchema>("User", schema);
export type HUserDoc = HydratedDocument<IUserSchema>;
