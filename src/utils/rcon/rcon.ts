import { DBconnection, ILeaderboardUser, LeaderboardModel } from "../../DB";
import { getRcon } from "./rcon.connection";

/* =======================
   Utils
======================= */
const parsePlayTime = (raw: string | undefined): number => {
  if (!raw) return 0;
  const match = raw.match(/has\s+(\d+)/i);
  return match ? parseInt(match[1] || "", 10) : 0;
};

const ticksToTime = (ticks: number) => {
  const seconds = ticks / 20; // القسمة على 20 علشان نحول للوقت البشري
  return {
    ticks,
    seconds,
    minutes: Math.floor(seconds / 60),
    hours: Math.floor(seconds / 3600),
    days: Math.floor(seconds / 86400),
  };
};

/* =======================
   Upsert Player
======================= */
const upsertPlayer = async (
  username: string,
  isOnline: boolean,
  serverName: string,
  rconPlayTimeSec = 0,
): Promise<ILeaderboardUser> => {
  const filter = { username: username, servername: serverName };
  let dbPlayer = await LeaderboardModel.findOne(filter as any);
  const now = new Date();
  const playTimeParsed = ticksToTime(rconPlayTimeSec);

  if (!dbPlayer) {
    dbPlayer = new LeaderboardModel({
      username,
      serverName,
      is_online: isOnline,
      playTime: playTimeParsed,
      joinTime: isOnline ? now : null,
      lastSeen: isOnline ? null : now,
      rank: getRank(playTimeParsed.hours),
    });
  } else {
    if (dbPlayer.is_online && !isOnline) {
      dbPlayer.lastSeen = now;
      dbPlayer.joinTime = null;
    }

    if (isOnline && !dbPlayer.is_online) {
      dbPlayer.joinTime = now;
      dbPlayer.lastSeen = null;
    }

    dbPlayer.is_online = isOnline;

    if (rconPlayTimeSec >= dbPlayer.playTime.seconds) {
      dbPlayer.playTime = playTimeParsed;
    }

    dbPlayer.rank = getRank(dbPlayer.playTime.hours);
  }

  await dbPlayer.save();

  return {
    serverName,
    username,
    avatar: `https://mc-heads.net/avatar/${username}/64`,
    is_online: isOnline,
    playTime: dbPlayer.playTime,
    totalPlayTime: dbPlayer.playTime,
    lastSeen: dbPlayer.lastSeen,
    rank: dbPlayer.rank,
    online_count: isOnline ? 1 : 0,
    joinTime: dbPlayer.joinTime,
  };
};

/* =======================
   Rank System
======================= */
export const getRank = (hours: number) => {
  if (hours >= 1500) return { name: "Immortal" };
  if (hours >= 700) return { name: "Legend" };
  if (hours >= 350) return { name: "Veteran" };
  if (hours >= 150) return { name: "Trusted" };
  if (hours >= 50) return { name: "Dedicated" };
  if (hours >= 24) return { name: "Regular" };
  if (hours >= 10) return { name: "Newcomer" };
  return { name: "Visitor" };
};

/* =======================
   Main Connection
======================= */
export const getConnectionWithServer = async (
  serverName: string,
): Promise<{ sortedLeaderboard: ILeaderboardUser[]; onlineCount: number }> => {
  await DBconnection();
  const rcon = await getRcon(serverName);

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
        .map((p) => p.trim().replace(/\[\d+\]\s*/, ""))
        .filter(Boolean) || [];

    const onlinePlayersNormalized = onlinePlayers.map((p) => p.toLowerCase());

    const leaderboard = await Promise.all(
      usernames.map(async (username) => {
        const isOnline = onlinePlayersNormalized.includes(
          username.toLowerCase(),
        );

        const playTimeRaw = await rcon.send(
          `scoreboard players get ${username} playtime`,
        );

        const playTimeInSec = parsePlayTime(playTimeRaw as string);

        return upsertPlayer(username, isOnline, serverName, playTimeInSec);
      }),
    );

    const onlineCount = leaderboard.filter((p) => p.is_online).length;

    const sortedLeaderboard = leaderboard.sort(
      (a, b) => b.playTime.seconds - a.playTime.seconds,
    );

    return { sortedLeaderboard, onlineCount };
  } catch (error) {
    console.error(`RCON connection failed for ${serverName}:`, error);
    return { sortedLeaderboard: [], onlineCount: 0 };
  }
};
