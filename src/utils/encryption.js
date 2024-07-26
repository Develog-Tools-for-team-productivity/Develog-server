import CryptoJS from 'crypto-js';

export const encryptToken = token => {
  return CryptoJS.AES.encrypt(token, process.env.JWT_SECRET).toString();
};

export const decryptToken = encryptedToken => {
  const bytes = CryptoJS.AES.decrypt(encryptedToken, process.env.JWT_SECRET);
  return bytes.toString(CryptoJS.enc.Utf8);
};
