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
  "atm 10": {
    host: process.env.RCON_HOST as string,
    port: Number(process.env.RCON_PORT_ATM),
    password: process.env.RCON_PASS as string,
    timeout:Number(process.env.RCON_TIMEOUT)
  },
  // "GTNH": {
  //   host: process.env.RCON_HOST as string,
  //   port: Number(process.env.RCON_PORT_GTNH),
  //   password: process.env.RCON_PASS as string,
  // },
  // "Vanilla": {
  //   host: process.env.RCON_HOST as string,
  //   port: Number(process.env.RCON_PORT_VANILLA),
  //   password: process.env.RCON_PASS as string,
  // },
};

const activeConnections: Record<string, Rcon | null> = {};
const connectingFlags: Record<string, boolean> = {};




export const getRcon = async (serverName:string): Promise<Rcon> => {
  const RCONconfig =serverConfigs[serverName]

if (!RCONconfig) {
    throw new Error(`Server ${serverName} config not found!`);
  }

  if (activeConnections[serverName] && activeConnections[serverName]?.authenticated) {
    return activeConnections[serverName]!;
  }
  if (connectingFlags[serverName]) {
    await new Promise((resolve) => setTimeout(resolve, 1000));
    return getRcon(serverName);
  }

  connectingFlags[serverName] = true;

  try {
    const rcon = new Rcon({
        host: RCONconfig.host,
        port: RCONconfig.port,
        password: RCONconfig.password,
    });

    rcon.on("end", () => { 
        activeConnections[serverName] = null; 
        console.log(`RCON for ${serverName} disconnected`); 
    });
    
    rcon.on("error", (err) => { 
        activeConnections[serverName] = null; 
        console.error(`RCON Error for ${serverName}:`, err); 
    });

    await rcon.connect();
    console.log(`RCON connected to ${serverName} successfully`);
    
    activeConnections[serverName] = rcon;
    return rcon;
  } finally {
    connectingFlags[serverName] = false;
  }
};
