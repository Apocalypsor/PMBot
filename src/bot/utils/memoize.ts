export const memoizeAsync = <TArgs extends unknown[], TReturn>(
  fn: (...args: TArgs) => Promise<TReturn>,
): ((...args: TArgs) => Promise<TReturn>) => {
  let cached: Promise<TReturn> | null = null;
  return (...args: TArgs): Promise<TReturn> => {
    if (cached) return cached;
    cached = fn(...args).catch((error) => {
      cached = null;
      throw error;
    });
    return cached;
  };
};
