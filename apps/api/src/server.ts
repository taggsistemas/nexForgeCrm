import mongoose from 'mongoose';
import { createApp } from './app.js';
import { readConfig } from './infrastructure/config.js';
const config = readConfig(process.env);
await mongoose.connect(config.MONGODB_URI, { serverSelectionTimeoutMS: 5000 });
const app = createApp({ origin: config.WEB_ORIGIN, databaseReady: () => mongoose.connection.readyState === 1 });
const server = app.listen(config.PORT, () => console.info('NexForge CRM API listening on ' + config.PORT));
let closing = false;
function shutdown() {
  if (closing) return;
  closing = true;
  const timeout = setTimeout(() => process.exit(1), 10000).unref();
  server.close(async () => { await mongoose.disconnect(); clearTimeout(timeout); });
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);