import { HydratedDocument } from "mongoose";
import { model, models, Schema } from "mongoose";
export interface ILeaderboardUser {
  serverName: string;
  online_count: number;
  username: string;
  is_online: boolean;
  playTime: {
    seconds: number;
    minutes: number;
    hours: number;
  };
  totalPlayTime: {
    seconds: number;
    minutes: number;
    hours: number;
  };
  lastSeen: Date;
  avatar?: string;
  rank: {
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
      seconds: { type: Number, required: true },
      minutes: { type: Number, required: true },
      hours: { type: Number, required: true },
    },
    lastSeen: { type: Date, required: false, default: null },
    avatar: { type: String, required: false },
    rank: {
      name: { type: String, required: true },
    },

    joinTime: { type: Date, required: false, default: null },
    totalPlayTime: {
      seconds: { type: Number, default: 0 },
      minutes: { type: Number, default: 0 },
      hours: { type: Number, default: 0 },
    },
  },
  {
    timestamps: true,
  },
);
schema.index({ "playTime.seconds": -1 });

export const LeaderboardModel =
  models.Leaderboard || model<ILeaderboardUser>("Leaderboard", schema);
export type HLeaderboardDoc = HydratedDocument<ILeaderboardUser>;
