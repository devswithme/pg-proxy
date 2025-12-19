import { MiddlewareHandler } from "hono";

type RateLimitOptions = {
  windowMs: number;
  max: number;
};

const rateLimitStore = new Map<string, { count: number; expires: number }>();

export const rateLimitMiddleware = (
  options: RateLimitOptions
): MiddlewareHandler => {
  const { windowMs, max } = options;

  return async (c, next) => {
    const ip =
      c.req.header("cf-connecting-ip") ||
      c.req.header("x-forwarded-for") ||
      "unknown";

    const now = Date.now();
    const key = `${ip}:${Math.floor(now / windowMs)}`;

    const record = rateLimitStore.get(key);

    if (!record) {
      rateLimitStore.set(key, {
        count: 1,
        expires: now + windowMs,
      });
    } else {
      if (record.count >= max) {
        return c.json({ error: "Too many requests" }, 429);
      }
      record.count++;
    }

    if (rateLimitStore.size > 10_000) {
      for (const [k, v] of rateLimitStore) {
        if (v.expires < now) rateLimitStore.delete(k);
      }
    }

    await next();
  };
};
