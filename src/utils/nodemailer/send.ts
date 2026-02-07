import { createTransport, Transporter } from "nodemailer";
import Mail from "nodemailer/lib/mailer";
import SMTPTransport from "nodemailer/lib/smtp-transport";
import { BadRequestError } from "../errors/errors";

export const sendEmail = async (data: Mail.Options): Promise<void> => {
  if (!data.html && data.attachments?.length && !data.text) {
    throw new BadRequestError("Send email is corrupted");
  }
  const transporter: Transporter<
    SMTPTransport.SentMessageInfo,
    SMTPTransport.Options
  > = createTransport({
    service: "gmail",
    auth: {
      user: process.env.APP_EMAIL as string,
      pass: process.env.APP_PASS as string,
    },
  });

  await transporter.sendMail({
    from: `"Anoing" <${process.env.APP_EMAIL}>`,
    ...data,
  });
};
