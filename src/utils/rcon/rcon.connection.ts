import { Rcon } from "rcon-client";
import { config } from "dotenv";
import { resolve } from "path";

config({ path: resolve("./config/.env.development") });

interface IRCONConfig {
  host: string;
  port: number;
  password: string;
  timeout: number;
}

const serverConfigs: Record<string, IRCONConfig> = {
  "SB4": {
    host: process.env.RCON_HOST!,
    port: Number(process.env.RCON_PORT_SB4),
    password: process.env.RCON_PASS!,
    timeout: Number(process.env.RCON_TIMEOUT || 5000),
  },
};

const activeConnections: Record<string, Rcon | null> = {};
const connectingFlags: Record<string, boolean> = {};

export const getRcon = async (serverName: string): Promise<Rcon> => {
  const RCONconfig = serverConfigs[serverName];
  if (!RCONconfig) throw new Error(`Server ${serverName} config not found!`);

  if (activeConnections[serverName]?.authenticated) {
    return activeConnections[serverName]!;
  }

  if (connectingFlags[serverName]) {
    await new Promise((res) => setTimeout(res, 1000));
    return getRcon(serverName);
  }

  connectingFlags[serverName] = true;

  try {
    const rcon = new Rcon({
      host: RCONconfig.host,
      port: RCONconfig.port,
      password: RCONconfig.password,
      timeout: RCONconfig.timeout,
    });

    rcon.on("end", () => {
      console.log(`[RCON] ${serverName} disconnected`);
      activeConnections[serverName] = null;
    });

    rcon.on("error", (err) => {
      console.error(`[RCON] Error for ${serverName}:`, err.message);
      activeConnections[serverName] = null;
    });

    await rcon.connect();
    console.log(`[RCON] Connected to ${serverName} successfully`);
    activeConnections[serverName] = rcon;
    return rcon;
  } finally {
    connectingFlags[serverName] = false;
  }
};