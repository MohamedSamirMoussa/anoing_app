import { DBconnection, ILeaderboardUser, LeaderboardModel } from "../../DB";
import { getRcon } from "./rcon.connection";

const parsePlayTime = (raw: string): number => {
  const match = raw.match(/(\d+)/);
  return match ? parseInt(match[1] as string, 10) : 0;
};

const upsertPlayer = async (
  username: string,
  isOnline: boolean,
  playTimeInSec: number,
): Promise<ILeaderboardUser> => {
  const playTime = {
    seconds: playTimeInSec,
    minutes: Math.floor(playTimeInSec / 60),
    hours: Math.floor(playTimeInSec / 3600),
  };

  const rank = getRank(playTime.hours);
  let dbPlayer = await LeaderboardModel.findOne({ username:username } as any);

  if (!dbPlayer) {
    dbPlayer = new LeaderboardModel({
      username,
      is_online: isOnline,
      playTime,
      // لو اللاعب داخل السيرفر دلوقتي يبقى ملوش آخر ظهور، لو مش موجود نسجله دلوقتي
      lastSeen: isOnline ? null : new Date(), 
      rank,
    });
  } else {
    // 💡 اللوجيك المهم هنا:
    // لو اللاعب كان مسجل عندنا إنه أونلاين، والآن أصبح أوفلاين، نحدث تاريخ آخر ظهور
    if (dbPlayer.is_online && !isOnline) {
      dbPlayer.lastSeen = new Date();
    } 
    // لو اللاعب رجع أونلاين، ممكن تصفر الـ lastSeen أو تسيبه زي ما هو حسب رغبتك
    else if (isOnline) {
      dbPlayer.lastSeen = null; 
    }

    dbPlayer.is_online = isOnline;
    dbPlayer.playTime = playTime;
    dbPlayer.rank = rank;
  }

  await dbPlayer.save();

  return {
    username,
    avatar: `https://mc-heads.net/avatar/${username}/64`,
    is_online: isOnline,
    playTime,
    lastSeen: dbPlayer.lastSeen,
    rank,
    online_count: isOnline ? 1 : 0,
  };
};

const getRank = (hours: number) => {
  if (hours >= 1500) return { name: "Immortal" };
  if (hours >= 700) return { name: "Legend" };
  if (hours >= 350) return { name: "Veteran" };
  if (hours >= 150) return { name: "Trusted" };
  if (hours >= 50) return { name: "Dedicated" };
  if (hours >= 24) return { name: "Regular" };
  if (hours >= 10) return { name: "Newcomer" };
  return { name: "Visitor" };
};

export const getConnectionWithServer = async (): Promise<{
  sortedLeaderboard: ILeaderboardUser[];
  onlineCount: number;
}> => {

  await DBconnection()

  const rcon = await getRcon();

  try {
    const listRaw = await rcon.send("scoreboard players list");
    const usernames =
      listRaw
        .split(":")[1]
        ?.split(",")
        .map((n) => n.trim())
        .filter(Boolean) || [];

    const onlineRaw = await rcon.send("list");
    const onlinePlayers =
      onlineRaw
        .split(":")[1]
        ?.split(",")
        .map((p) => p.trim())
        .filter(Boolean) || [];

    const leaderboard = await Promise.all(
      usernames.map(async (username) => {
        const isOnline = onlinePlayers.includes(username);
        const playTimeRaw = await rcon.send(
          `scoreboard players get ${username} playtime`,
        );
        const playTimeInSec = parsePlayTime(playTimeRaw);

        const player = await upsertPlayer(username, isOnline, playTimeInSec);
        const rank = getRank(player.playTime.hours);
        return { ...player, rank };
      }),
    );

    const onlineCount = leaderboard.filter((p) => p.is_online).length;
    const sortedLeaderboard = leaderboard.sort(
      (a, b) => b.playTime.hours - a.playTime.hours,
    );

    return { sortedLeaderboard, onlineCount };
  } catch (error) {
    console.error("RCON connection failed:", error);
    return { sortedLeaderboard: [], onlineCount: 0 };
  }
};
