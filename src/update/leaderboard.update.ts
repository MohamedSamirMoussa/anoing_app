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
    // تجنب التشغيل وقت الـ Build
    if (process.env.NEXT_PHASE === "phase-production-build") return;
    this.startAutoUpdate();
  }

  public startAutoUpdate(
    interval = Number(process.env.LEADERBOARD_UPDATE_INTERVAL) || 10000,
  ) {
    if (this.isUpdate) return;
    this.isUpdate = true;

    const servers = ["SB4"];

    const update = async () => {
      try {
        console.log(
          `[AutoUpdate] Starting parallel update for ${servers.length} servers...`,
        );

        await Promise.all(
          servers.map(async (serverName) => {
            try {
              console.log(`[Checking] Attempting to fetch: ${serverName}`);
              const response = await getConnectionWithServer(serverName);

              if (!response || !response.sortedLeaderboard) {
                console.warn(
                  `[AutoUpdate] ⚠️ ${serverName} returned no leaderboard data.`,
                );
                return;
              }

              // تصحيح: التعامل مع المصفوفة مباشرة دون .values()
              const sortedLeaderboard = response.sortedLeaderboard;
              const leaderboardData = Array.isArray(sortedLeaderboard)
                ? sortedLeaderboard
                : Array.from((sortedLeaderboard as any).values());

              // معالجة حالة السيرفر الفاضي (مثل SB4)
              if (leaderboardData.length === 0) {
                console.log(
                  `[AutoUpdate] ✅ ${serverName} is empty (0 players), skipping DB.`,
                );
                return;
              }

              const bulkData: AnyBulkWriteOperation<HLeaderboardDoc>[] =
                leaderboardData.map((user: any) => ({
                  updateOne: {
                    filter: { username: user.username, serverName: serverName },
                    update: {
                      $set: {
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
                      $setOnInsert: { createdAt: new Date() },
                    },
                    upsert: true,
                  },
                }));

              if (bulkData.length > 0) {
                await this.leaderboardModel.bulkWrite(bulkData as any);
                console.log(
                  `[AutoUpdate] ✅ ${serverName} updated: ${leaderboardData.length} players`,
                );
              }
            } catch (serverError: any) {
              console.error(
                `[AutoUpdate] ❌ Error for ${serverName}:`,
                serverError.message,
              );
            }
          }),
        );
      } catch (error) {
        console.log("[AutoUpdate] Global loop error:", error);
      } finally {
        setTimeout(update, interval);
      }
    };

    update();
  }
}

export default new StartLeaderboardAutoUpdate();
