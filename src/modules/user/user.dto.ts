import z from "zod";
import * as validators from "./user.validation";


export type RegisterType = z.infer<typeof validators.register.body > 
export type ConfirmEmailType = z.infer<typeof validators.confirmEmail.body > 
export type LoginType = z.infer<typeof validators.login.body > 
export type ResendOtpType = z.infer<typeof validators.resendOtp.body > 
export type LogoutType = z.infer<typeof validators.logout.body > 
export type LoginWithGoogleType = z.infer<typeof validators.loginWithGoogle.body > 
export type ForgetPasswordType = z.infer<typeof validators.forgetPassword.body > 
export type ResetPasswordType = z.infer<typeof validators.resetPassword.body > 