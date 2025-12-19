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

  const { price, reference_id, hackathon_id, hackathon_title } = body;

  const data = await xendit.Invoice.createInvoice({
    data: {
      amount: price,
      externalId: reference_id,
      successRedirectUrl: `${process.env.NEXT_PUBLIC_APP_URL}/hackathon/${hackathon_id}`,
      failureRedirectUrl: `${process.env.NEXT_PUBLIC_APP_URL}/hackathon/${hackathon_id}`,
      items: [
        {
          name: hackathon_title,
          price: price,
          quantity: 1,
        },
      ],
    },
  });

  return c.json(data);
});

app.post("/webhook", webhookMiddleware(), async (c) => {
  const body = await c.req.json();

  const res = await fetch(process.env.CLIENT_WEBHOOK_URL!, {
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

export default app;
