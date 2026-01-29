import Mail from "nodemailer/lib/mailer";
import { EventEmitter } from "stream";
import { sendEmail } from "./send";

export const emailEmitter = new EventEmitter();

emailEmitter.on("confirmEmail", async (data: Mail.Options) => {
  data.subject = "Confirm Email";
  await sendEmail(data);
});
emailEmitter.on("forgetPassword", async (data: Mail.Options) => {
  data.subject = "Forget Password";
  await sendEmail(data);
});
