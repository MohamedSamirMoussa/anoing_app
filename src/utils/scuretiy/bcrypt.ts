import CryptoJS from "crypto-js";

export const encryption = (text: string | CryptoJS.lib.WordArray): string => {
  return CryptoJS.AES.encrypt(
    text,
    process.env.SECRET_KEY as string
  ).toString();
};

export const decryption = (
  cipherText: CryptoJS.lib.CipherParams | string
): string => {
  return CryptoJS.AES.decrypt(
    cipherText,
    process.env.SECRET_KEY as string
  ).toString(CryptoJS.enc.Utf8);
};
