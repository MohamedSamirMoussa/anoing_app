import type { Response } from "express";

export const successHandler = ({
  res,
  status = 200,
  message = "Done",
  result,
}: {
  res: Response;
  status?: number;
  message?: string;
  result?: object | undefined;
}): Response => {
  return res.status(status).json({
    message,
    result,
    status,
  });
};
