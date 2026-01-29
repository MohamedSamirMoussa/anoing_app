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
    .min(2, {
      error: () => {
        return `Minimum characters must be 2`;
      },
    })
    .max(50, { error: "Maximum characters must be 2" }),
  email: z.email("Use invalid Email"),
  password: z
    .string("Password is required")
    .regex(
      /^[A-Z](?=.*[a-zA-Z])(?=.*\d)(?=.*[\W_]).+$/,
      "Password must start with an uppercase letter and contain letters, numbers, and special characters",
    ),
  confirmPassword: z.string("Confirm password is required"),
  role: z.enum(Object.values(RoleEnum), "Role is required").optional(),
  gender: z.enum(Object.values(GenderEnum), "Gender is required"),
  otp: z.string().regex(/^\d{6}$/, { error: "OTP must be 6 digits" }),
  age: z
    .number("Age must be a number")
    .max(120, { message: "Age must be at most 120" }),
  flag: z.enum(LogoutEnum).default(LogoutEnum.Only),
};
