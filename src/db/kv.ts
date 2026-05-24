import {
  BANNED_USER_PREFIX,
  BOT_COMMANDS_VERSION_KEY,
  BOT_INFO_KEY,
  BOT_INFO_TTL_SECONDS,
  DYNAMIC_BAN_WORDS_KEY,
  VERIFIED_USER_PREFIX,
} from "@/constants";
import { hasVerifiedUserState, putVerifiedUserState } from "@/db/state";
import type { VerifiedUserRecord } from "@/types";

export const verifyUser = async (env: Env, userId: number): Promise<void> => {
  const verified: VerifiedUserRecord = {
    userId,
    verifiedAt: new Date().toISOString(),
  };
  const key = verifiedUserKey(userId);

  await Promise.all([
    env.PMBOT_KV.put(key, JSON.stringify(verified)),
    putVerifiedUserState(env, key, verified),
  ]);
};

export const isUserVerified = async (
  env: Env,
  userId: number,
): Promise<boolean> => {
  const key = verifiedUserKey(userId);
  if ((await env.PMBOT_KV.get(key)) !== null) return true;

  return hasVerifiedUserState(env, key);
};

export const isUserBanned = async (
  env: Env,
  userId: number,
): Promise<boolean> => {
  return (await env.PMBOT_KV.get(bannedUserKey(userId))) !== null;
};

export const banUser = async (env: Env, userId: number): Promise<void> => {
  await env.PMBOT_KV.put(bannedUserKey(userId), "1");
};

export const unbanUser = async (env: Env, userId: number): Promise<void> => {
  await env.PMBOT_KV.delete(bannedUserKey(userId));
};

export const getDynamicBannedKeywords = async (env: Env): Promise<string[]> => {
  const words = await env.PMBOT_KV.get<string[]>(DYNAMIC_BAN_WORDS_KEY, "json");
  return Array.isArray(words) ? uniqueKeywords(words) : [];
};

export const saveDynamicBannedKeywords = async (
  env: Env,
  words: string[],
): Promise<void> => {
  await env.PMBOT_KV.put(
    DYNAMIC_BAN_WORDS_KEY,
    JSON.stringify(uniqueKeywords(words)),
  );
};

export const getCachedBotInfo = async (env: Env): Promise<string | null> => {
  return env.PMBOT_KV.get(BOT_INFO_KEY);
};

export const putCachedBotInfo = async (
  env: Env,
  botInfo: string,
): Promise<void> => {
  await env.PMBOT_KV.put(BOT_INFO_KEY, botInfo, {
    expirationTtl: BOT_INFO_TTL_SECONDS,
  });
};

export const getBotCommandsVersion = async (
  env: Env,
): Promise<string | null> => {
  return env.PMBOT_KV.get(BOT_COMMANDS_VERSION_KEY);
};

export const putBotCommandsVersion = async (
  env: Env,
  version: string,
): Promise<void> => {
  await env.PMBOT_KV.put(BOT_COMMANDS_VERSION_KEY, version);
};

const verifiedUserKey = (userId: number): string => {
  return `${VERIFIED_USER_PREFIX}${userId}`;
};

const bannedUserKey = (userId: number): string => {
  return `${BANNED_USER_PREFIX}${userId}`;
};

const normalizeKeyword = (value: string): string => {
  return value.trim().replace(/\s+/g, " ");
};

const uniqueKeywords = (words: string[]): string[] => {
  return [...new Set(words.map(normalizeKeyword).filter(Boolean))].sort(
    (a, b) => a.localeCompare(b),
  );
};
