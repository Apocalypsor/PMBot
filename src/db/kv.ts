import {
  ADMIN_MAPPING_TTL_SECONDS,
  ADMIN_MESSAGE_PREFIX,
  BANNED_USER_PREFIX,
  BOT_COMMANDS_VERSION_KEY,
  BOT_INFO_KEY,
  BOT_INFO_TTL_SECONDS,
  DYNAMIC_BAN_WORDS_KEY,
  VERIFIED_USER_PREFIX,
  VERIFY_TOKEN_PREFIX,
  VERIFY_TOKEN_TTL_SECONDS,
} from "@/constants";
import type {
  AdminMessageMapping,
  VerifiedUserRecord,
  VerifyTokenRecord,
} from "@/types";

export const putVerifyTokenRecord = async (
  env: Env,
  token: string,
  record: VerifyTokenRecord,
): Promise<void> => {
  await env.PMBOT_KV.put(verifyTokenKey(token), JSON.stringify(record), {
    expirationTtl: VERIFY_TOKEN_TTL_SECONDS,
  });
};

export const getVerifyTokenRecord = async (
  env: Env,
  token: string,
): Promise<VerifyTokenRecord | null> => {
  return env.PMBOT_KV.get<VerifyTokenRecord>(verifyTokenKey(token), "json");
};

export const completeVerification = async (
  env: Env,
  token: string,
  record: VerifyTokenRecord,
): Promise<void> => {
  const verified: VerifiedUserRecord = {
    userId: record.userId,
    chatId: record.chatId,
    verifiedAt: new Date().toISOString(),
  };

  await env.PMBOT_KV.put(
    verifiedUserKey(record.userId),
    JSON.stringify(verified),
  );
  await env.PMBOT_KV.delete(verifyTokenKey(token));
};

export const isUserVerified = async (
  env: Env,
  userId: number,
): Promise<boolean> => {
  return (await env.PMBOT_KV.get(verifiedUserKey(userId))) !== null;
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

export const getAdminMapping = async (
  env: Env,
  adminChatId: string,
  messageId: number,
): Promise<AdminMessageMapping | null> => {
  return env.PMBOT_KV.get<AdminMessageMapping>(
    adminMessageKey(adminChatId, messageId),
    "json",
  );
};

export const putAdminMapping = async (
  env: Env,
  adminChatId: string,
  messageId: number,
  mapping: AdminMessageMapping,
): Promise<void> => {
  await env.PMBOT_KV.put(
    adminMessageKey(adminChatId, messageId),
    JSON.stringify(mapping),
    { expirationTtl: ADMIN_MAPPING_TTL_SECONDS },
  );
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

const verifyTokenKey = (token: string): string => {
  return `${VERIFY_TOKEN_PREFIX}${token}`;
};

const verifiedUserKey = (userId: number): string => {
  return `${VERIFIED_USER_PREFIX}${userId}`;
};

const bannedUserKey = (userId: number): string => {
  return `${BANNED_USER_PREFIX}${userId}`;
};

const adminMessageKey = (adminChatId: string, messageId: number): string => {
  return `${ADMIN_MESSAGE_PREFIX}${adminChatId}:${messageId}`;
};

const normalizeKeyword = (value: string): string => {
  return value.trim().replace(/\s+/g, " ");
};

const uniqueKeywords = (words: string[]): string[] => {
  return [...new Set(words.map(normalizeKeyword).filter(Boolean))].sort(
    (a, b) => a.localeCompare(b),
  );
};
