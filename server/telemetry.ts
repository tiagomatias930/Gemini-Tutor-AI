import type {Request} from 'express';
import {DataStore, type SessionMetrics} from './data-store.js';

export type TelemetryPayload = Partial<
  Pick<
    SessionMetrics,
    | 'durationSeconds'
    | 'locationConsent'
    | 'cacheEnabled'
    | 'country'
    | 'city'
    | 'totalTokens'
    | 'promptTokens'
    | 'completionTokens'
  >
> & {tokensUsed?: number};

export class TelemetryService {
  private readonly cache = new Map<string, SessionMetrics>();
  private readonly startedAt = Date.now();
  private readonly latencies: number[] = [];
  private totalRequests = 0;
  private successfulRequests = 0;
  private failedRequests = 0;
  private cleanupTimer: NodeJS.Timeout;

  constructor(private readonly store: DataStore) {
    this.cleanupTimer = setInterval(() => this.markInactive(), 30_000);
    this.cleanupTimer.unref();
  }

  estimateTokens(text: string): number {
    return text ? Math.max(1, Math.ceil(text.length / 4)) : 0;
  }

  recordRequest(latencyMs: number, success = true): void {
    this.totalRequests++;
    success ? this.successfulRequests++ : this.failedRequests++;
    this.latencies.push(latencyMs);
    if (this.latencies.length > 100) this.latencies.shift();
  }

  trackSession(sessionId: string, req: Request, payload: TelemetryPayload = {}): SessionMetrics {
    const now = Date.now();
    const current = this.cache.get(sessionId);
    const consent = payload.locationConsent ?? current?.locationConsent ?? false;
    const client = this.clientInfo(req, payload);
    const metrics: SessionMetrics = current
      ? {
          ...current,
          lastHeartbeat: now,
          durationSeconds: Math.max(
            payload.durationSeconds ?? 0,
            Math.floor((now - current.startTime) / 1000)
          ),
          totalTokens: current.totalTokens + (payload.tokensUsed ?? 0),
          promptTokens: current.promptTokens + (payload.promptTokens ?? 0),
          completionTokens: current.completionTokens + (payload.completionTokens ?? 0),
          messageCount: current.messageCount + (payload.tokensUsed ? 1 : 0),
          isOnline: true,
          cacheEnabled: payload.cacheEnabled ?? current.cacheEnabled,
          locationConsent: consent,
        }
      : {
          sessionId,
          ip: consent ? client.ip : 'NOT_COLLECTED',
          country: consent ? client.country : 'NOT_COLLECTED',
          city: consent ? client.city : 'NOT_COLLECTED',
          userAgent: consent ? client.userAgent : 'NOT_COLLECTED',
          startTime: now,
          lastHeartbeat: now,
          durationSeconds: payload.durationSeconds ?? 0,
          totalTokens: payload.tokensUsed ?? 0,
          promptTokens: payload.promptTokens ?? 0,
          completionTokens: payload.completionTokens ?? 0,
          messageCount: payload.tokensUsed ? 1 : 0,
          isOnline: true,
          cacheEnabled: payload.cacheEnabled ?? false,
          locationConsent: consent,
        };
    this.cache.set(sessionId, metrics);
    this.trimCache();
    void this.store.upsertMetrics(metrics).catch(error => {
      console.error('Telemetry persistence failed', safeError(error));
    });
    return metrics;
  }

  recordHeartbeat(sessionId: string, req: Request, payload: TelemetryPayload): SessionMetrics {
    return this.trackSession(sessionId, req, payload);
  }

  async getSession(sessionId: string): Promise<SessionMetrics | null> {
    return this.store.available || !this.store.fallbackEnabled
      ? this.store.getMetrics(sessionId)
      : this.cache.get(sessionId) ?? null;
  }

  async getAllSessions(): Promise<SessionMetrics[]> {
    return this.store.available || !this.store.fallbackEnabled
      ? this.store.listMetrics(200)
      : [...this.cache.values()];
  }

  async getKPISummary(): Promise<object> {
    const allSessions = await this.getAllSessions();
    const activeSessions = allSessions.filter(item => item.isOnline);
    const totalTokens = allSessions.reduce((sum, item) => sum + item.totalTokens, 0);
    const totalMessages = allSessions.reduce((sum, item) => sum + item.messageCount, 0);
    const totalDuration = allSessions.reduce((sum, item) => sum + item.durationSeconds, 0);
    const geoDistribution: Record<string, number> = {};
    allSessions.forEach(item => {
      geoDistribution[item.country] = (geoDistribution[item.country] ?? 0) + 1;
    });
    const averageLatencyMs = this.latencies.length
      ? Math.round(this.latencies.reduce((a, b) => a + b, 0) / this.latencies.length)
      : 0;
    return {
      stability: {
        serverStartTime: this.startedAt,
        totalRequests: this.totalRequests,
        successfulRequests: this.successfulRequests,
        failedRequests: this.failedRequests,
        averageLatencyMs,
        recentLatencies: this.latencies.slice(-20),
        uptimeSeconds: Math.floor((Date.now() - this.startedAt) / 1000),
        totalTokensConsumed: totalTokens,
        totalSessionsCount: allSessions.length,
        activeUsersCount: activeSessions.length,
      },
      activeSessions: activeSessions.slice(0, 100),
      allSessions,
      geoDistribution,
      aggregateStats: {
        totalTokens,
        avgDurationMinutes: allSessions.length
          ? Number((totalDuration / allSessions.length / 60).toFixed(1))
          : 0,
        totalMessages,
        totalUsers: allSessions.length,
        systemUptimePercent: this.totalRequests
          ? Number(((this.successfulRequests / this.totalRequests) * 100).toFixed(2))
          : 100,
      },
    };
  }

  async getLGPDSummary(): Promise<object> {
    const sessions = await this.getAllSessions();
    const locationGranted = sessions.filter(item => item.locationConsent).length;
    const cacheGranted = sessions.filter(item => item.cacheEnabled).length;
    return {
      totalDataSubjects: sessions.length,
      consentMetrics: {
        locationConsent: {granted: locationGranted, denied: sessions.length - locationGranted},
        cacheConsent: {granted: cacheGranted, denied: sessions.length - cacheGranted},
      },
      anonymizationStatus: {
        anonymized: sessions.filter(item => item.ip === 'ANONYMIZED').length,
      },
      retentionPolicy: {maxDays: 90},
    };
  }

  close(): void {
    clearInterval(this.cleanupTimer);
  }

  private clientInfo(req: Request, payload: TelemetryPayload) {
    return {
      ip: req.ip || req.socket.remoteAddress || 'unknown',
      country: payload.country ?? String(req.headers['cf-ipcountry'] ?? 'unknown'),
      city: payload.city ?? 'unknown',
      userAgent: String(req.headers['user-agent'] ?? 'unknown').slice(0, 300),
    };
  }

  private markInactive(): void {
    const cutoff = Date.now() - 120_000;
    this.cache.forEach(metrics => {
      if (metrics.lastHeartbeat < cutoff && metrics.isOnline) {
        metrics.isOnline = false;
        void this.store.upsertMetrics(metrics).catch(() => undefined);
      }
    });
  }

  private trimCache(): void {
    if (this.cache.size <= 200) return;
    const oldest = [...this.cache.values()].sort((a, b) => a.lastHeartbeat - b.lastHeartbeat)[0];
    if (oldest) this.cache.delete(oldest.sessionId);
  }
}

function safeError(error: unknown): string {
  return error instanceof Error ? error.message.slice(0, 160) : 'unknown error';
}
