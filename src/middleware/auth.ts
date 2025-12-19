import { MiddlewareHandler } from "hono";

export const apiKeyMiddleware = (): MiddlewareHandler => {
  return async (c, next) => {
    const apiKey = c.req.header("x-api-key");

    if (!apiKey || apiKey !== process.env.API_KEY) {
      return c.json({ error: "Unauthorized: invalid API key" }, 401);
    }

    await next();
  };
};
