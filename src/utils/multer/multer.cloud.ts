import { Request } from "express";
import multer from "multer";
import os from "node:os"
import {v4 as uuid} from 'uuid'
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

  return multer({ storage });
};
