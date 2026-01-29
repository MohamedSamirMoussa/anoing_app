import type { NextFunction, Request, Response } from "express";
import {
  HUserDoc,
  IUserSchema,
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
import { UpdateQuery } from "mongoose";
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
        filter: { email },
        options: { lean: true },
        select: "email",
      });

      if (isUserExist) throw new IsAlreadyExist("This email is already exists");

      const OTP = generateOtp({
        email,
        subject: SubjectEnum.registration,
      });

      const [user] =
        (await this.userModel.create({
          data: [
            {
              username,
              email,
              password: await hashed(password),
              gender,
              role: RoleEnum.user,
              confirmEmailOtp: encryption(OTP),
              expiredOtpAt: new Date(Date.now() + 1 * 60 * 1000), //1 min
              expireAt: new Date(Date.now() + 30 * 60 * 1000), // 30 min
              isLogged: false,
            },
          ],
          options: { validateBeforeSave: true },
        })) || [];

      if (!user) throw new BadRequestError("User creation failed");

      return successHandler({
        res,
        status: 201,
        message: "User registered successfully",
      });
    } catch (error) {
      next(error);
    }
  };

  confirmEmail = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<Response | void> => {
    try {
      const { email, otp }: ConfirmEmailType = req.body;
      if (!email || !otp) {
        throw new BadRequestError("Email and OTP are required");
      }

      const user = await this.userModel.findOne({
        filter: { email },
        options: { lean: false },
      });
      if (user?.confirmedAt)
        throw new ConflictError("Email is confirmed already");

      if (!user) throw new BadRequestError("Email isn't exists");

      const otpExpired = user.expiredOtpAt && user.expiredOtpAt < new Date();

      if (
        decryption(user?.confirmEmailOtp as string) !== otp ||
        otpExpired ||
        !user.confirmEmailOtp
      ) {
        user.confirmEmailOtp = undefined;
        user.expiredOtpAt = undefined;
        await user.save();
        throw new BadRequestError(
          "Invalid or Expired OTP ... Please resend OTP or re-register after 30 minutes",
        );
      }

      user.confirmedAt = new Date();
      user.confirmEmailOtp = undefined;
      user.expireAt = undefined;
      user.expiredOtpAt = undefined;
      await user.save();

      return successHandler({
        res,
        status: 200,
        message: "Email confirmed successfully",
      });
    } catch (error) {
      next(error);
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
      const user = await this.userModel.findOne({
        filter: { email },
        options: { lean: false },
      });
      if (!user) throw new NotFoundError("User not found");
      if (!user.confirmedAt) {
        if (user.confirmedAt)
          throw new ConflictError("Email is already confirmed");
        const otp = generateOtp({
          user: user as HUserDoc,
          subject: SubjectEnum.registration,
        });
        user.confirmEmailOtp = encryption(otp);
        user.expiredOtpAt = new Date(Date.now() + 1 * 60 * 1000); //1 min
        user.expireAt = new Date(Date.now() + 30 * 60 * 1000); // 30 min
        await user.save();
      } else {
        const otp = generateOtp({
          user: user as HUserDoc,
          subject: SubjectEnum.resetPassword,
        });
        user.forgetPasswordOtp = encryption(otp);
        user.forgetPasswordOtpExpireAt = new Date(Date.now() + 1 * 60 * 1000); //1 min
        await user.save();
      }
      return successHandler({
        res,
        status: 200,
        message: "OTP resent successfully",
      });
    } catch (error) {
      next(error);
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
        throw new BadRequestError("Email and Password are required");

      const user = await this.userModel.findOneAndUpdate({
        filter: { email },
        update: { isLogged: true },
        options: { lean: true },
      });
      if (!user)
        throw new NotFoundError("User not found ... please register first");

      if (!user.confirmedAt)
        throw new ConflictError("Please confirm your email first");

      if (
        (user.password && !(await compareHash(password, user?.password))) ||
        user.email !== email
      ) {
        throw new BadRequestError("Invalid credentials");
      }

      await this.handleLoginSuccess(res, user as HUserDoc);

      return successHandler({
        res,
        status: 202,
        message: "Login successful",
      });
    } catch (error) {
      next(error);
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
      if (!email || !name) {
        throw new BadRequestError("Invalid Google data");
      }

      let user: HUserDoc | null = await this.userModel.findOne({
        filter: { email },
        options: { lean: false },
      });

      if (!user) {
        const createdUsers = await this.userModel.create({
          data: [
            {
              username: name,
              email,
              provider: ProvidersEnum.google,
              confirmedAt: new Date(),
              isLogged: true,
              role: RoleEnum.user,
            },
          ],
          options: { validateBeforeSave: true },
        });

        // خد أول عنصر من المصفوفة لأنك باعت يوزر واحد بس
        user = createdUsers ? createdUsers[0] : null;
      } else {
        user.isLogged = true;
        await user.save();
      }

      if (!user) {
        throw new BadRequestError("User not created");
      }

      await this.handleLoginSuccess(res, user as HUserDoc);
      return successHandler({
        res,
        status: 200,
        message: "Login with Google success",
      });
    } catch (error) {
      next(error);
    }
  };

  discordRedirect = (req: Request, res: Response) => {
    const clientId = process.env.DISCORD_CLIENT_ID;

    const discordUrl = `https://discord.com/oauth2/authorize?client_id=${clientId}&response_type=code&redirect_uri=http%3A%2F%2Flocalhost%3A5000%2Fapi%2Fv1%2Fauth%2Fdiscord%2Fcallback&scope=identify`;

    return successHandler({ res, result: discordUrl });
  };

  discordLogin = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const code = req.query.code as string;
      if (!code) throw new BadRequestError("Code is required");

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
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            Accept: "application/json",
          },
        },
      );

      const userRes = await axios.get("https://discord.com/api/users/@me", {
        headers: {
          Authorization: `Bearer ${tokenRes.data.access_token}`,
        },
      });

      const discordUser = userRes.data;

      let user: HUserDoc | null = await this.userModel.findOne({
        filter: { discordId: discordUser.id },
        options: { lean: false },
      });

      if (!user) {
        user = await this.userModel.create({
          data: [
            {
              username: discordUser.username,
              email: discordUser.email ?? undefined,
              discordId: discordUser.id,
              provider: ProvidersEnum.discord,
              confirmedAt: new Date(),
              isLogged: true,
              role: RoleEnum.user,
            },
          ],
          options: { validateBeforeSave: true },
        });
      } else {
        user.isLogged = true;
        await user.save();
      }

      if (!user) {
        throw new BadRequestError("User not created after Discord login");
      }

      await this.handleLoginSuccess(res, user as HUserDoc);

      // Redirect ONLY (no JSON after redirect)
      res.redirect("http://localhost:3000");
    } catch (error) {
      next(error);
    }
  };

  checkAuth = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<Response | void> => {
    try {
      const token = req.cookies.access_token;
      if (!token) throw new BadRequestError("Please login first");

      const user = await this.userModel.findOne({
        filter: { email: req.user?.email || {} },
        options: { lean: true },
        select: "username email role isLogged",
      });

      if (!user) throw new BadRequestError("user not found");

      return successHandler({
        res,
        result: user,
      });
    } catch (error) {
      next(error);
    }
  };

  refreshToken = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<Response | void> => {
    try {
      const credentials = await createLoginCredentials(req.user as HUserDoc);
      await createRevokeToken(req.decode as JwtPayload);
      return successHandler({
        res,
        status: 201,
        result: credentials,
      });
    } catch (error) {
      next(error);
    }
  };

  forgetPassword = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<Response | void> => {
    try {
      const { email } = req.body;
      if (!email) throw new BadRequestError("Email is required");

      const user = await this.userModel.findOne({
        filter: { email },
        options: { lean: false },
      });
      const OTP = await generateOtp({
        user: user as HUserDoc,
        subject: SubjectEnum.resetPassword,
      });

      if (!user) throw new NotFoundError("User not found");
      user.forgetPasswordOtp = encryption(OTP);
      user.forgetPasswordOtpExpireAt = new Date(Date.now() + 1 * 60 * 1000);
      await user.save();

      if (
        user.forgetPasswordOtpExpireAt &&
        user.forgetPasswordOtpExpireAt < new Date()
      ) {
        throw new BadRequestError(
          "OTP already sent, please wait before requesting again",
        );
      }

      return successHandler({ res });
    } catch (error) {
      next(error);
    }
  };

  confirmPasswordOtp = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<Response | void> => {
    try {
      const { otp, email } = req.body;

      if (!otp || !email)
        throw new BadRequestError("OTP and Email are required");

      const user = await this.userModel.findOne({
        filter: { email },
        options: { lean: false },
      });
      if (!user)
        throw new BadRequestError(
          "Something went wrong ... Please check your email",
        );

      const otpExpired =
        user.forgetPasswordOtpExpireAt &&
        user.forgetPasswordOtpExpireAt < new Date();

      if (otpExpired) {
        user.forgetPasswordOtp = undefined;
        user.forgetPasswordOtpExpireAt = undefined;
        await user.save();
        throw new BadRequestError("Expired OTP");
      }

      if (!user.forgetPasswordOtp)
        throw new ConflictError("Please resend your OTP code");

      if (decryption(user?.forgetPasswordOtp as string) !== otp || otpExpired) {
        throw new BadRequestError("Invalid or Expired OTP");
      }

      user.forgetPasswordOtp = undefined;
      user.forgetPasswordOtpExpireAt = undefined;
      user.confirmForgetPasswordAt = new Date();
      await user.save();

      return successHandler({
        res,
        status: 200,
        message: "Reset password confirmed",
      });
    } catch (error) {
      next(error);
    }
  };

  resetPassword = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<Response | void> => {
    try {
      const { email, newPassword, confirmPassword } = req.body;

      if (!email || !newPassword || !confirmPassword)
        throw new BadRequestError(
          "New password , Confirm password and Email are required",
        );

      const user = await this.userModel.findOne({
        filter: { email },
        options: { lean: false },
      });

      if (!user) throw new ConflictError("Something went wrong");
      if (!user?.confirmForgetPasswordAt) {
        throw new ConflictError(
          "Please verify your email to complete your process",
        );
      }
      user.password = await hashed(newPassword as string);
      await user.save();

      return successHandler({
        res,
        status: 202,
        message: "Password Changed",
      });
    } catch (error) {
      next(error);
    }
  };

  getAllUsers = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<Response | void> => {
    try {
      if (!req.user) throw new BadRequestError("Please Login First");

      const webUsers = await this.userModel.find({ filter: {} });
      const gameUsers = await this.leaderboardModel.find({ filter: {} });

      return successHandler({ res, result: { webUsers, gameUsers } });
    } catch (error) {
      next(error);
    }
  };

  logout = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<Response | void> => {
    try {
      const { flag }: LogoutType = req.body;

      let update: UpdateQuery<IUserSchema> = {};

      switch (flag) {
        case LogoutEnum.All:
          update.changedCredentialsAt = new Date();
          update.isLogged = false;
          break;

        default:
          await createRevokeToken(req.decode as JwtPayload);
          update.isLogged = false;
          break;
      }

      await this.userModel.updateOne({
        filter: { _id: req.user?._id },
        update,
      });

      return successHandler({ res });
    } catch (error) {
      next(error);
    }
  };
}

export default new UserServices();
