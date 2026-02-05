import { Server as HttpServer } from "node:http";
import { Server } from "socket.io";
import { LeaderboardModel } from "../../DB";
import { BadRequestError } from "../../utils";

type ClientData = {
  serverName?: string;
  page: number;
  limit: number;
};

const clientServers = new Map<string, ClientData>();

export const initIO = (httpServer: HttpServer) => {
  const io = new Server(httpServer, {
    cors: {
      // Use the environment variable, fallback to localhost
      origin: process.env.FE_URL || "http://localhost:3000",
      methods: ["GET", "POST"],
      credentials: true,
    },
    transports: ["polling", "websocket"],
    connectTimeout: 45000,
    pingTimeout: 60000,
    pingInterval: 25000,
  });

  /* -------------------- Core Sender -------------------- */
  const sendLeaderboard = async (socketId: string) => {
    const client = clientServers.get(socketId);
    if (!client) return;

    const socket = io.sockets.sockets.get(socketId);
    if (!socket || !socket.connected) return;

    const { serverName, page, limit } = client;
    const skip = (page - 1) * limit;
    try {
      const [leaderboard, totalPlayers, onlineCount] = await Promise.all([
        LeaderboardModel.find({ serverName } as any)
          .sort({ "playTime.seconds": -1, is_online: -1 })
          .skip(skip)
          .limit(limit)
          .lean(),

        LeaderboardModel.countDocuments({ serverName } as any),

        LeaderboardModel.countDocuments({
          serverName,
          is_online: true,
        } as any),
      ]);

      socket.emit("leaderboard_updates", {
        serverName,
        leaderboard,
        pagination: {
          page,
          limit,
          totalPlayers: totalPlayers!,
          totalPages: Math.ceil(totalPlayers! / limit),
        },
        onlineCount,
        totalPlayers,
      });
    } catch (err) {
      console.error("Leaderboard send error:", err);
    }
  };

  /* -------------------- Socket Events -------------------- */
  io.on("connection", (socket) => {
    console.log("🟢 Client connected:", socket.id);

    socket.on(
      "select_server",
      ({
        serverName,
        page,
        limit,
      }: {
        serverName: string;
        page?: number;
        limit?: number;
      }) => {
        clientServers.set(socket.id, {
          serverName: serverName?.toLowerCase().trim() || "",
          page: page!,
          limit: limit!,
        });

        sendLeaderboard(socket.id);
      },
    );

    socket.on("disconnect", () => {
      console.log("🔴 Client disconnected:", socket.id);
      clientServers.delete(socket.id);
    });
  });

  /* -------------------- Global Interval -------------------- */
  setInterval(async () => {
    for (const socketId of clientServers.keys()) {
      await sendLeaderboard(socketId);
    }
  }, 5000);
};
