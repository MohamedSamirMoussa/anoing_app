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
  AllTheMons: {
    host: process.env.RCON_HOST as string,
    port: Number(process.env.RCON_PORT_ALL_THE_MOON),
    password: process.env.RCON_PASS as string,
    timeout: Number(process.env.RCON_TIMEOUT),
  },
};

const activeConnections: Record<string, Rcon | null> = {};
const connectingFlags: Record<string, boolean> = {};

// Function to get or create a RCON connection
export const getRcon = async (serverName: string): Promise<Rcon> => {
  const RCONconfig = serverConfigs[serverName];  

  if (!RCONconfig) throw new Error(`Server ${serverName} config not found!`);

  // Already connected
  if (activeConnections[serverName]?.authenticated) {
    return activeConnections[serverName]!;
  }

  // If another call is connecting, wait 1s and retry
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
      console.log(`RCON for ${serverName} disconnected`);
      activeConnections[serverName] = null;
      // محاولة إعادة الاتصال بعد 5 ثواني
      setTimeout(() => getRcon(serverName), 5000);
    });

    rcon.on("error", (err) => {
      console.error(`RCON Error for ${serverName}:`, err);
      activeConnections[serverName] = null;
      // محاولة إعادة الاتصال بعد 5 ثواني
      setTimeout(() => getRcon(serverName), 5000);
    });

    await rcon.connect();
    console.log(`RCON connected to ${serverName} successfully`);

    activeConnections[serverName] = rcon;
    return rcon;
  } finally {
    connectingFlags[serverName] = false;
  }
};
