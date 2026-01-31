import { NextFunction, Request, Response } from "express";
import { ILeaderboardUser, LeaderboardModel, LeaderboardRepository } from "../../DB";
import {
  BadRequestError,
  getConnectionWithServer,
  successHandler,
} from "../../utils";

class LeaderboardServices {
  private leaderboardModel = new LeaderboardRepository(LeaderboardModel);
  private isAutoUpdating: boolean = false;

  constructor() {
    this.startAutoUpdate();
  }

  private startAutoUpdate(
    intervalMs: number = Number(process.env.LEADERBOARD_UPDATE_INTERVAL),
  ) {
    if (this.isAutoUpdating) return;
    this.isAutoUpdating = true;
    const servers = ["AllTheMons", "atm 10"];
    const update = async () => {
      try {
        for (const serverName of servers) {
          const response = await getConnectionWithServer(serverName);

          if (
            response &&
            response.sortedLeaderboard.length > 0 &&
            Array.isArray(response.sortedLeaderboard)
          ) {
            const { sortedLeaderboard } = response;
            const bulkData = sortedLeaderboard.map((user) => ({
              updateOne: {
                filter: { username: user.username, serverName: serverName },
                update: { $set: { ...user, serverName } },
                upsert: true,
              },
            }));

            if (bulkData && bulkData.length > 0) {
              await this.leaderboardModel.bulkWrite(bulkData as any);
            }
            console.log(
              `[AutoUpdate] Updated ${serverName}: ${sortedLeaderboard.length} players`,
            );
          }
        }
      } catch (err) {
        console.error("[AutoUpdate] Error updating leaderboard:", err);
      } finally {
        setTimeout(update, intervalMs);
      }
    };

    update();
  }

getLeaderBoard = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<Response | void> => {
  try {
    const serverName = (req.query.serverName as string) || "atm 10";
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.max(1, parseInt(req.query.limit as string) || 10);
    const skip = (page - 1) * limit;

    // 1. استخدم any[] أو واجهة (Interface) لا ترث من Mongoose Document
    // لأن استخدام lean: true يحول الداتا لكائنات عادية
    let sourceData: any[] = await this.leaderboardModel.find({
      filter: { serverName },
      options: { sort: { "playTime.hours": -1 }, lean: true },
    });

    let onlineCount = 0;

    // 2. التحقق من البيانات والجلب من السيرفر إذا لزم الأمر
    if (!sourceData || sourceData.length === 0) {
      try {
        const response = await getConnectionWithServer(serverName);
        sourceData = response?.sortedLeaderboard || [];
        onlineCount = response?.onlineCount || 0;
      } catch (err) {
        sourceData = []; // نضمن أنها مصفوفة فارغة في حالة الفشل التام
      }
    } else {
      // 3. تحديث حالة الـ Online
      try {
        const fastCheck = (await Promise.race([
          getConnectionWithServer(serverName),
          new Promise((_, reject) => setTimeout(() => reject(), 1500)),
        ])) as any;

        onlineCount = fastCheck?.onlineCount || 0;
        const onlineUsers = new Set(
          fastCheck?.sortedLeaderboard
            ?.filter((u: any) => u.is_online)
            .map((u: any) => u.username)
        );

        sourceData = sourceData.map((user) => ({
          ...user,
          is_online: onlineUsers.has(user.username),
        }));
      } catch (e) {
        // في حالة الـ Timeout، نترك الداتا كما هي مع ضمان وجود الحقل
        sourceData = sourceData.map((user) => ({
          ...user,
          is_online: user.is_online || false,
        }));
      }
    }

    // 4. الـ Pagination الآمن
    const totalItems = sourceData.length;
    const paginatedData = sourceData.slice(skip, skip + limit);

    return successHandler({
      res,
      result: {
        leaderboard: paginatedData, // سيرجع مصفوفة فارغة [] إذا لم تكن هناك بيانات
        onlineCount,
        pagination: {
          currentPage: page,
          totalPages: Math.ceil(totalItems / limit) || 0,
          totalItems: totalItems,
          limit,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};
  searchPlayers = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { username } = req.query;

      if (!username) {
        throw new BadRequestError("Please provide a username to search");
      }

      const searchResult = await this.leaderboardModel.find({
        filter: { username: { $regex: username, $options: "i" } },
      });

      return successHandler({
        res,
        result: { searchResult },
      });
    } catch (error) {
      return next(error);
    }
  };
}

export default new LeaderboardServices();
