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
      if (!schema[key]) continue;

      const result = schema[key].safeParse(req[key]);

      if (!result.success) {
        const errors = result.error.issues[0];
        issues.push({
          key,
          issues: [
            {
              message: errors?.message ?? "",
              path: errors?.path[0] || null,
              code: errors?.code ?? "",
            },
          ],
        });
      }

      if (issues.length) {
        throw new BadRequestError("Validation Error : ", issues);
      }
    }

    return next() as unknown;
  };
};
export const generalFields = {
  username: z
    .string({ error: "Username is required" })
    .min(2, { message: "Minimum characters must be 2" })
    .max(50, { message: "Maximum characters must be 50" }), // انت كاتب 2 بالغلط
  email: z.string().email({ message: "Invalid Email" }),
  password: z
    .string({ error: "Password is required" })
    .regex(
      /^[aA-Zz](?=.*[a-zA-Z])(?=.*\d)(?=.*[\W_]).+$/,
      "Password must start with an uppercase letter and contain letters, numbers, and special characters",
    ),
  confirmPassword: z.string({ error: "Confirm password is required" }),
  role: z
    .enum(Object.values(RoleEnum), {
      error: () => ({ message: "Role is required" }),
    })
    .optional(),
  gender: z.enum(Object.values(GenderEnum), {
    error: () => ({ message: "Gender is required" }),
  }),
  otp: z.string().regex(/^\d{6}$/, { message: "OTP must be 6 digits" }),
  age: z
    .number({ error: "Age must be a number" })
    .max(120, { message: "Age must be at most 120" }),
  flag: z.enum(Object.values(LogoutEnum)).default(LogoutEnum.Only),
};
