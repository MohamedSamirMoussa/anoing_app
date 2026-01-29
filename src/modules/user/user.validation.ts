import z from "zod";
import { generalFields } from "../../middleware";



export const register = {
  body: z
    .strictObject({
      username: generalFields.username,
      email: generalFields.email,
      password: generalFields.password,
      confirmPassword: generalFields.confirmPassword,
      gender: generalFields.gender,
    })
    .refine(
      (value: any) => {
        return value.confirmPassword === value.password;
      },
      {
        path: ["confirm-password"],
        error: "Confirm password doesn't matches with password",
      },
    ),
};

export const confirmEmail = {
  body: z.strictObject({
    email: generalFields.email,
    otp: generalFields.otp,
  }),
};

export const login = {
  body: z.strictObject({
    email: generalFields.email,
    password: generalFields.password,
  }),
};

export const resendOtp = {
  body: z.strictObject({
    email: generalFields.email,
  }),
};

export const logout = {
  body: z.strictObject({
    flag: generalFields.flag,
  }),
};
