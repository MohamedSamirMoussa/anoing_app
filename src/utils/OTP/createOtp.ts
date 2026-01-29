import { customAlphabet } from "nanoid";
import { HUserDoc } from "../../DB";
import { template } from "../nodemailer/templete";
import { emailEmitter } from "../nodemailer/email";

export enum SubjectEnum {
  registration = "Verify Your Email",
  resetPassword = "Reset Your Password",
}

export enum OTPSubject {
  ConfirmEmail = "Verify your email",
  ForgetPassword = "Verify your email",
}

export const createOtp = (): string => {
  const otp: () => string = customAlphabet("0123456789", 6);
  return otp();
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
  switch (subject) {
    case SubjectEnum.resetPassword:
      html = template(otp, "Reset your password");
      emailEmitter.emit("forgetPassword", { to: user?.email, html });
      break;

    default:
      html = template(otp, "Verify your email");
      emailEmitter.emit("confirmEmail", { to: email, html });
      break;
  }

  return otp;
};
