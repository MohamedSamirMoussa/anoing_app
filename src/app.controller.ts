import rateLimit from "express-rate-limit";
import cors from "cors";
import helmet from "helmet";
import type { NextFunction, Response, Request, Express } from "express";
import { config } from "dotenv";
import { resolve } from "path";
import express from "express";
import cookieParser from "cookie-parser";
if (process.env.NODE_ENV !== "production") {
  config({ path: resolve("./config/.env.development") });
} else {
  config();
}

import { authController, blogRouter, initIO, leaderboardController } from "./modules";
import { DBconnection } from "./DB";
import { globalErrorHandling } from "./utils";
import { donateController } from "./modules/donate";
import leaderboardAutoUpdate from "./update/leaderboard.update";
const bootstrap = async (app: Express): Promise<void> => {
  const PORT: number = Number(process.env.PORT) || 3000;

  app.use(
    helmet(),
    cors({
      origin: process.env.FE_URL || "http://localhost:3000",
      credentials: true,
    }),
    rateLimit({
      windowMs: 60 * 60 * 1000,
      limit: 300,
      message: { error: "Too many requests, please try again later" },
    }),
    cookieParser(),
    express.json({ limit: "10kb" }),
  );

  await DBconnection();
  await leaderboardAutoUpdate.startAutoUpdate();
  app.use("/api/v1/auth", authController);
  app.use("/api/v1/leaderboard", leaderboardController);
  app.use("/api/v1/blog", blogRouter);
  app.use("/api/v1/checkout", donateController);

  app.get("/health", (req, res) => {
    res.status(200).json({
      status: "ok",
      app: process.env.APP_NAME,
    });
  });

  app.get("/", (req: Request, res: Response, next: NextFunction) => {
    return res.status(200).json({
      message: `Welcome ${process.env.APP_NAME}`,
    });
  });

  app.use((req: Request, res: Response, next: NextFunction) => {
    res.status(404).json({
      message: "Page not found",
    });
  });

  app.use(globalErrorHandling);


  const httpServer = app.listen(PORT, () => {
    console.log(`Server is running on port ::: ${PORT}`);
  });

  initIO(httpServer)
};

export default bootstrap;
