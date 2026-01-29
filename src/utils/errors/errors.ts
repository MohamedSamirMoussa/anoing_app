import { NextFunction, Request, Response } from "express";

export interface IError extends Error {
  statusCode: number;
}

export class AppExceptions extends Error {
  constructor(message: string, public statusCode: number, cause?: unknown) {
    super(message, { cause });
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class NotFoundError extends AppExceptions {
  constructor(message: string) {
    super(message, 404);
  }
}

export class BadRequestError extends AppExceptions {
  constructor(message: string, cause?: unknown) {
    super(message, 400, { cause });
  }
}

export class ConflictError extends AppExceptions {
  constructor(message: string, cause?: unknown) {
    super(message, 409, { cause });
  }
}

export class NotAuthorizedError extends AppExceptions {
  constructor(message: string, cause?: unknown) {
    super(message, 401, { cause });
  }
}
export class IsAlreadyExist extends AppExceptions {
  constructor(message: string, cause?: unknown) {
    super(message, 409, cause);
  }
}

export const globalErrorHandling = (
  err: IError,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  return res.status(err.statusCode || 500).json({
    errMessage: err.message || "Something went wrong",
    stack: process.env.MOOD === "development" ? err.stack : undefined,
    cause: err.cause,
  });
};
