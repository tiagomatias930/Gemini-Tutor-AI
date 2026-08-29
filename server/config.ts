import crypto from 'node:crypto';

export interface AppConfig {
  port: number;
  nodeEnv: string;
  sessionSecret: string;
  adminSecret?: string;
  corsOrigins: string[];
  geminiApiKey?: string;
  gcpProject?: string;
  geminiTextModel: string;
  geminiImageModel: string;
  geminiTimeoutMs: number;
  geminiConcurrency: number;
  geminiRetries: number;
  enableSearch: boolean;
  geminiLiveModel: string;
  geminiLiveMaxDurationMs: number;
  geminiLiveSessionsPerIp: number;
  geminiLiveMaxSessions: number;
  geminiLiveConnectionsPerMinute: number;
}

function integer(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(value ?? '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const nodeEnv = env.NODE_ENV ?? 'development';
  const configuredSecret = env.SESSION_SECRET?.trim();
  if (nodeEnv === 'production' && (!configuredSecret || configuredSecret.length < 32)) {
    throw new Error('SESSION_SECRET must be at least 32 characters in production');
  }

  return {
    port: integer(env.PORT, 8080),
    nodeEnv,
    sessionSecret: configuredSecret || crypto.randomBytes(32).toString('hex'),
    adminSecret: env.ADMIN_SECRET?.trim() || undefined,
    corsOrigins: (env.CORS_ORIGINS ?? 'http://localhost:5173,http://localhost:3000')
      .split(',')
      .map(value => value.trim())
      .filter(Boolean),
    geminiApiKey: env.GEMINI_API_KEY?.trim() || undefined,
    gcpProject: env.GOOGLE_CLOUD_PROJECT?.trim() || undefined,
    geminiTextModel: env.GEMINI_TEXT_MODEL?.trim() || 'gemini-3.6-flash',
    geminiImageModel: env.GEMINI_IMAGE_MODEL?.trim() || 'gemini-2.5-flash-image',
    geminiTimeoutMs: integer(env.GEMINI_TIMEOUT_MS, 20_000),
    geminiConcurrency: integer(env.GEMINI_CONCURRENCY, 4),
    geminiRetries: Math.min(integer(env.GEMINI_RETRIES, 2), 4),
    enableSearch: env.GEMINI_ENABLE_SEARCH === 'true',
    geminiLiveModel: env.GEMINI_LIVE_MODEL?.trim() || 'gemini-2.5-flash-native-audio-latest',
    geminiLiveMaxDurationMs: Math.min(integer(env.GEMINI_LIVE_MAX_DURATION_MS, 30 * 60_000), 60 * 60_000),
    geminiLiveSessionsPerIp: Math.min(integer(env.GEMINI_LIVE_SESSIONS_PER_IP, 2), 5),
    geminiLiveMaxSessions: Math.min(integer(env.GEMINI_LIVE_MAX_SESSIONS, 20), 100),
    geminiLiveConnectionsPerMinute: Math.min(integer(env.GEMINI_LIVE_CONNECTIONS_PER_MINUTE, 6), 30),
  };
}
