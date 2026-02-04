import { NextFunction, Request, Response } from "express";
import { ComponentModel, DashboardRepository } from "../../DB";
import { BadRequestError, successHandler } from "../../utils";

class DashboardServices {
  private dashboardModel = new DashboardRepository(ComponentModel);
  constructor() {}

  getAllComponents = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const components = await this.dashboardModel.find({ filter: {} });
      return successHandler({ res, result: { components } });
    } catch (error) {
      return next(error);
    }
  };

  getSingleComponents = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const section = req.params.section;
      const component = await this.dashboardModel.findOne({
        filter: { section },
      });
      if (!component) throw new BadRequestError("Not found");
      return successHandler({ res, result: component });
    } catch (error) {
      return next(error);
    }
  };

  updateOnComponents = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const { title, description } = req.body;
      const { section } = req.params;
      const component = await this.dashboardModel.findOneAndUpdate({
        filter: { section },
        update: { title, description, updatedAt: new Date() },
        options: { new: true, upsert: true },
      });

      return successHandler({ res, result: { component } });
    } catch (error) {
      return next(error);
    }
  };
}

export default new DashboardServices();
