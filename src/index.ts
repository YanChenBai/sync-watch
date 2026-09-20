import { createApp } from './app.ts';
import { config } from './config.ts';
import { log } from './logger.ts';

const app = await createApp();

app.listen({
  hostname: config.hostname,

  port: config.port,
});

log(`Sync Watch 已启动：http://localhost:${app.server?.port ?? config.port}`);
