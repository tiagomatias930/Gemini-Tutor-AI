/**
 * Ngola Tutor — Telemetry, KPI & System Stability Monitoring Module
 *
 * Tracks:
 *   1. User Locations & IP Geolocation (approximate city/country)
 *   2. Token Usage & AI Compute Consumption (per session and aggregate)
 *   3. Session Duration & Engagement Time
 *   4. System Stability, Latency & Health KPIs
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const METRICS_FILE = path.join(__dirname, '..', 'data', 'telemetry_metrics.json');

// Ensure data directory exists
const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) {
  try {
    fs.mkdirSync(dataDir, { recursive: true });
  } catch {
    // Ignore error if directory already exists
  }
}

export interface UserSessionMetrics {
  sessionId: string;
  ip: string;
  country: string;
  city: string;
  userAgent: string;
  startTime: number;
  lastHeartbeat: number;
  durationSeconds: number;
  totalTokens: number;
  promptTokens: number;
  completionTokens: number;
  messageCount: number;
  isOnline: boolean;
  cacheEnabled: boolean;
  locationConsent: boolean;
}

export interface SystemStabilityMetrics {
  serverStartTime: number;
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageLatencyMs: number;
  recentLatencies: number[];
  uptimeSeconds: number;
  totalTokensConsumed: number;
  totalSessionsCount: number;
  activeUsersCount: number;
}

class TelemetryService {
  private sessions: Map<string, UserSessionMetrics> = new Map();
  private serverStartTime: number = Date.now();
  private totalRequests: number = 0;
  private successfulRequests: number = 0;
  private failedRequests: number = 0;
  private recentLatencies: number[] = [];
  private totalTokensConsumed: number = 0;

  constructor() {
    this.loadFromDisk();
    // Auto-save metrics periodically
    setInterval(() => this.saveToDisk(), 60000);
    // Cleanup inactive sessions (heartbeat older than 5 minutes)
    setInterval(() => this.cleanupInactiveSessions(), 30000);
  }

  // Estimate tokens from text (~4 characters per token in English/Portuguese)
  public estimateTokens(text: string): number {
    if (!text) return 0;
    return Math.max(1, Math.ceil(text.length / 4));
  }

  // Record an API request latency & result
  public recordRequest(latencyMs: number, success: boolean = true) {
    this.totalRequests++;
    if (success) {
      this.successfulRequests++;
    } else {
      this.failedRequests++;
    }

    this.recentLatencies.push(latencyMs);
    if (this.recentLatencies.length > 100) {
      this.recentLatencies.shift();
    }
  }

  // Extract client IP & approximate country/city
  public resolveClientInfo(req: any, clientPayload?: any): { ip: string; country: string; city: string; userAgent: string } {
    const rawIp = (
      req.headers['x-forwarded-for']?.toString().split(',')[0] ||
      req.headers['x-real-ip'] ||
      req.socket?.remoteAddress ||
      '127.0.0.1'
    ).trim();

    // Default geographic info
    let country = clientPayload?.country || req.headers['cf-ipcountry'] || 'Desconhecido';
    let city = clientPayload?.city || 'Local';

    if (rawIp === '127.0.0.1' || rawIp === '::1' || rawIp.startsWith('192.168.') || rawIp.startsWith('10.')) {
      if (!clientPayload?.country) country = 'Rede Local / Dev';
      if (!clientPayload?.city) city = 'Ambiente de Testes';
    }

    const userAgent = req.headers['user-agent'] || clientPayload?.userAgent || 'Unknown Browser';

    return { ip: rawIp, country, city, userAgent };
  }

  // Register or update a user session
  public trackSession(
    sessionId: string,
    req: any,
    payload?: {
      tokensUsed?: number;
      promptTokens?: number;
      completionTokens?: number;
      locationConsent?: boolean;
      cacheEnabled?: boolean;
      country?: string;
      city?: string;
    }
  ): UserSessionMetrics {
    const now = Date.now();
    let session = this.sessions.get(sessionId);

    const clientInfo = this.resolveClientInfo(req, payload);

    if (!session) {
      session = {
        sessionId,
        ip: payload?.locationConsent !== false ? clientInfo.ip : 'Anônimo (Consentimento Negado)',
        country: payload?.locationConsent !== false ? clientInfo.country : 'Não partilhado',
        city: payload?.locationConsent !== false ? clientInfo.city : 'Não partilhado',
        userAgent: clientInfo.userAgent,
        startTime: now,
        lastHeartbeat: now,
        durationSeconds: 0,
        totalTokens: payload?.tokensUsed || 0,
        promptTokens: payload?.promptTokens || 0,
        completionTokens: payload?.completionTokens || 0,
        messageCount: 1,
        isOnline: true,
        cacheEnabled: payload?.cacheEnabled ?? true,
        locationConsent: payload?.locationConsent ?? true,
      };
    } else {
      session.lastHeartbeat = now;
      session.durationSeconds = Math.floor((now - session.startTime) / 1000);
      session.isOnline = true;
      if (payload?.tokensUsed) {
        session.totalTokens += payload.tokensUsed;
      }
      if (payload?.promptTokens) {
        session.promptTokens += payload.promptTokens;
      }
      if (payload?.completionTokens) {
        session.completionTokens += payload.completionTokens;
      }
      session.messageCount += 1;
      if (payload?.locationConsent !== undefined) session.locationConsent = payload.locationConsent;
      if (payload?.cacheEnabled !== undefined) session.cacheEnabled = payload.cacheEnabled;
    }

    if (payload?.tokensUsed) {
      this.totalTokensConsumed += payload.tokensUsed;
    }

    this.sessions.set(sessionId, session);
    return session;
  }

  // Heartbeat ping from client to maintain active status and duration
  public recordHeartbeat(
    sessionId: string,
    req: any,
    payload?: { durationSeconds?: number; locationConsent?: boolean; cacheEnabled?: boolean; country?: string; city?: string }
  ): UserSessionMetrics {
    const now = Date.now();
    let session = this.sessions.get(sessionId);

    if (!session) {
      return this.trackSession(sessionId, req, payload);
    }

    session.lastHeartbeat = now;
    if (payload?.durationSeconds !== undefined && payload.durationSeconds > session.durationSeconds) {
      session.durationSeconds = payload.durationSeconds;
    } else {
      session.durationSeconds = Math.floor((now - session.startTime) / 1000);
    }
    session.isOnline = true;
    if (payload?.locationConsent !== undefined) session.locationConsent = payload.locationConsent;
    if (payload?.cacheEnabled !== undefined) session.cacheEnabled = payload.cacheEnabled;

    this.sessions.set(sessionId, session);
    return session;
  }

  // Cleanup sessions inactive for > 2 minutes
  private cleanupInactiveSessions() {
    const now = Date.now();
    for (const [id, session] of this.sessions.entries()) {
      if (now - session.lastHeartbeat > 120000) {
        session.isOnline = false;
      }
    }
  }

  // Get aggregated KPI metrics
  public getKPISummary(): {
    stability: SystemStabilityMetrics;
    activeSessions: UserSessionMetrics[];
    allSessions: UserSessionMetrics[];
    geoDistribution: Record<string, number>;
    aggregateStats: {
      totalTokens: number;
      avgDurationMinutes: number;
      totalMessages: number;
      totalUsers: number;
      systemUptimePercent: number;
    };
  } {
    const now = Date.now();
    const activeSessions: UserSessionMetrics[] = [];
    const allSessions: UserSessionMetrics[] = Array.from(this.sessions.values()).sort(
      (a, b) => b.lastHeartbeat - a.lastHeartbeat
    );
    const geoDistribution: Record<string, number> = {};
    let totalDurationSeconds = 0;
    let totalMessages = 0;

    for (const session of this.sessions.values()) {
      if (session.isOnline) {
        activeSessions.push(session);
      }
      const geoKey = session.country || 'Desconhecido';
      geoDistribution[geoKey] = (geoDistribution[geoKey] || 0) + 1;
      totalDurationSeconds += session.durationSeconds;
      totalMessages += session.messageCount;
    }

    const avgLatency = this.recentLatencies.length
      ? Math.round(this.recentLatencies.reduce((a, b) => a + b, 0) / this.recentLatencies.length)
      : 0;

    const totalReqs = this.totalRequests || 1;
    const stabilityPercent = Number(((this.successfulRequests / totalReqs) * 100).toFixed(2));
    const avgDurationMinutes = this.sessions.size
      ? Number((totalDurationSeconds / this.sessions.size / 60).toFixed(1))
      : 0;

    return {
      stability: {
        serverStartTime: this.serverStartTime,
        totalRequests: this.totalRequests,
        successfulRequests: this.successfulRequests,
        failedRequests: this.failedRequests,
        averageLatencyMs: avgLatency,
        recentLatencies: this.recentLatencies.slice(-20),
        uptimeSeconds: Math.floor((now - this.serverStartTime) / 1000),
        totalTokensConsumed: this.totalTokensConsumed,
        totalSessionsCount: this.sessions.size,
        activeUsersCount: activeSessions.length,
      },
      activeSessions: activeSessions.slice(0, 100),
      allSessions: allSessions.slice(0, 200),
      geoDistribution,
      aggregateStats: {
        totalTokens: this.totalTokensConsumed,
        avgDurationMinutes,
        totalMessages,
        totalUsers: this.sessions.size,
        systemUptimePercent: stabilityPercent > 0 ? stabilityPercent : 100,
      },
    };
  }

  public getAllSessions(): UserSessionMetrics[] {
    return Array.from(this.sessions.values()).sort((a, b) => b.lastHeartbeat - a.lastHeartbeat);
  }

  public getSession(sessionId: string): UserSessionMetrics | undefined {
    return this.sessions.get(sessionId);
  }

  // Persistence to local disk
  private saveToDisk() {
    try {
      const data = {
        totalTokensConsumed: this.totalTokensConsumed,
        totalRequests: this.totalRequests,
        successfulRequests: this.successfulRequests,
        failedRequests: this.failedRequests,
        sessions: Array.from(this.sessions.entries()).slice(-200),
      };
      fs.writeFileSync(METRICS_FILE, JSON.stringify(data, null, 2));
    } catch {
      // Ignore disk write errors in ephemeral environments
    }
  }

  private loadFromDisk() {
    try {
      if (fs.existsSync(METRICS_FILE)) {
        const raw = fs.readFileSync(METRICS_FILE, 'utf-8');
        const parsed = JSON.parse(raw);
        this.totalTokensConsumed = parsed.totalTokensConsumed || 0;
        this.totalRequests = parsed.totalRequests || 0;
        this.successfulRequests = parsed.successfulRequests || 0;
        this.failedRequests = parsed.failedRequests || 0;
        if (parsed.sessions) {
          this.sessions = new Map(parsed.sessions);
        }
      }
    } catch {
      // Start fresh if file cannot be read
    }
  }
}

export const telemetry = new TelemetryService();
