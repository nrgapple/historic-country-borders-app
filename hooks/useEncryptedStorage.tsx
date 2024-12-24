// useEncryptedStorage.ts
import CryptoJS from 'crypto-js';

interface UseEncryptedStorageOptions {
  key: string;
  debugMode?: boolean;
}

export function useEncryptedStorage({
  key,
  debugMode = false,
}: UseEncryptedStorageOptions) {
  const encrypt = (data: any) => {
    return debugMode
      ? JSON.stringify(data)
      : CryptoJS.AES.encrypt(JSON.stringify(data), key).toString();
  };

  const decrypt = (encryptedData: string) => {
    if (debugMode) return JSON.parse(encryptedData);

    try {
      const bytes = CryptoJS.AES.decrypt(encryptedData, key);
      return JSON.parse(bytes.toString(CryptoJS.enc.Utf8));
    } catch {
      return null;
    }
  };

  const save = (storageKey: string, data: any) => {
    const encryptedData = encrypt(data);
    localStorage.setItem(storageKey, encryptedData);
  };

  const load = (storageKey: string) => {
    const encryptedData = localStorage.getItem(storageKey);
    return encryptedData ? decrypt(encryptedData) : null;
  };

  return { save, load };
}
