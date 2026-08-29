import request from 'supertest';
import {describe, expect, it} from 'vitest';
import {createApp} from './app.js';
import type {AppConfig} from './config.js';
import {DataStore, type StoredMessage} from './data-store.js';
import {GeminiUnavailableError, type GeminiService} from './gemini.js';
import {validateInput} from './safety.js';

const config: AppConfig = {
  port: 8080,
  nodeEnv: 'test',
  sessionSecret: 'test-session-secret-that-is-long-enough',
  adminSecret: 'correct horse battery staple',
  corsOrigins: ['https://allowed.example'],
  geminiApiKey: undefined,
  gcpProject: undefined,
  geminiTimeoutMs: 100,
  geminiConcurrency: 2,
  geminiRetries: 1,
  enableSearch: false,
};

class FakeGemini implements GeminiService {
  ready = true;
  imageCalls = 0;

  async generateText(): Promise<string> {
    return 'What do you already know about this topic?';
  }

  async generateImage() {
    this.imageCalls++;
    return {imageBase64: 'aW1hZ2U=', mimeType: 'image/png', caption: 'Diagram'};
  }
}

function testApp(overrides: Partial<Parameters<typeof createApp>[0]> = {}) {
  const store = new DataStore();
  const gemini = new FakeGemini();
  return {
    store,
    gemini,
    app: createApp({config, store, gemini, ...overrides}),
  };
}

describe('authentication and sessions', () => {
  it('ignores legacy header/query admin credentials and uses an HttpOnly signed cookie', async () => {
    const {app} = testApp();
    await request(app).get('/api/admin/metrics?adminKey=correct%20horse%20battery%20staple').expect(401);
    await request(app).get('/api/admin/metrics').set('x-admin-key', config.adminSecret!).expect(401);

    const agent = request.agent(app);
    const login = await agent.post('/api/admin/verify').send({key: config.adminSecret}).expect(200);
    expect(login.headers['set-cookie'][0]).toContain('HttpOnly');
    expect(login.headers['set-cookie'][0]).toContain('SameSite=Strict');
    await agent.get('/api/admin/metrics').expect(200);
  });

  it('binds history to the server-issued student session', async () => {
    const {app} = testApp();
    const first = request.agent(app);
    const heartbeat = await first.post('/api/telemetry/heartbeat').send({}).expect(200);
    const sessionId = heartbeat.body.sessionId as string;
    await first
      .post('/api/save-voice')
      .send({sessionId, messages: [{role: 'user', text: 'private lesson'}]})
      .expect(200);
    await request.agent(app).get(`/api/sessions/${sessionId}`).expect(403);
    const history = await first.get(`/api/sessions/${sessionId}`).expect(200);
    expect(history.body.messages[0].text).toBe('private lesson');
  });
});

describe('request hardening', () => {
  it('enforces strict schemas and a CORS allowlist', async () => {
    const {app} = testApp();
    await request(app).post('/api/chat').send({message: 'hello', unexpected: true}).expect(400);
    await request(app)
      .get('/api/health')
      .set('Origin', 'https://evil.example')
      .expect(403)
      .expect(response => expect(response.body.error.code).toBe('CORS_DENIED'));
  });

  it('rejects JSON bodies over 10MB with a safe structured error', async () => {
    const {app} = testApp();
    const response = await request(app)
      .post('/api/chat')
      .set('Content-Type', 'application/json')
      .send(JSON.stringify({message: 'x'.repeat(10 * 1024 * 1024)}))
      .expect(413);
    expect(response.body.error.code).toBe('PAYLOAD_TOO_LARGE');
  });

  it('rate limits requests', async () => {
    const {app} = testApp({rateLimitMax: 2});
    await request(app).get('/api/health').expect(200);
    await request(app).get('/api/health').expect(200);
    await request(app).get('/api/health').expect(429);
  });
});

describe('Gemini behavior and safety', () => {
  it('does not generate images unless explicitly requested', async () => {
    const {app, gemini} = testApp();
    const agent = request.agent(app);
    await agent.post('/api/chat').send({message: 'Explain photosynthesis'}).expect(200);
    expect(gemini.imageCalls).toBe(0);
    await agent
      .post('/api/chat')
      .send({message: 'Explain photosynthesis', generateImage: true})
      .expect(200);
    expect(gemini.imageCalls).toBe(1);
  });

  it('allows benign mentions that previously caused safety false positives', () => {
    expect(validateInput('Explain what a system prompt is.').safe).toBe(true);
    expect(validateInput('My classmate Dan studies cryptography.').safe).toBe(true);
    expect(validateInput('Explain phishing defensively for my security exam.').safe).toBe(true);
    expect(validateInput('What is Bitcoin?').safe).toBe(true);
  });

  it('reports degraded Gemini without leaking dependency errors', async () => {
    const unavailable: GeminiService = {
      ready: false,
      generateText: async () => {
        throw new GeminiUnavailableError('secret provider detail');
      },
      generateImage: async () => {
        throw new GeminiUnavailableError('secret provider detail');
      },
    };
    const {app} = testApp({gemini: unavailable});
    await request(app).get('/api/ready').expect(503);
    const response = await request.agent(app).post('/api/chat').send({message: 'hello'}).expect(503);
    expect(response.body.error.code).toBe('DEPENDENCY_UNAVAILABLE');
    expect(response.text).not.toContain('secret provider detail');
  });
});

describe('data operations', () => {
  it('paginates, exports, anonymizes, and completely deletes local fallback data', async () => {
    const store = new DataStore();
    const sessionId = 'a'.repeat(32);
    const messages: StoredMessage[] = Array.from({length: 5}, (_, index) => ({
      role: 'user',
      text: `message-${index}`,
      timestamp: new Date(index).toISOString(),
    }));
    await store.appendMessages(sessionId, messages);
    const first = await store.getMessages(sessionId, 2);
    const second = await store.getMessages(sessionId, 2, first.nextCursor!);
    expect(first.messages).toHaveLength(2);
    expect(second.messages[0].text).toBe('message-2');
    expect((await store.exportSession(sessionId))?.messages).toHaveLength(5);
    expect(await store.anonymizeSession(sessionId)).toBe(true);
    expect((await store.exportSession(sessionId))?.messages.every(item => item.text === '[ANONYMIZED]')).toBe(true);
    expect(await store.deleteSession(sessionId)).toBe(true);
    expect(await store.exportSession(sessionId)).toBeNull();
  });
});
