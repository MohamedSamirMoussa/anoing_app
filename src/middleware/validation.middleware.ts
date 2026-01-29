import type { NextFunction, Request, Response } from "express";
import { z, type ZodType } from "zod";
import { BadRequestError } from "../utils";
import { GenderEnum, RoleEnum } from "../DB";

export enum LogoutEnum {
  All = "All",
  Only = "Only",
}

type KeyReqType = keyof Request;
type SchemaType = Partial<Record<KeyReqType, ZodType>>;

type ValidationErrorsType = Array<{
  key: KeyReqType;
  issues: Array<{
    message: string;
    path: string | number | symbol | null;
    code: string;
  }>;
}>;

export const validation = (schema: SchemaType) => {
  return (req: Request, res: Response, next: NextFunction) => {
    let issues: ValidationErrorsType = [];
    
    for (const key of Object.keys(schema) as KeyReqType[]) {
      const currentSchema = schema[key];
      if (!currentSchema) continue;

      // استخدام safeParse على req[key] مع التأكد من النوع
      const result = currentSchema.safeParse(req[key]);

      if (!result.success) {
        const errors = result.error.issues[0];
        issues.push({
          key,
          issues: [
            {
              message: errors?.message ?? "Invalid value",
              path: errors?.path ? errors.path[0] : null, // حل مشكلة undefined في الـ path
              code: errors?.code ?? "validation_error",
            },
          ],
        });
      }
    }

    // نقل شرط الـ throw خارج الـ Loop عشان يفحص كل الـ keys الأول
    if (issues.length > 0) {
      // إذا كان BadRequestError يقبل باراميتر واحد فقط (رسالة)
      // ادمج الأخطاء في سلسلة نصية واحدة أو مررها كـ any
      throw new BadRequestError(`Validation Error: ${issues[0].issues[0].message}`);
    }

    return next();
  };
};

export const generalFields = {
  username: z
    .string({ required_error: "Username is required" }) // تعديل مسمى الـ error لـ required_error
    .min(2, { message: "Minimum characters must be 2" })
    .max(50, { message: "Maximum characters must be 50" }),
  email: z.string().email("Invalid Email address"), // z.email() غير موجودة مباشرة، الصحيح z.string().email()
  password: z
    .string({ required_error: "Password is required" })
    .regex(
      /^[A-Z](?=.*[a-zA-Z])(?=.*\d)(?=.*[\W_]).+$/,
      "Password must start with an uppercase letter and contain letters, numbers, and special characters",
    ),
  confirmPassword: z.string({ required_error: "Confirm password is required" }),
  role: z.nativeEnum(RoleEnum).optional(), // استخدام nativeEnum أفضل للـ enums
  gender: z.nativeEnum(GenderEnum),
  otp: z.string().regex(/^\d{6}$/, "OTP must be 6 digits"),
  age: z
    .number({ required_error: "Age must be a number" })
    .max(120, "Age must be at most 120"),
  flag: z.nativeEnum(LogoutEnum).default(LogoutEnum.Only),
};