import { sign, verify } from "jsonwebtoken";
import type { JwtPayload, Secret, SignOptions } from "jsonwebtoken";
import {
  HUserDoc,
  RoleEnum,
  TokenModel,
  TokenRepository,
  UserModel,
  UserRepository,
} from "../../DB";
import { BadRequestError, NotAuthorizedError } from "../errors/errors";
import { v4 as uuid } from "uuid";
export enum SignatureEnumLevels {
  Bearer = "Bearer",
  System = "System",
  Super = "Super",
}

export enum TokenEnum {
  access = "access",
  refresh = "refresh",
}

export const generateToken = async ({
  payload,
  secret = process.env.ACCESS_USER_TOKEN_SIGNATURE as string,
  options = { expiresIn: Number(process.env.ACCESS_TOKEN_TIME_OUT) },
}: {
  payload: object;
  secret?: Secret;
  options?: SignOptions;
}): Promise<string> => {
  return sign(payload, secret, options);
};

export const verifyToken = async ({
  token,
  secret = process.env.ACCESS_USER_TOKEN_SIGNATURE as string,
}: {
  token: string;
  secret: Secret;
}): Promise<JwtPayload> => {
  return verify(token, secret) as JwtPayload;
};

export const detectSignature = async (
  role: RoleEnum = RoleEnum.user,
): Promise<SignatureEnumLevels> => {
  let signatureLevel: SignatureEnumLevels = SignatureEnumLevels.Bearer;

  switch (role) {
    case RoleEnum.admin:
      signatureLevel = SignatureEnumLevels.System;
      break;
    case RoleEnum.super:
      signatureLevel = SignatureEnumLevels.Super;
      break;
    default:
      signatureLevel = SignatureEnumLevels.Bearer;
      break;
  }

  return signatureLevel;
};

export const getSignature = async (
  signatureLevel: SignatureEnumLevels = SignatureEnumLevels.Bearer,
): Promise<{ access_signature: string; refresh_signature: string }> => {
  let signatures: { access_signature: string; refresh_signature: string } = {
    access_signature: "",
    refresh_signature: "",
  };

  switch (signatureLevel) {
    case SignatureEnumLevels.Super:
      signatures.access_signature = process.env
        .ACCESS_SUPER_TOKEN_SIGNATURE as string;
      signatures.refresh_signature = process.env
        .REFRESH_SUPER_TOKEN_SIGNATURE as string;
      break;
    case SignatureEnumLevels.System:
      signatures.access_signature = process.env
        .ACCESS_SYSTEM_TOKEN_SIGNATURE as string;
      signatures.refresh_signature = process.env
        .REFRESH_SYSTEM_TOKEN_SIGNATURE as string;
      break;
    default:
      signatures.access_signature = process.env
        .ACCESS_USER_TOKEN_SIGNATURE as string;
      signatures.refresh_signature = process.env
        .REFRESH_USER_TOKEN_SIGNATURE as string;
      break;
  }

  return signatures;
};

export const createLoginCredentials = async (user: HUserDoc) => {
  const signatureLevel = await detectSignature(user.role);

  const signature = await getSignature(signatureLevel);
  const jwtid = uuid();
  const access_token = await generateToken({
    payload: { id: user._id },
    secret: signature.access_signature,
    options: { expiresIn: Number(process.env.ACCESS_TOKEN_TIME_OUT), jwtid },
  });
  const refresh_token = await generateToken({
    payload: { id: user._id },
    secret: signature.refresh_signature,
    options: { expiresIn: Number(process.env.REFRESH_TOKEN_TIME_OUT), jwtid },
  });

  return { access_token, refresh_token };
};

export const decodeToken = async ({
  authorization,
  tokenType = TokenEnum.access,
}: {
  authorization: string;
  tokenType?: TokenEnum;
}) => {

  const userModel = new UserRepository(UserModel);
  const tokenModel = new TokenRepository(TokenModel);
  const [bearerKey, token] = authorization.split(" ");

  if (!bearerKey || !token) throw new NotAuthorizedError("Missing token parts");

  const signatures = await getSignature(bearerKey as SignatureEnumLevels);

  const decode = await verifyToken({
    token,
    secret:
      tokenType === TokenEnum.refresh
        ? signatures.refresh_signature
        : signatures.access_signature,
  });
  if (!decode.id || !decode.iat) throw new BadRequestError("Invalid payload");
  const oldToken = await tokenModel.findOne({
    filter: { jti: decode.jti as string },
  });

  if (oldToken) throw new BadRequestError("Invalid or Old token");
  const user = await userModel.findOne({ filter: { _id: decode.id } });
  if (!user) throw new BadRequestError("Not register account");

  if (user.changedCredentialsAt?.getTime() || 0 > decode.iat * 1000)
    throw new NotAuthorizedError("invalid or old credentials");
  return { user, decode };
};

export const createRevokeToken = async (decode: JwtPayload) => {
  const tokenModel = new TokenRepository(TokenModel);

  const [result] =
    (await tokenModel.create({
      data: [
        {
          jti: decode.jti as string,
          expiresIn:
            (decode.iat as number) + Number(process.env.REFRESH_TOKEN_TIME_OUT),
          userId: decode.id,
        },
      ],
    })) || [];

  if (!result) throw new BadRequestError("Fail to revoke this token");

  return result;
};
