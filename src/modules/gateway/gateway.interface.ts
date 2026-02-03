import { Socket } from "socket.io"
import { HUserDoc } from "../../DB"
import { JwtPayload } from "jsonwebtoken"

export interface IAuthSocket extends Socket {
    credentials?:{
        user:Partial<HUserDoc>
        decode:JwtPayload
    }
}