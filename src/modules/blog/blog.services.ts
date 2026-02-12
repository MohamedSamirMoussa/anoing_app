import { NextFunction, Request, Response } from "express";
import { BlogRepository } from "../../DB/DBrepository/blog.repository";
import { BlogModel } from "../../DB/models/blog.model";
import { BadRequestError, ConflictError, successHandler } from "../../utils";
import {
  deleteFileInCloudinary,
  uploadFileInCloudinary,
} from "../../utils/multer/cloudinary";
import { Types } from "mongoose";

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

      const populatedBlog = await this.blogModel.findById({
        id: blog._id,
        populate: [{ path: "userId", select: "username email" }],
      });

      return successHandler({
        res,
        message: "Blog Posted Successfully",
        result: { populatedBlog },
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
      const result = await this.blogModel.find({
        filter: {},
        populate: [{ path: "userId", select: "username email" }],
      });
      return successHandler({ res, result });
    } catch (error) {
      next(error);
    }
  };

  deleteBlog = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<Response | void> => {
    try {
      const { id } = req.params;
      const userId = req.user?._id;

      const blog = await this.blogModel.findOne({
        filter: { _id: id, userId },
      });

      if (!blog) {
        throw new BadRequestError(
          "Blog not found or you don't have permission",
        );
      }
      const public_id = blog.image?.public_id;

      if (public_id) {
        await deleteFileInCloudinary(public_id as string);
      }

      await this.blogModel.findByIdAndDelete({
        id: blog._id as unknown as Types.ObjectId,
      });

      return successHandler({ res, message: "Blog deleted successfully" });
    } catch (error: any) {
      return next(error as any);
    }
  };
}

export default new BlogServices();
