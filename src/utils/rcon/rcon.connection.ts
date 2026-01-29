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
    await new Promise((resolve) => setTimeout(resolve, 100));
    return getRcon();
  }

  isConnecting = true;

  rcon = new Rcon(RCONconfig);

  rcon.on("end", async () => {
    console.log("RCON disconnected, will attempt reconnect in 5s...");
    rcon = null;
    isConnecting = false;
    // 🔴 CHANGED: reconnect سيتم من getRcon الجديد عند الاستدعاء
  });

  rcon.on("error", (err) => {
    console.error("RCON error:", err);
    rcon = null;
    isConnecting = false;
  });

  await rcon.connect();
  console.log("RCON connected successfully");

  isConnecting = false;
  return rcon;
};
