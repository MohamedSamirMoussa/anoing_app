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
    .refine((value: any) => value.confirmPassword === value.password, {
      path: ["confirm-password"],
      message: "Confirm password doesn't match with password",
    }),
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

export const loginWithGoogle = {
  body: z.object({
    token: z.string("Token is required"),
  }),
};

export const forgetPassword = {
  body: z.strictObject({
    email: generalFields.email,
  }),
};

export const resetPassword = {
  body: z
    .strictObject({
      email: generalFields.email,
      newPassword: generalFields.password,
    })
    .refine((value: any) => value.confirmPassword === value.newPassword, {
      path: ["confirm-password"],
      message: "Confirm password doesn't match with password",
    }),
};
