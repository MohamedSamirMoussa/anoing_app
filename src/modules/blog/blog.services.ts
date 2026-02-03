import { NextFunction, Request, Response } from "express";
import { BlogRepository } from "../../DB/DBrepository/blog.repository";
import { BlogModel } from "../../DB/models/blog.model";
import { BadRequestError, ConflictError, successHandler } from "../../utils";
import { uploadFileInCloudinary } from "../../utils/multer/cloudinary";

class BlogServices {
  private blogModel = new BlogRepository(BlogModel);
  constructor() {}

  createBlog = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<Response | void> => {
    try {
      if (!req.user)
        throw new ConflictError("Not authorized user ... Please login first");

      const { title, description } = req.body;

      if (!req.file) {
        throw new BadRequestError("Please upload an image for the blog");
      }

      const { secure_url, public_id } = await uploadFileInCloudinary({
        file: req.file,
        path: `/${req.user._id}_${req.user?.username}`,
      });

      const [blog] =
        (await this.blogModel.create({
          data: [
            {
              title,
              description,
              userId: req.user._id,
              image: { secure_url, public_id },
            },
          ],
          options: { validateBeforeSave: true },
        })) || [];

      if (!blog)
        throw new BadRequestError("Something went wrong please post again");

      return successHandler({
        res,
        message: "Blog Posted Successfully",
        result: { blog },
      });
    } catch (error) {
      next(error);
    }
  };

  getBlogs = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<Response | void> => {
    try {
      const result = await this.blogModel.find({ filter: {} });

      return successHandler({ res, result });
    } catch (error) {
      next(error);
    }
  };
}

export default new BlogServices();
