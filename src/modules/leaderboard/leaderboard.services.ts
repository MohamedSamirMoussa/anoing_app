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
    const servers = ["AllTheMons" , "atm 10"];
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
      const { serverName } = req.query;
      let users ;

      const { sortedLeaderboard, onlineCount } = await getConnectionWithServer(
        serverName as string,
      );

      if (!sortedLeaderboard || sortedLeaderboard.length === 0) {
         users = await this.leaderboardModel.find({
          filter:{serverName}
        })
      }


      return successHandler({
        res,
        result: {
          leaderboard: sortedLeaderboard || users,
          onlineCount,
          pagination: {

            totalItems: sortedLeaderboard.length,

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
      })

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
