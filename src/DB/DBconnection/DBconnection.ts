import { connect } from "mongoose";

export const DBconnection = async () => {
  try {
    if (!process.env.DB_HOST) throw new Error("DB_HOST is not defined");

    await connect(process.env.DB_HOST as string, {
      serverSelectionTimeoutMS: 30000,
      family: 4,
      socketTimeoutMS: 30000,
      connectTimeoutMS: 30000,
    });
    console.log("DB connected successfully");
  } catch (error) {
    console.error("DB connection failed : ", error);
  }
};
