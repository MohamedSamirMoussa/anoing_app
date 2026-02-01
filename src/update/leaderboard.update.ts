import { AnyBulkWriteOperation } from "mongoose";
import {
  HLeaderboardDoc,
  ILeaderboardUser,
  LeaderboardModel,
  LeaderboardRepository,
} from "../DB";
import { getConnectionWithServer } from "../utils";
import { getRcon } from "./../utils/rcon/rcon.connection";

class StartLeaderboardAutoUpdate {
  private leaderboardModel = new LeaderboardRepository(LeaderboardModel);
  private isUpdate: boolean = false;
  private rconCache: Map<string, { data: any; timestamp: number }> = new Map();
  private cacheDuration = 30000;
  constructor() {
    this.startAutoUpdate();
  }

  private async getCachedRconData(serverName: string) {
    const now = Date.now();
    const cached = this.rconCache.get(serverName);
    if (cached && now - cached?.timestamp < this.cacheDuration) {
      console.log(`[Cache] Using cached data for ${serverName}`);
      return cached?.data;
    }

    const data = await getConnectionWithServer(serverName);
    this.rconCache.set(serverName, { data, timestamp: now });
    return data;
  }

  public startAutoUpdate(
    interval = Number(process.env.LEADERBOARD_UPDATE_INTERVAL) || 10000,
  ) {
    if (this.isUpdate) return;
    this.isUpdate = true;

    const servers = ["AllTheMons"];

    const update = async () => {
      try {
        for (const serverName of servers) {
          const { sortedLeaderboard } =
            await this.getCachedRconData(serverName);

          if (sortedLeaderboard && Array.isArray(sortedLeaderboard)) {
            const bulkData: AnyBulkWriteOperation<HLeaderboardDoc>[] =
              Array.from(sortedLeaderboard.values()).map((user) => {
                  console.log("user:::::::::",{user});
                return {
                    
                  updateOne: {
                    filter: {
                      username: user.username,
                      serverName: serverName,
                    },
                    update: {
                      $set: {
                        // ⚠️ ضروري: كل الحقول اللي عايز تتعدل
                        is_online: user.is_online,
                        username: user.username,
                        serverName: serverName,
                        avatar:
                          user.avatar ||
                          `https://mc-heads.net/avatar/${user.username}/64`,
                        playTime: user.playTime,
                        rank: user.rank,
                        lastSeen: user.lastSeen,
                        joinTime: user.joinTime,
                        totalPlayTime: user.playTime,
                        updatedAt: new Date(),
                      },
                      $setOnInsert: {
                        createdAt: new Date(),
                      },
                    },
                    upsert: true,
                  },
                };
              });

            if (bulkData.length) {
              await this.leaderboardModel.bulkWrite(bulkData as any);
            }

            console.log(
              `[AutoUpdate] Updated ${serverName}: ${sortedLeaderboard.length} players`,
            );
          }
        }
      } catch (error) {
        console.log("Leaderboard update error:", error);
      } finally {
        setTimeout(update, interval);
      }
    };

    update();
  }
}

export default new StartLeaderboardAutoUpdate();
