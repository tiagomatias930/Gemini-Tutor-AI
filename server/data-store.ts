import {FieldPath, FieldValue, Firestore} from '@google-cloud/firestore';

export interface StoredMessage {
  role: 'user' | 'assistant';
  text: string;
  timestamp: string;
  source?: 'text' | 'voice';
}

export interface SessionMetrics {
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

export interface MessagePage {
  messages: StoredMessage[];
  nextCursor: string | null;
}

const MAX_LOCAL_SESSIONS = 200;
const MAX_LOCAL_MESSAGES = 500;

export class DataStore {
  private readonly localMetrics = new Map<string, SessionMetrics>();
  private readonly localMessages = new Map<string, StoredMessage[]>();

  constructor(
    readonly db: Firestore | null = null,
    readonly fallbackEnabled = true
  ) {}

  get available(): boolean {
    return this.db !== null;
  }

  async appendMessages(sessionId: string, messages: StoredMessage[]): Promise<void> {
    if (!messages.length) return;
    if (!this.db) {
      this.requireFallback();
      const current = this.localMessages.get(sessionId) ?? [];
      this.localMessages.set(sessionId, [...current, ...messages].slice(-MAX_LOCAL_MESSAGES));
      this.trimLocal();
      return;
    }
    const session = this.db.collection('sessions').doc(sessionId);
    for (let offset = 0; offset < messages.length; offset += 400) {
      const batch = this.db.batch();
      for (const message of messages.slice(offset, offset + 400)) {
        batch.set(session.collection('messages').doc(), message);
      }
      batch.set(
        session,
        {
          updatedAt: new Date().toISOString(),
          messageCount: FieldValue.increment(messages.slice(offset, offset + 400).length),
        },
        {merge: true}
      );
      await batch.commit();
    }
  }

  async getMessages(sessionId: string, limit = 50, cursor?: string): Promise<MessagePage> {
    const safeLimit = Math.min(Math.max(limit, 1), 100);
    const offset = decodeCursor(cursor);
    if (!this.db) {
      this.requireFallback();
      const all = this.localMessages.get(sessionId) ?? [];
      const messages = all.slice(offset, offset + safeLimit);
      return {
        messages,
        nextCursor: offset + messages.length < all.length ? encodeCursor(offset + messages.length) : null,
      };
    }
    const snapshot = await this.db
      .collection('sessions')
      .doc(sessionId)
      .collection('messages')
      .orderBy('timestamp', 'asc')
      .orderBy(FieldPath.documentId(), 'asc')
      .offset(offset)
      .limit(safeLimit + 1)
      .get();
    const docs = snapshot.docs.slice(0, safeLimit);
    return {
      messages: docs.map(doc => doc.data() as StoredMessage),
      nextCursor: snapshot.size > safeLimit ? encodeCursor(offset + safeLimit) : null,
    };
  }

  async getRecentMessages(sessionId: string, limit = 30): Promise<StoredMessage[]> {
    const safeLimit = Math.min(Math.max(limit, 1), 50);
    if (!this.db) {
      this.requireFallback();
      return (this.localMessages.get(sessionId) ?? []).slice(-safeLimit);
    }
    const snapshot = await this.db
      .collection('sessions')
      .doc(sessionId)
      .collection('messages')
      .orderBy('timestamp', 'desc')
      .orderBy(FieldPath.documentId(), 'desc')
      .limit(safeLimit)
      .get();
    return snapshot.docs.reverse().map(doc => doc.data() as StoredMessage);
  }

  async upsertMetrics(metrics: SessionMetrics): Promise<void> {
    if (!this.db) {
      this.requireFallback();
      this.localMetrics.set(metrics.sessionId, {...metrics});
      this.trimLocal();
      return;
    }
    await this.db.collection('telemetry').doc(metrics.sessionId).set(metrics, {merge: true});
  }

  async getMetrics(sessionId: string): Promise<SessionMetrics | null> {
    if (!this.db) {
      this.requireFallback();
      return this.localMetrics.get(sessionId) ?? null;
    }
    const snapshot = await this.db.collection('telemetry').doc(sessionId).get();
    return snapshot.exists ? (snapshot.data() as SessionMetrics) : null;
  }

  async listMetrics(limit = 200): Promise<SessionMetrics[]> {
    if (!this.db) {
      this.requireFallback();
      return [...this.localMetrics.values()]
        .sort((a, b) => b.lastHeartbeat - a.lastHeartbeat)
        .slice(0, limit);
    }
    const snapshot = await this.db
      .collection('telemetry')
      .orderBy('lastHeartbeat', 'desc')
      .limit(Math.min(limit, 500))
      .get();
    return snapshot.docs.map(doc => doc.data() as SessionMetrics);
  }

  async deleteSession(sessionId: string): Promise<boolean> {
    const exists = Boolean(await this.getMetrics(sessionId)) || (await this.getMessages(sessionId, 1)).messages.length > 0;
    if (!this.db) {
      this.requireFallback();
      this.localMetrics.delete(sessionId);
      this.localMessages.delete(sessionId);
      return exists;
    }
    await this.deleteCollection(this.db.collection('sessions').doc(sessionId).collection('messages'));
    await Promise.all([
      this.db.collection('sessions').doc(sessionId).delete(),
      this.db.collection('telemetry').doc(sessionId).delete(),
    ]);
    return exists;
  }

