import { getDynamicBannedKeywords, saveDynamicBannedKeywords } from "@/db/kv";

export const normalizeKeyword = (value: string): string => {
  return value.trim().replace(/\s+/g, " ");
};

export const splitKeywords = (value: string): string[] => {
  return uniqueKeywords(value.split(/[,\n]/).map(normalizeKeyword));
};

export const uniqueKeywords = (words: string[]): string[] => {
  return [...new Set(words.map(normalizeKeyword).filter(Boolean))].sort(
    (a, b) => a.localeCompare(b),
  );
};

export const getAllBannedKeywords = async (env: Env): Promise<string[]> => {
  const envWords = splitKeywords(env.BANNED_KEYWORDS);
  const dynamicWords = await getDynamicBannedKeywords(env);
  return uniqueKeywords([...envWords, ...dynamicWords]);
};

export const findBlockedKeyword = async (
  env: Env,
  text: string,
): Promise<string | null> => {
  if (!text) {
    return null;
  }

  const lowerText = text.toLowerCase();
  const words = await getAllBannedKeywords(env);
  return words.find((word) => lowerText.includes(word.toLowerCase())) ?? null;
};

export const addDynamicBannedKeyword = async (
  env: Env,
  keyword: string,
): Promise<void> => {
  const words = await getDynamicBannedKeywords(env);
  if (!words.includes(keyword)) {
    words.push(keyword);
    await saveDynamicBannedKeywords(env, words);
  }
};

export const removeDynamicBannedKeyword = async (
  env: Env,
  keyword: string,
): Promise<void> => {
  const words = await getDynamicBannedKeywords(env);
  await saveDynamicBannedKeywords(
    env,
    words.filter((word) => word !== keyword),
  );
};
