import { DBconnection, ILeaderboardUser, LeaderboardModel } from "../../DB";
import { getRcon } from "./rcon.connection";

// دالة تنظيف النص واستخراج أرقام الساعات/الثواني
const parsePlayTime = (raw: string): number => {
  const match = raw.match(/(\d+)/);
  return match ? parseInt(match[1] as string, 10) : 0;
};

// دالة الرتب بناءً على الساعات
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

const upsertPlayer = async (
  username: string,
  isOnline: boolean,
  playTimeInSec: number,
  serverName: string,
): Promise<ILeaderboardUser> => {
  const playTime = {
    seconds: playTimeInSec,
    minutes: Math.floor(playTimeInSec / 60),
    hours: Math.floor(playTimeInSec / 3600),
  };

  const rank = getRank(playTime.hours);
  
  // البحث عن اللاعب الحالي في الداتا بيز
  let dbPlayer = await LeaderboardModel.findOne({
    username,
    serverName,
  });

  if (!dbPlayer) {
    // لو لاعب جديد تماماً
    dbPlayer = new LeaderboardModel({
      username,
      serverName,
      is_online: isOnline,
      playTime,
      lastSeen: isOnline ? null : new Date(),
      rank,
      avatar: `https://mc-heads.net/avatar/${username}/64`,
    });
  } else {
    // 🔥 الحل هنا: التحديث يتم فقط إذا تغيرت الحالة من Online لـ Offline
    // ده بيمنع إن كل الناس تاخد نفس التوقيت لو السكربت رن والكل أوفلاين
    if (dbPlayer.is_online === true && isOnline === false) {
      dbPlayer.lastSeen = new Date();
    } else if (isOnline === true) {
      dbPlayer.lastSeen = null; // تصفير الوقت لو رجع أونلاين
    }

    dbPlayer.is_online = isOnline;
    dbPlayer.playTime = playTime;
    dbPlayer.rank = rank;
  }

  await dbPlayer.save();

  return {
    serverName,
    username,
    avatar: dbPlayer.avatar || `https://mc-heads.net/avatar/${username}/64`,
    is_online: isOnline,
    playTime,
    lastSeen: dbPlayer.lastSeen,
    rank,
    online_count: isOnline ? 1 : 0,
  } as any;
};

export const getConnectionWithServer = async (
  serverName: string,
): Promise<{
  sortedLeaderboard: ILeaderboardUser[];
  onlineCount: number;
}> => {
  await DBconnection();

  const rcon = await getRcon(serverName);

  try {
    // جلب كل اللاعبين المسجلين في السكوربورد
    const listRaw = await rcon.send("scoreboard players list");
    const usernames =
      listRaw
        .split(":")[1]
        ?.split(",")
        .map((n) => n.trim())
        .filter(Boolean) || [];

    // جلب قائمة اللاعبين المتصلين حالياً فقط
    const onlineRaw = await rcon.send("list");
    const onlinePlayers =
      onlineRaw
        .split(":")[1]
        ?.split(",")
        .map((p) => p.trim())
        .filter(Boolean) || [];

    // تنفيذ الـ Upsert لكل لاعب بشكل متوازي (Parallel)
    const leaderboard = await Promise.all(
      usernames.map(async (username) => {
        const isOnline = onlinePlayers.includes(username);
        const playTimeRaw = await rcon.send(
          `scoreboard players get ${username} playtime`,
        );
        const playTimeInSec = parsePlayTime(playTimeRaw);

        const player = await upsertPlayer(
          username,
          isOnline,
          playTimeInSec,
          serverName,
        );
        
        return player;
      }),
    );

    const onlineCount = leaderboard.filter((p) => p.is_online).length;
    
    // الترتيب بناءً على الساعات (الأكثر لعباً في الأول)
    const sortedLeaderboard = leaderboard.sort(
      (a, b) => b.playTime.hours - a.playTime.hours,
    );

    return { sortedLeaderboard, onlineCount };
  } catch (error) {
    console.error(`RCON connection failed for ${serverName}:`, error);
    // لو الـ RCON فشل بنرجع مصفوفة فاضية عشان الموقع ما يقعش
    return { sortedLeaderboard: [], onlineCount: 0 };
  }
};