import rateLimit from "express-rate-limit";
import cors from "cors";
import helmet from "helmet";
import type { NextFunction, Response, Request, Express } from "express";
import { config } from "dotenv";
import { resolve } from "path";
import express from "express";
import cookieParser from "cookie-parser";
import { Server as SocketIoServer } from "socket.io";
// if (process.env.NODE_ENV !== "production") {
config({ path: resolve("./config/.env.development") });
// } else {
//   config()
// }

import { authController, blogRouter, leaderboardController } from "./modules";
import { DBconnection, LeaderboardModel } from "./DB";
import { globalErrorHandling } from "./utils";
import { donateController } from "./modules/donate";
import { createServer } from "http";
import leaderboardAutoUpdate from "./update/leaderboard.update";
const bootstrap = async (app: Express): Promise<void> => {
  const PORT: number = Number(process.env.PORT) || 3000;

  app.use(
    helmet(),
    cors({
      origin: true,
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

  const httpServer = createServer(app);
  const io = new SocketIoServer(httpServer, {
    cors: {
      origin: "http://localhost:3000",
      methods: ["GET", "POST"],
      credentials: true,
    },
  });

  io.of("/leaderboard").on("connection", (socket) => {
    console.log("Client connected:", socket.id);

    const interval = setInterval(async () => {
      try {
        const leaderboardData = await LeaderboardModel.find({} as any)
          .sort({ totalPlayTime: -1 })
          .lean()
          .exec();
        // const onlineCount = await LeaderboardModel.countDocuments({is_online:true})

        socket.emit("leaderboard_update", {
          leaderboard: leaderboardData,
          // onlineCount,
        });
      } catch (err) {
        console.error("Error fetching leaderboard:", err);
      }
    }, 10000);

    socket.on("disconnect", () => {
      console.log("Client disconnected:", socket.id);
      clearInterval(interval);
    });
  });

  httpServer.listen(PORT, () => {
    console.log(`Server is running on port ::: ${PORT}`);
  });
};

export default bootstrap;
