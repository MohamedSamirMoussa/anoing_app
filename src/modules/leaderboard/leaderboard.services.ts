import { NextFunction, Request, Response } from "express";
import { LeaderboardModel, LeaderboardRepository } from "../../DB";
import {

  successHandler,
} from "../../utils";

class LeaderboardServices {
  private leaderboardModel = new LeaderboardRepository(LeaderboardModel);


getLeaderBoard = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { serverName } = req.query;

    // جيب كل اللاعبين من DB مباشرة
    const users = await this.leaderboardModel.find({
      filter: { serverName },
    });

    const onlineCount = users.filter((u) => u.is_online).length;

    return successHandler({
      res,
      result: {
        leaderboard: users,
        onlineCount,
        pagination: {
          totalItems: users.length,
        },
      },
    });
  } catch (error) {
    next(error);
  }
}
  // searchPlayers = async (req: Request, res: Response, next: NextFunction) => {
  //   try {
  //     const { username } = req.query;

  //     if (!username) {
  //       throw new BadRequestError("Please provide a username to search");
  //     }

  //     const searchResult = await this.leaderboardModel.find({
  //       filter: { username: { $regex: username, $options: "i" } },
  //     })

  //     return successHandler({
  //       res,
  //       result: { searchResult },
  //     });
  //   } catch (error) {
  //     return next(error);
  //   }
  // };
}

export default new LeaderboardServices();
