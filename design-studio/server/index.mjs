import { createApp } from "./app.mjs";
const { app, close } = createApp();
const port = Number(process.env.PORT || 3001);
const server = app.listen(port, "0.0.0.0", () =>
  console.log(`Studio server listening on ${port}`),
);
const shutdown = () =>
  server.close(async () => {
    await close();
    process.exit(0);
  });
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
