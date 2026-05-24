export const reportError = async (
  env: Env,
  event: string,
  error: unknown,
  context: Record<string, unknown> = {},
): Promise<void> => {
  console.error({
    level: "error",
    event,
    worker_name: env.WORKER_NAME,
    message: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined,
    ...context,
  });
};
