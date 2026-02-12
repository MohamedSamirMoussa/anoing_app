import { Request } from "express";
import multer from "multer";
import os from "node:os"
import {v4 as uuid} from 'uuid'
import { BadRequestError } from "../errors/errors";
export enum StorageEnum {
    memory="memory",
    disk="disk"
}


export const cloudFileUpload = ({storageApproach = StorageEnum.memory}:{storageApproach?:StorageEnum}): multer.Multer => {
  const storage = storageApproach === StorageEnum.memory ? multer.memoryStorage() : multer.diskStorage({
    destination: os.tmpdir(),
    filename: function(req:Request , file:Express.Multer.File , cb) {
        cb(null , `${uuid()}_${file.originalname}`)
    }
  });

  const fileFilter = (req:Request , file:Express.Multer.File , cb:multer.FileFilterCallback)=>{
    if(file.mimetype.startsWith("image/")) {
      cb(null , true)
    } else {
      cb(new BadRequestError("Only images are allowed") as any , false)
    }
  }

  return multer({ storage , fileFilter , limits:{
    fileSize: 5 * 1024 * 1024
  } });
};
