export type Env = Cloudflare.Env;

export interface AdminMessageMapping {
  userChatId: string;
  userId: number;
  sourceMessageId: number;
  createdAt: string;
}

export interface VerifiedUserRecord {
  userId: number;
  verifiedAt: string;
}
