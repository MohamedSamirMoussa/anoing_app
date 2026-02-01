import { AnyBulkWriteOperation } from "mongoose";
import {
  HLeaderboardDoc,
  LeaderboardModel,
  LeaderboardRepository,
} from "../DB";
import { getConnectionWithServer } from "../utils";

class StartLeaderboardAutoUpdate {
  private leaderboardModel = new LeaderboardRepository(LeaderboardModel);
  private isUpdate: boolean = false;

  constructor() {
    this.startAutoUpdate();
  }

  public startAutoUpdate(interval = Number(process.env.LEADERBOARD_UPDATE_INTERVAL) || 10000) {
    if (this.isUpdate) return;
    this.isUpdate = true;

    const servers = ["AllTheMons"];

    const update = async () => {
      try {
        for (const serverName of servers) {
          const { sortedLeaderboard } = await getConnectionWithServer(serverName);

          if (sortedLeaderboard && Array.isArray(sortedLeaderboard)) {
            // تجنب أي conflicts لنفس username
            const userMap = new Map<string, typeof sortedLeaderboard[0]>();
            for (const user of sortedLeaderboard) {
              const key = `${user.username}-${serverName}`;
              userMap.set(key, { ...user, serverName });
            }

            const bulkData: AnyBulkWriteOperation<HLeaderboardDoc>[] = Array.from(userMap.values()).map(user => ({
              updateOne: {
                filter: { username: user.username, serverName },
                update: { $set: user },
                upsert: true,
              },
            }));

            if (bulkData.length) {
              await this.leaderboardModel.bulkWrite(bulkData as any);
            }

            console.log(`[AutoUpdate] Updated ${serverName}: ${sortedLeaderboard.length} players`);
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
