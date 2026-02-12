import type { NextFunction, Request, Response } from "express";
import {
  HUserDoc,
  LeaderboardModel,
  LeaderboardRepository,
  ProvidersEnum,
  RoleEnum,
  UserModel,
  UserRepository,
} from "../../DB";
import {
  BadRequestError,
  compareHash,
  ConflictError,
  createLoginCredentials,
  createRevokeToken,
  decryption,
  detectSignature,
  encryption,
  generateOtp,
  hashed,
  IsAlreadyExist,
  NotAuthorizedError,
  NotFoundError,
  SubjectEnum,
  successHandler,
  verifyGoogleToken,
} from "../../utils";
import {
  ConfirmEmailType,
  ForgetPasswordType,
  LoginType,
  LoginWithGoogleType,
  LogoutType,
  RegisterType,
  ResendOtpType,
  ResetPasswordType,
} from "./user.dto";
import { LogoutEnum } from "../../middleware";
import { JwtPayload } from "jsonwebtoken";
import axios from "axios";
import { customAlphabet } from "nanoid";

class UserServices {
  private userModel = new UserRepository(UserModel);
  private leaderboardModel = new LeaderboardRepository(LeaderboardModel);

  private alphabet =
    "0123456789" +
    "abcdefghijklmnopqrstuvwxyz" +
    "ABCDEFGHIJKLMNOPQRSTUVWXYZ" +
    "!@#$%^&*()_+-=[]{}|;:,.<>?";

  protected generatePassword = customAlphabet(this.alphabet, 15);
  private async handleLoginSuccess(res: Response, user: HUserDoc) {
    const { access_token, refresh_token } = await createLoginCredentials(user);
    const signatureLevel = await detectSignature(user.role);

    const cookieOptions = {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "none" as any,
    };

    res.cookie("access_token", access_token, cookieOptions);
    res.cookie("refresh_token", refresh_token, cookieOptions);
    res.cookie("signature_level", signatureLevel, cookieOptions);
  }
  private async syncSocialUser(userData: {
    email: string;
    username: string;
    provider: ProvidersEnum;
    discordId?: string;
    role?: RoleEnum;
    password?: string;
    confirmedAt?: Date;
    isLogged?: boolean;
  }) {
    let user = await this.userModel.findOne({
      filter: { email: userData.email } as any,
    });

    if (!user) {
      const created =
        (await this.userModel.create({
          data: [
            {
              username: userData.username,
              email: userData.email,
              provider: userData.provider,
              confirmedAt: new Date(),
              isLogged: true,
              password: await hashed(String(this.generatePassword())),
              role: RoleEnum.user as RoleEnum,
            },
          ],
        })) || [];
      return created && created.length > 0 ? created[0] : null;
    }
    user.isLogged = true;
    if (userData.discordId) user.discordId = userData.discordId;
    await user.save();
    return user;
  }
  constructor() {}

  register = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<Response | void> => {
    try {
      const { username, email, password, gender }: RegisterType = req.body;

      if (!username || !email || !password || !gender) {
        throw new BadRequestError(
          "Username , email , password and gender required",
        );
      }
      const isUserExist = await this.userModel.findOne({
        filter: { email } as any,
        options: { lean: true },
        select: "email",
      });

      if (isUserExist) throw new IsAlreadyExist("This email is already exists");

      const OTP = generateOtp({ email, subject: SubjectEnum.registration });

      const createdResult = await this.userModel.create({
        data: [
          {
            username: username || "",
            email,
            password: await hashed(password),
            gender,
            role: RoleEnum.user as any,
            confirmEmailOtp: encryption(OTP),
            expiredOtpAt: new Date(Date.now() + 1 * 60 * 1000),
            expireAt: new Date(Date.now() + 30 * 60 * 1000),
            isLogged: false,
          },
        ],
        options: { validateBeforeSave: true },
      });

      const user =
        createdResult && createdResult.length > 0 ? createdResult[0] : null;
      if (!user) throw new BadRequestError("User creation failed");

      return successHandler({
        res,
        status: 201,
        message: "User registered successfully",
      });
    } catch (error) {
      return next(error);
    }
  };

