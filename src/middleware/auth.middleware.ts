import type { NextFunction, Request, Response } from "express";
import {
  BadRequestError,
  decodeToken,
  NotAuthorizedError,
  SignatureEnumLevels,
  TokenEnum,
} from "../utils";
import { RoleEnum } from "../DB";

export const authentication = (tokenType: TokenEnum = TokenEnum.access) => {
  return async (req: Request, res: Response, next: NextFunction) => {

let authHeader = req.headers.authorization;

    // لو مفيش Header، هندور في الكوكيز
    if (!authHeader && req.cookies.access_token) {
      // 💡 الحل هنا: بنجيب ليفل التوقيع من كوكي تانية انت بتسيفها وقت اللوجين
      // أو بنخليها Bearer كديفولت لو مش مبعوتة
      const sigLevel = req.cookies.signature_level || SignatureEnumLevels.Bearer;
      authHeader = `${sigLevel} ${req.cookies.access_token}`;
    }

    if (!authHeader) throw new BadRequestError("Authorization validation error");


    const { user, decode } = await decodeToken({
      authorization: authHeader,
      tokenType,
    });

    req.user = user;
    req.decode = decode;

    next();
  };
};

export const authorization = (roles: RoleEnum[] = []) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (!req.headers.authorization) throw new BadRequestError("Authorization validation error");

    const { user, decode } = await decodeToken({
      authorization: req.headers.authorization,
    });

    if (!roles.includes(user.role)) {
      throw new NotAuthorizedError("Not authorized account");
    }

    req.user = user;
    req.decode = decode;
    next();
  };
};