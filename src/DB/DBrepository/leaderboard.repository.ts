import { Model } from "mongoose";
import { DBrepository } from "./db.repository";
import { ILeaderboardUser } from "../models/leaderboard.model";

export class LeaderboardRepository extends DBrepository<ILeaderboardUser> {
  constructor(protected override readonly model: Model<ILeaderboardUser>) {
    super(model);
  }
}