  confirmEmail = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<Response | void> => {
    try {
      const { email, otp }: ConfirmEmailType = req.body;
      if (!email || !otp) throw new BadRequestError("Email and otp required");
      const user: any = await this.userModel.findOne({
        filter: { email } as any,
        options: { lean: false },
      });

      if (!user) throw new BadRequestError("Email isn't exists");
      if (user.confirmedAt)
        throw new ConflictError("Email is confirmed already");

      const otpExpired = user.expiredOtpAt && user.expiredOtpAt < new Date();
      if (decryption(user.confirmEmailOtp as string) !== otp || otpExpired) {
        user.confirmEmailOtp = undefined;
        await user.save();
        throw new BadRequestError("Invalid or Expired OTP");
      }
      user.expiredAt = undefined;
      user.expiredOtpAt = undefined;
      user.confirmedAt = new Date();
      user.confirmEmailOtp = undefined;
      await user.save();
      return successHandler({ res, status: 200, message: "Email confirmed" });
    } catch (error) {
      return next(error);
    }
  };

  resendOtp = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<Response | void> => {
    try {
      const { email }: ResendOtpType = req.body;
      if (!email) throw new BadRequestError("Email is required");
      const user: any = await this.userModel.findOne({
        filter: { email } as any,
        options: { lean: false },
      });
      if (!user) throw new NotFoundError("User not found");

      const otp = generateOtp({
        email: user.email,
        subject: user.confirmedAt
          ? SubjectEnum.resetPassword
          : SubjectEnum.registration,
      });

      if (!user.confirmedAt) {
        user.confirmEmailOtp = encryption(otp);
        user.expiredOtpAt = new Date(Date.now() + 1 * 60 * 1000);
      } else {
        user.forgetPasswordOtp = encryption(otp);
        user.forgetPasswordOtpExpireAt = new Date(Date.now() + 1 * 60 * 1000);
      }
      await user.save();
      return successHandler({ res, message: "OTP resent successfully" });
    } catch (error) {
      return next(error);
    }
  };

  login = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<Response | void> => {
    try {
      const { email, password }: LoginType = req.body;

      if (!email || !password)
        throw new BadRequestError("Email and password is required");
      const user: any = await this.userModel.findOne({
        filter: { email },
        options: { lean: false },
      });

      if (!user) throw new NotFoundError("User not found");
      if (!user.confirmedAt)
        throw new ConflictError("Please confirm your email first");
      if (user.password && !(await compareHash(password, user.password)))
        throw new BadRequestError("Invalid credentials");
      user.isLogged = true;
      await user.save();
      await this.handleLoginSuccess(res, user as HUserDoc);
      return successHandler({ res, status: 202, message: "Login successful" });
    } catch (error) {
      return next(error);
    }
  };

  loginWithGoogle = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<Response | void> => {
    try {
      const { token }: LoginWithGoogleType = req.body;
      if (!token) throw new BadRequestError("Invalid token");
      const { name, email } = await verifyGoogleToken(token);
      if (!name || !email) throw new BadRequestError("in-valid google token");

      let user: any = await this.syncSocialUser({
        username: name,
        email: email,
        provider: ProvidersEnum.google as ProvidersEnum,
      });

      await this.handleLoginSuccess(res, user as HUserDoc);
      return successHandler({ res, message: "Login with Google success" });
    } catch (error) {
      return next(error);
    }
  };

  discordRedirect = (req: Request, res: Response) => {
    const discordUrl = process.env.DISCORD_URL_REDIRECT;
    return successHandler({ res, result: { discordUrl } });
  };

  discordLogin = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const code = req.query.code as string;
      const params = new URLSearchParams({
        client_id: process.env.DISCORD_CLIENT_ID as string,
        client_secret: process.env.DISCORD_SECRET_ID as string,
        grant_type: "authorization_code",
        code,
        redirect_uri: process.env.DISCORD_REDIRECT_URI as string,
      });

      const tokenRes = await axios
        .post("https://discord.com/api/oauth2/token", params.toString(), {
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
        })
        .catch((err) => {
          res.redirect(process.env.REDIRECT_URL as string);
          throw new BadRequestError("Invalid discord token");
        });

