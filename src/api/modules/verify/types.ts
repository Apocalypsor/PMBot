export interface VerifyHtmlResult {
  status: number;
  html: string;
}

export interface TurnstileSiteVerifyResponse {
  success: boolean;
  "error-codes"?: string[];
}

export interface TelegramMiniAppUser {
  id: number;
  first_name?: string;
  last_name?: string;
  username?: string;
  language_code?: string;
}
