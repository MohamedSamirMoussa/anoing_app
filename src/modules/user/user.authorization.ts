import { RoleEnum } from "../../DB";

export const endpoint = {
  logout: [RoleEnum.admin, RoleEnum.super],
  allUsers: [RoleEnum.admin, RoleEnum.super],
  theme:[RoleEnum.super],
  token:[RoleEnum.admin , RoleEnum.super],
};