  async anonymizeSession(sessionId: string): Promise<boolean> {
    const metrics = await this.getMetrics(sessionId);
    const hasMessages = (await this.getMessages(sessionId, 1)).messages.length > 0;
    if (!metrics && !hasMessages) return false;
    if (!this.db) {
      this.requireFallback();
      if (metrics) {
        this.localMetrics.set(sessionId, anonymizedMetrics(metrics));
      }
      const messages = this.localMessages.get(sessionId);
      if (messages) this.localMessages.set(sessionId, messages.map(anonymizedMessage));
      return true;
    }
    if (metrics) {
      await this.db.collection('telemetry').doc(sessionId).set(anonymizedMetrics(metrics));
    }
    const collection = this.db.collection('sessions').doc(sessionId).collection('messages');
    let after: FirebaseFirestore.QueryDocumentSnapshot | undefined;
    while (true) {
      let query = collection.orderBy(FieldPath.documentId()).limit(400);
      if (after) query = query.startAfter(after);
      const snapshot = await query.get();
      if (snapshot.empty) break;
      const batch = this.db.batch();
      snapshot.docs.forEach(doc => batch.set(doc.ref, anonymizedMessage(doc.data() as StoredMessage)));
      await batch.commit();
      after = snapshot.docs.at(-1);
      if (snapshot.size < 400) break;
    }
    return true;
  }

  async exportSession(sessionId: string): Promise<{telemetry: SessionMetrics | null; messages: StoredMessage[]} | null> {
    const telemetry = await this.getMetrics(sessionId);
    const messages: StoredMessage[] = [];
    let cursor: string | undefined;
    do {
      const page = await this.getMessages(sessionId, 100, cursor);
      messages.push(...page.messages);
      cursor = page.nextCursor ?? undefined;
    } while (cursor);
    return telemetry || messages.length ? {telemetry, messages} : null;
  }

  async purgeExpired(cutoff: number): Promise<number> {
    const expired = (await this.listMetrics(500)).filter(item => item.lastHeartbeat < cutoff && !item.isOnline);
    await Promise.all(expired.map(item => this.deleteSession(item.sessionId)));
    return expired.length;
  }

  private async deleteCollection(collection: FirebaseFirestore.CollectionReference): Promise<void> {
    while (true) {
      const snapshot = await collection.limit(400).get();
      if (snapshot.empty) return;
      const batch = this.db!.batch();
      snapshot.docs.forEach(doc => batch.delete(doc.ref));
      await batch.commit();
      if (snapshot.size < 400) return;
    }
  }

  private trimLocal(): void {
    const ids = new Set([...this.localMetrics.keys(), ...this.localMessages.keys()]);
    if (ids.size <= MAX_LOCAL_SESSIONS) return;
    const oldest = [...ids].sort((a, b) => {
      return (this.localMetrics.get(a)?.lastHeartbeat ?? 0) - (this.localMetrics.get(b)?.lastHeartbeat ?? 0);
    });
    for (const id of oldest.slice(0, ids.size - MAX_LOCAL_SESSIONS)) {
      this.localMetrics.delete(id);
      this.localMessages.delete(id);
    }
  }

  private requireFallback(): void {
    if (!this.fallbackEnabled) throw new DataStoreUnavailableError();
  }
}

export async function connectDataStore(projectId?: string, allowFallback = true): Promise<DataStore> {
  try {
    const db = new Firestore(projectId ? {projectId} : {});
    await db.collection('telemetry').limit(1).get();
    return new DataStore(db);
  } catch (error) {
    console.warn(
      allowFallback ? 'Firestore unavailable; using bounded local fallback' : 'Firestore unavailable',
      safeError(error)
    );
    return new DataStore(null, allowFallback);
  }
}

export class DataStoreUnavailableError extends Error {
  constructor() {
    super('Persistent data store is unavailable');
  }
}

function anonymizedMetrics(metrics: SessionMetrics): SessionMetrics {
  return {
    ...metrics,
    ip: 'ANONYMIZED',
    country: 'ANONYMIZED',
    city: 'ANONYMIZED',
    userAgent: 'ANONYMIZED',
    locationConsent: false,
  };
}

function anonymizedMessage(message: StoredMessage): StoredMessage {
  return {...message, text: '[ANONYMIZED]'};
}

function encodeCursor(offset: number): string {
  return Buffer.from(String(offset)).toString('base64url');
}

function decodeCursor(cursor?: string): number {
  if (!cursor) return 0;
  const value = Number.parseInt(Buffer.from(cursor, 'base64url').toString(), 10);
  return Number.isSafeInteger(value) && value >= 0 ? value : 0;
}

function safeError(error: unknown): string {
  return error instanceof Error ? error.message.slice(0, 160) : 'connection failed';
}
