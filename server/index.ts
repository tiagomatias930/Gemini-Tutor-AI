import path from 'node:path';
import dotenv from 'dotenv';
import {createApp} from './app.js';
import {loadConfig} from './config.js';
import {connectDataStore} from './data-store.js';
import {ManagedGeminiService} from './gemini.js';
import {TelemetryService} from './telemetry.js';

dotenv.config({path: path.resolve(process.cwd(), '..', '.env')});

const config = loadConfig();
const store = await connectDataStore(config.gcpProject, config.nodeEnv !== 'production');
const telemetry = new TelemetryService(store);
const gemini = new ManagedGeminiService(config);
const app = createApp({
  config,
  store,
  telemetry,
  gemini,
  staticDirectory: path.resolve(process.cwd(), '..', 'dist'),
});

const server = app.listen(config.port, () => {
  console.log(
    JSON.stringify({
      level: 'info',
      message: 'Ngola Tutor backend started',
      port: config.port,
      firestore: store.available,
      gemini: gemini.ready,
    })
  );
});

let shuttingDown = false;
async function shutdown(signal: string): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(JSON.stringify({level: 'info', message: 'Shutting down', signal}));
  const forced = setTimeout(() => process.exit(1), 10_000);
  forced.unref();
  server.close(async error => {
    telemetry.close();
    if (store.db) await store.db.terminate().catch(() => undefined);
    clearTimeout(forced);
    process.exit(error ? 1 : 0);
  });
}

process.once('SIGTERM', () => void shutdown('SIGTERM'));
process.once('SIGINT', () => void shutdown('SIGINT'));