      const userRes = await axios
        .get("https://discord.com/api/users/@me", {
          headers: { Authorization: `Bearer ${tokenRes.data.access_token}` },
        })
        .catch((err) => {
          res.redirect(process.env.REDIRECT_URL as string);
          throw new NotFoundError("User not found");
        });

      const discordUser = userRes.data;
      const userEmail = discordUser.email || `${discordUser.id}@discord.user`;
      let user: any = await this.syncSocialUser({
        username: discordUser.username,
        provider: ProvidersEnum.discord,
        email: userEmail,
      });

      await this.handleLoginSuccess(res, user as HUserDoc);
      res.redirect(process.env.REDIRECT_URL as string);
    } catch (error) {
      return next(error);
    }
  };

  checkAuth = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = await this.userModel.findOne({
        filter: { email: req.user?.email } as any,
        options: { lean: true },
        select: "username email role isLogged",
      });
      return successHandler({ res, result: user as HUserDoc });
    } catch (error) {
      return next(error);
    }
  };

  refreshToken = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { refresh_token } = req.cookies;

      if (!refresh_token) {
        throw new NotAuthorizedError("Session expired, please login again");
      }

      const credentials = await createLoginCredentials(req.user as HUserDoc);
      await this.handleLoginSuccess(res, req.user as HUserDoc);
      await createRevokeToken(req.decode as JwtPayload);

      return successHandler({
        res,
        status: 201,
        result: credentials,
      });
    } catch (error) {
      return next(error);
    }
  };

  getToken = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { access_token, refresh_token } = req.cookies;

      if (!access_token || !refresh_token)
        throw new ConflictError("no tokens found");

      return successHandler({ res, result: { access_token, refresh_token } });
    } catch (error) {
      return next(error);
    }
  };

  forgetPassword = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { email }: ForgetPasswordType = req.body;
      if (!email) throw new BadRequestError("email is required");
      const user: any = await this.userModel.findOne({
        filter: { email } as any,
        options: { lean: false },
      });
      if (!user) throw new NotFoundError("User not found");

      const otp = generateOtp({
        email: user.email,
        subject: SubjectEnum.resetPassword,
      });
      user.forgetPasswordOtp = encryption(otp);
      user.forgetPasswordOtpExpireAt = new Date(Date.now() + 5 * 60 * 1000);
      await user.save();
      return successHandler({ res, message: "OTP sent" });
    } catch (error) {
      return next(error);
    }
  };

  confirmPasswordOtp = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const { otp, email }: ConfirmEmailType = req.body;
      const user: any = await this.userModel.findOne({
        filter: { email } as any,
        options: { lean: false },
      });
      if (!user || decryption(user.forgetPasswordOtp) !== otp)
        throw new BadRequestError("Invalid OTP");

      user.confirmForgetPasswordAt = new Date();
      user.forgetPasswordOtp = undefined;
      await user.save();
      return successHandler({ res, message: "Reset password confirmed" });
    } catch (error) {
      return next(error);
    }
  };

  resetPassword = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { email, newPassword }: ResetPasswordType = req.body;
      const user: any = await this.userModel.findOne({
        filter: { email } as any,
        options: { lean: false },
      });
      if (!user?.confirmForgetPasswordAt)
        throw new ConflictError("Please verify your email first");

      user.password = await hashed(newPassword);
      user.confirmForgetPasswordAt = undefined;
      await user.save();
      return successHandler({ res, message: "Password Changed" });
    } catch (error) {
      return next(error);
    }
  };

  getAllUsers = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const webUsers = await this.userModel.find({ filter: {} as any });
      const gameUsers = await this.leaderboardModel.find({ filter: {} as any });
      return successHandler({ res, result: { webUsers, gameUsers } });
    } catch (error) {
      return next(error);
    }
  };

  logout = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { flag }: LogoutType = req.body;
      let update: any = { isLogged: false };
      if (flag === LogoutEnum.All) update.changedCredentialsAt = new Date();
      else await createRevokeToken(req.decode as JwtPayload);

      await this.userModel.updateOne({
        filter: { _id: req.user?._id } as any,
        update,
      });
      return successHandler({ res });
    } catch (error) {
      return next(error);
    }
  };
}

export default new UserServices();
