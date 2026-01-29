import { Router } from "express";
import blogServices from "./blog.services";
import { authentication } from "../../middleware";
import { cloudFileUpload, StorageEnum } from "../../utils";
export const router = Router({
  caseSensitive: true,
  mergeParams: true,
  strict: true,
});

router.post(
  "/create-blog",
  authentication(),
  cloudFileUpload({ storageApproach: StorageEnum.disk }).single("image"),
  blogServices.createBlog,
);
router.get("/", authentication(), blogServices.getBlogs);
