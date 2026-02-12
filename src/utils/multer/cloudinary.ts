import { v2 as cloudinary } from "cloudinary";
import { BadRequestError } from "../errors/errors";

export const cloud = () => {
  cloudinary.config({
    cloud_name: process.env.CLOUD_NAME as string,
    api_key: process.env.API_KEY as string,
    api_secret: process.env.API_SECRET as string,
    secure: true,
  });

  return cloudinary;
};

export const uploadFileInCloudinary = async ({
  file = {},
  path = "general",
}: {
  file: any;
  path: string;
}) => {
  return await cloud().uploader.upload(file.path, {
    folder: `${process.env.APP_NAME}/user/${path}`,
  });
};

export const deleteFileInCloudinary = async (publicId:string)=>{
  try {
    const result = await cloud().uploader.destroy(publicId)

    return result
  } catch (error) {
    console.log(error);
    
    throw new BadRequestError("Failed to delete image" , {cause:{error}})
  }
}
