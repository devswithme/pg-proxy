import { MiddlewareHandler } from "hono";

export const webhookMiddleware = (): MiddlewareHandler => {
  return async (c, next) => {
    const callbackToken = c.req.header("x-callback-token");

    if (!callbackToken || callbackToken !== process.env.XENDIT_WEBHOOK_TOKEN) {
      return c.json({ error: "Unauthorized: invalid callback token" }, 401);
    }

    await next();
  };
};
