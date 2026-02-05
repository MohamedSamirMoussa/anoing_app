import { HydratedDocument } from "mongoose";
import { model, models, Schema } from "mongoose";
export interface ILeaderboardUser {
  serverName: string;
  online_count?: number;
  username: string;
  is_online: boolean;
  playTime?: {
    seconds: number;
    minutes: number;
    hours: number;
  };
  lastSeen: Date;
  avatar: string;
  rank: {
    name: string;
  };
  isSupported?: {
    name: string;
  };
  joinTime: Date;
}

const schema = new Schema<ILeaderboardUser>(
  {
    serverName: { type: String, required: true },
    online_count: Number,
    username: { type: String },
    is_online: { type: Boolean, required: true },
    playTime: {
      seconds: { type: Number },
      minutes: { type: Number },
      hours: { type: Number },
    },
    lastSeen: { type: Date, required: false, default: null },
    avatar: { type: String },
    rank: {
      name: { type: String, required: true },
    },
    isSupported: {
      name: { type: String, required: false },
    },
    joinTime: { type: Date, required: false, default: null },
  },
  {
    timestamps: true,
  },
);

schema.index({ "playTime.seconds": -1 });

export const LeaderboardModel =
  models.Leaderboard || model<ILeaderboardUser>("Leaderboard", schema);
export type HLeaderboardDoc = HydratedDocument<ILeaderboardUser>;
