import { HUserDoc } from "../../DB";
import { template } from "../nodemailer/templete";
import { emailEmitter } from "../nodemailer/email";
import { BadRequestError } from "../errors/errors";

export enum SubjectEnum {
  registration = "Verify Your Email",
  resetPassword = "Reset Your Password",
}

export enum OTPSubject {
  ConfirmEmail = "Verify your email",
  ForgetPassword = "Verify your email",
}

export const createOtp = (): string => {
  return String(Math.floor(Math.random() * (999999 - 100000 + 1) + 100000))
  
};

export const generateOtp = ({
  user,
  subject = SubjectEnum.registration,
  email,
}: {
  user?: HUserDoc;
  subject: SubjectEnum;
  email?: string;
}) => {
  const otp: string = createOtp();
  let html: string = "";

const targetEmail = email || user?.email;

  if (!targetEmail) {
    
    throw new BadRequestError("No email provided for OTP. Mail emission skipped")
  }

  switch (subject) {
    case SubjectEnum.resetPassword:
      html = template(otp, "Reset your password");
      emailEmitter.emit("forgetPassword", { to:targetEmail, html });
      break;

    default:
      html = template(otp, "Verify your email");
      emailEmitter.emit("confirmEmail", { to: targetEmail, html });
      break;
  }

  return otp;
};
