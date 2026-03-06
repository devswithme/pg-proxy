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
    origin: [process.env.APP_WEBHOOK_URL!],
    allowMethods: ["GET", "POST"],
    allowHeaders: ["Content-Type", "Authorization", "x-api-key"],
  }),
);

app.use(
  "/",
  apiKeyMiddleware(),
  rateLimitMiddleware({
    windowMs: 30_000,
    max: 30,
  }),
);

app.post("/invoice", async (c) => {
  const body = await c.req.json();

  const data = await xendit.Invoice.createInvoice({
    data: body,
  });

  return c.json(data);
});

app.post("/webhook", webhookMiddleware(), async (c) => {
  let body: { external_id: string };
  try {
    body = (await c.req.json()) as { external_id: string };
  } catch (parseErr) {
    const isJsonParseError =
      parseErr instanceof SyntaxError ||
      (parseErr instanceof Error &&
        parseErr.message.includes("JSON Parse error"));
    if (isJsonParseError) {
      return c.json({ error: "Invalid or empty JSON body" }, 400);
    }
    throw parseErr;
  }

  const webhookRoutes: Array<{
    id: string;
    baseUrl: string | undefined;
  }> = [
    {
      id: "meetly",
      baseUrl: "https://meetly.fydemy.com",
    },
    {
      id: "hack",
      baseUrl: "https://hack.fydemy.com",
    },
    {
      id: "lala",
      baseUrl: "https://lala.fysite.id",
    },
  ];

  const route = webhookRoutes.find((r) => body.external_id.includes(r.id));
  if (!route) {
    return c.json({ error: "No matching webhook route for external_id" }, 400);
  }
  if (!route.baseUrl) {
    return c.json(
      { error: `Missing webhook base URL env for route: ${route.id}` },
      500,
    );
  }

  const targetUrl = new URL("/api/xendit", route.baseUrl).toString();

  const res = await fetch(targetUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Callback-Token": process.env.XENDIT_WEBHOOK_TOKEN!,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    console.log(await res.text());
    return c.json({ error: "Failed to forward webhook to client" }, 502);
  }

  return c.json({ success: true });
});

export default {
  port: process.env.PORT || 3003,
  fetch: app.fetch,
};
