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
  NotFoundError,
  SubjectEnum,
  successHandler,
  verifyGoogleToken,
} from "../../utils";
import {
  ConfirmEmailType,
  LoginType,
  LogoutType,
  RegisterType,
  ResendOtpType,
} from "./user.dto";
import { LogoutEnum } from "../../middleware";
import { JwtPayload } from "jsonwebtoken";
import axios from "axios";

class UserServices {
  private userModel = new UserRepository(UserModel);
  private leaderboardModel = new LeaderboardRepository(LeaderboardModel);

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

  constructor() {}

  register = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<Response | void> => {
    try {
      const { username, email, password, gender }: RegisterType = req.body;

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
            confirmedAt: new Date(),
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

      user.confirmedAt = new Date();
      user.confirmEmailOtp = undefined;
      await user.save();
      return successHandler({ res, status: 200, message: "Email confirmed" });
    } catch (error) {
    return  next(error);
    }
  };

  resendOtp = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<Response | void> => {
    try {
      const { email }: ResendOtpType = req.body;
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
      const user: any = await this.userModel.findOneAndUpdate({
        filter: { email } as any,
        update: { isLogged: true } as any,
        options: { lean: true },
      });

      if (!user) throw new NotFoundError("User not found");
      if (!user.confirmedAt)
        throw new ConflictError("Please confirm your email first");
      if (user.password && !(await compareHash(password, user.password)))
        throw new BadRequestError("Invalid credentials");

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
      const { token } = req.body;
      const { name, email } = await verifyGoogleToken(token);

      if(!name || !email) throw new BadRequestError("in-valid google token")

      let user: any = await this.userModel.findOne({
        filter: { email } as any,
        options: { lean: false },
      });

      if (!user) {
        const created = await this.userModel.create({
          data: [
            {
              username: name,
              email,
              provider: ProvidersEnum.google as any,
              confirmedAt: new Date(),
              isLogged: true,
              role: RoleEnum.user as any,
            },
          ],
        });
        user = created ? created[0] : null;
      } else {
        user.isLogged = true;
        await user.save();
      }

      await this.handleLoginSuccess(res, user as HUserDoc);
      return successHandler({ res, message: "Login with Google success" });
    } catch (error) {
     return next(error);
    }
  };

  discordRedirect = (req: Request, res: Response) => {
    const clientId = process.env.DISCORD_CLIENT_ID;
    const discordUrl = `https://discord.com/oauth2/authorize?client_id=${clientId}&response_type=code&redirect_uri=https%3A%2F%2Fanoing-app.vercel.app%2Fapi%2Fv1%2Fauth%2Fdiscord%2Fcallback&scope=identify`;
    return successHandler({ res, result: {discordUrl} });
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

      const tokenRes = await axios.post(
        "https://discord.com/api/oauth2/token",
        params.toString(),
        {
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
        },
      );

      const userRes = await axios.get("https://discord.com/api/users/@me", {
        headers: { Authorization: `Bearer ${tokenRes.data.access_token}` },
      });

      const discordUser = userRes.data;
      let user: any = await this.userModel.findOne({
        filter: { discordId: discordUser.id } as any,
        options: { lean: false },
      });

      if (!user) {
        const created = await this.userModel.create({
          data: [
            {
              username: discordUser.username,
              discordId: discordUser.id,
              provider: ProvidersEnum.discord as any,
              confirmedAt: new Date(),
              isLogged: true,
              role: RoleEnum.user as any,
            },
          ],
        });
        user = created ? created[0] : null;
      } else {
        user.isLogged = true;
        await user.save();
      }

      await this.handleLoginSuccess(res, user as HUserDoc);
      res.redirect(process.env.FRONTEND_URL || "http://localhost:3000");
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
    return  next(error);
    }
  };

  refreshToken = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const credentials = await createLoginCredentials(req.user as HUserDoc);
      await createRevokeToken(req.decode as JwtPayload);
      return successHandler({ res, status: 201, result: credentials });
    } catch (error) {
    return  next(error);
    }
  };

  forgetPassword = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { email } = req.body;
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
      const { otp, email } = req.body;
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
      const { email, newPassword } = req.body;
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
    return  next(error);
    }
  };
}

export default new UserServices();
