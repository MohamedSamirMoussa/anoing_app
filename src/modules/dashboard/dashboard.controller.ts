import { Router } from "express";
import dashboardServices from './dashboard.services'

export const  router:Router = Router()


router.get("/" , dashboardServices.getSingleComponents)
router.get("/:section" , dashboardServices.getSingleComponents)
router.put("/:section" , dashboardServices.updateOnComponents)