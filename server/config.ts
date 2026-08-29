import crypto from 'node:crypto';

export interface AppConfig {
  port: number;
  nodeEnv: string;
  sessionSecret: string;
  adminSecret?: string;
  corsOrigins: string[];
  geminiApiKey?: string;
  gcpProject?: string;
  geminiTimeoutMs: number;
  geminiConcurrency: number;
  geminiRetries: number;
  enableSearch: boolean;
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
    geminiTimeoutMs: integer(env.GEMINI_TIMEOUT_MS, 20_000),
    geminiConcurrency: integer(env.GEMINI_CONCURRENCY, 4),
    geminiRetries: Math.min(integer(env.GEMINI_RETRIES, 2), 4),
    enableSearch: env.GEMINI_ENABLE_SEARCH === 'true',
  };
}
