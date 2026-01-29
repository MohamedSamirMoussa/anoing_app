import { compare, hash } from "bcryptjs";

export const hashed = (
  planText: string,
  salt: number = Number(process.env.SALT)
): Promise<string> => {
  return hash(planText, salt);
};

export const compareHash = (
  cypherText: string,
  plainText: string
): Promise<boolean> => {
  return compare(cypherText, plainText);
};
