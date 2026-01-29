import { JwtPayload } from "jsonwebtoken";
import { HUserDoc } from "../../DB";


declare module "express-serve-static-core" {
  interface Request {
    user?: HUserDoc;
    decode?: JwtPayload;
  }
}
