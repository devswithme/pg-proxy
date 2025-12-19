import app from "./app";

const PORT = Number(process.env.PORT) || 3003;
(app as any).listen({ port: PORT, hostname: "0.0.0.0" });
