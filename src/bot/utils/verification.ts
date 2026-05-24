export const createVerificationUrl = (env: Env): string => {
  const baseUrl = env.PUBLIC_BASE_URL.replace(/\/+$/, "");
  return `${baseUrl}/verify`;
};
