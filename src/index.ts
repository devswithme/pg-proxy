import { Hono } from "hono";
import { logger } from "hono/logger";
import { cors } from "hono/cors";
import { rateLimitMiddleware } from "./middleware/rate";
import { apiKeyMiddleware } from "./middleware/auth";
import xendit from "./lib/xendit";
import { webhookMiddleware } from "./middleware/webhook";

const app = new Hono();

app.use("*", logger());
app.use(
  "*",
  cors({
    origin: process.env.CORS_ORIGIN!,
    allowMethods: ["GET", "POST"],
    allowHeaders: ["Content-Type", "Authorization", "x-api-key"],
  })
);

app.use(
  "/",
  apiKeyMiddleware(),
  rateLimitMiddleware({
    windowMs: 30_000,
    max: 30,
  })
);

app.post("/invoice", async (c) => {
  const body = await c.req.json();

  const data = await xendit.Invoice.createInvoice({
    data: body,
  });

  return c.json(data);
});

app.post("/webhook", webhookMiddleware(), async (c) => {
  const body = await c.req.json();

  let webhookUrl = null;

  if (body.external_id.includes("hack")) {
    webhookUrl = process.env.HACK_WEBHOOK_URL!;
  } else if (body.external_id.includes("event")) {
    webhookUrl = process.env.LENS_WEBHOOK_URL!;
  }

  const res = await fetch(webhookUrl!, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Callback-Token": process.env.XENDIT_WEBHOOK_TOKEN!,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    return c.json({ error: "Failed to forward webhook to client" }, 502);
  }

  return c.json({ success: true });
});

export default {
  port: process.env.PORT || 3003,
  fetch: app.fetch,
};
