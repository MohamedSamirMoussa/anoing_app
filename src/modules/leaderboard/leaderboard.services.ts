import { NextFunction, Request, Response } from "express";
import { LeaderboardModel, LeaderboardRepository } from "../../DB";
import { BadRequestError, successHandler } from "../../utils";

class LeaderboardServices {
  private leaderboardModel = new LeaderboardRepository(LeaderboardModel);

  getLeaderBoard = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<Response | void> => {
    try {
      const { serverName } = req.query;

      const leaderboard = await this.leaderboardModel.find({
        filter: { serverName },
        sort: { "playTime.seconds": -1, is_online: -1 },
      });

      return successHandler({
        res,
        result: {
          leaderboard,
          pagination: {
            totalItems: leaderboard.length,
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

      console.log(searchResult);

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
