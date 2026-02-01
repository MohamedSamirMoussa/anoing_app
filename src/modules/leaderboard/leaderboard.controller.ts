import { Router } from "express";
import  leaderboardServices from './leaderboard.services'
export const router:Router = Router({
    strict:true,
    caseSensitive:true,
    mergeParams:true
})



router.get('/' , leaderboardServices.getLeaderBoard)
// router.get('/search' , leaderboardServices.searchPlayers)




