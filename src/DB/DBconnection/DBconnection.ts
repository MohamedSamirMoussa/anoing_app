import { connect ,connection } from "mongoose";

export const DBconnection = async () => {
  try {

    if (connection.readyState >= 1) return;

    if (!process.env.DB_HOST) {
      throw new Error("DB_HOST is missing in environment variables!");
    }

    await connect(process.env.DB_HOST as string, {
      serverSelectionTimeoutMS: 30000,
    });
    console.log("DB connected successfully");
  } catch (error) {
    console.error("DB connection failed : ", error);
  }
};
