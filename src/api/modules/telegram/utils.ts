export const isAuthorizedTelegramWebhook = (
  env: Env,
  webhookSecret: string,
): boolean => {
  const expected = env.TELEGRAM_WEBHOOK_SECRET;
  if (!expected) {
    return false;
  }

  return timingSafeEqual(webhookSecret, expected);
};

const timingSafeEqual = (actual: string, expected: string): boolean => {
  const encoder = new TextEncoder();
  const actualBytes = encoder.encode(actual);
  const expectedBytes = encoder.encode(expected);

  if (actualBytes.length !== expectedBytes.length) {
    return false;
  }

  let diff = 0;
  for (let index = 0; index < expectedBytes.length; index += 1) {
    diff |= actualBytes[index] ^ expectedBytes[index];
  }
  return diff === 0;
};
