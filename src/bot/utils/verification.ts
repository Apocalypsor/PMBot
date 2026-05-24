import type { Message } from "grammy/types";
import { putVerifyTokenRecord } from "@/db/kv";

export const createVerificationUrl = async (
  env: Env,
  userId: number,
  message: Message,
): Promise<string> => {
  const token = crypto.randomUUID();
  await putVerifyTokenRecord(env, token, {
    userId,
    chatId: String(message.chat.id),
    createdAt: new Date().toISOString(),
  });

  const baseUrl = env.PUBLIC_BASE_URL.replace(/\/+$/, "");
  return `${baseUrl}/verify?token=${encodeURIComponent(token)}`;
};
