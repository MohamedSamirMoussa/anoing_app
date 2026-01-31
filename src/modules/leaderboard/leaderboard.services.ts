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
      const page = parseInt(req.query.page as string);
      const limit = parseInt(req.query.limit as string);
      const skip = (page - 1) * limit;

      let sourceData: ILeaderboardUser[] = await this.leaderboardModel.find({
        filter: { serverName },
        options: { sort: { "playTime.hours": -1 }, lean: true },
      });

      let onlineCount = 0;

      if (sourceData.length === 0) {
        console.log("DB is empty, fetching from Server...");
        const response = await getConnectionWithServer(serverName);
        sourceData = response?.sortedLeaderboard || [];
        onlineCount = response?.onlineCount || 0;
      } else {
        try {
          const fastCheck = (await Promise.race([
            getConnectionWithServer(serverName),
            new Promise((_, reject) => setTimeout(() => reject(), 1500)),
          ])) as any;
          onlineCount = fastCheck?.onlineCount || 0;

          const onlineUsers = fastCheck?.sortedLeaderboard
            ?.filter((u: any) => u.is_online)
            .map((u: any) => u.username);
          sourceData = sourceData.map((user) => ({
            ...user,
            is_online: onlineUsers?.includes(user.username) || false,
          }));
        } catch (e) {
          sourceData = sourceData.map((user) => ({
            ...user,
            is_online: user.is_online || false,
          }));
        }
      }

      const paginatedData = sourceData.slice(skip, skip + limit);

      return successHandler({
        res,
        result: {
          leaderboard: paginatedData,
          onlineCount,
          pagination: {
            currentPage: page,
            totalPages: Math.ceil(sourceData.length / limit) || 0,
            totalItems: sourceData.length,
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
