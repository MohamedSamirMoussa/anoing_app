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

const RCONconfig: IRCONConfig = {
  host: process.env.RCON_HOST as string,
  port: Number(process.env.RCON_PORT),
  password: process.env.RCON_PASS as string,
  timeout: Number(process.env.RCON_TIMEOUT),
};

let rcon: Rcon | null = null;
let isConnecting = false; // 🔴 CHANGED: Flag لمنع multiple connections

export const getRcon = async (): Promise<Rcon> => {
  if (rcon && rcon.authenticated) return rcon;

  // 🔴 CHANGED: لو في محاولة اتصال شغالة، انتظر شويه
  if (isConnecting) {
    await new Promise((resolve) => setTimeout(resolve, 1000));
    return getRcon();
  }

  isConnecting = true;

  try {
    rcon = new Rcon(RCONconfig);
    rcon.on("end", () => { rcon = null; console.log("RCON disconnected"); });
    rcon.on("error", (err) => { rcon = null; console.error("RCON Error:", err); });
    
    await rcon.connect();
    console.log("RCON connected successfully");
    return rcon;
  } finally {
    isConnecting = false;
  }
};
