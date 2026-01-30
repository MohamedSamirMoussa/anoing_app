import { NextFunction, Request, Response } from "express";
import { LeaderboardModel, LeaderboardRepository } from "../../DB";
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
    const servers = ["atm 10"];
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
      const { serverName } = req.body;
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;

      const skip = (page - 1) * limit;

      const { sortedLeaderboard, onlineCount } =
        await getConnectionWithServer(serverName);

      if (!sortedLeaderboard || sortedLeaderboard.length === 0)
        throw new BadRequestError("No leaderboard data found");

      const paginatedData = sortedLeaderboard.slice(skip, skip + limit);

      return successHandler({
        res,
        result: {
          leaderboard: paginatedData,
          onlineCount,
          pagination: {
            currentPage: page,
            totalPages: Math.ceil(sortedLeaderboard.length / limit),
            totalItems: sortedLeaderboard.length,
            limit,
          },
        },
      });
    } catch (error) {
      next(error);
    }
  };
}

export default new LeaderboardServices();
