import request from 'supertest';
import {describe, expect, it} from 'vitest';
import {createApp} from './app.js';
import type {AppConfig} from './config.js';
import {DataStore, type StoredMessage} from './data-store.js';
import {
  GeminiUnavailableError,
  ManagedGeminiService,
  type GeminiService,
  type TextRequest,
} from './gemini.js';
import {studentSessionFromCookie} from './live-proxy.js';
import {validateInput} from './safety.js';
import {buildStudentProfileSupplement, TUTOR_SYSTEM_INSTRUCTION} from './tutor-prompt.js';

const config: AppConfig = {
  port: 8080,
  nodeEnv: 'test',
  sessionSecret: 'test-session-secret-that-is-long-enough',
  adminSecret: 'correct horse battery staple',
  corsOrigins: ['https://allowed.example'],
  geminiApiKey: undefined,
  gcpProject: undefined,
  geminiTextModel: 'gemini-3.6-flash',
  geminiImageModel: 'gemini-2.5-flash-image',
  geminiTimeoutMs: 100,
  geminiConcurrency: 2,
  geminiRetries: 1,
  enableSearch: false,
  geminiLiveModel: 'gemini-2.5-flash-native-audio-latest',
  geminiLiveMaxDurationMs: 30 * 60_000,
  geminiLiveSessionsPerIp: 2,
  geminiLiveMaxSessions: 20,
  geminiLiveConnectionsPerMinute: 6,
};

class FakeGemini implements GeminiService {
  ready = true;
  imageCalls = 0;
  lastRequest?: TextRequest;
  reply = 'What do you already know about this topic?';

  async generateText(request: TextRequest): Promise<string> {
    this.lastRequest = request;
    return this.reply;
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

  it('accepts only a valid signed student cookie for live upgrades', async () => {
    const {app} = testApp();
    const response = await request(app).get('/api/health').expect(200);
    const cookie = response.headers['set-cookie'][0].split(';')[0];
    expect(studentSessionFromCookie(cookie, config.sessionSecret)).toBe(response.body.sessionId);
    expect(studentSessionFromCookie(cookie, 'wrong-secret')).toBeUndefined();
    expect(studentSessionFromCookie('ngola_student=forged', config.sessionSecret)).toBeUndefined();
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

  it('allows same-origin admin login on a deployment URL absent from CORS_ORIGINS', async () => {
    const {app} = testApp();
    const deployed = 'ngola-tutor-ai-abc123.run.app';
    expect(config.corsOrigins).not.toContain(`https://${deployed}`);

    await request(app)
      .post('/api/admin/verify')
      .set('Host', deployed)
      .set('Origin', `https://${deployed}`)
      .send({key: config.adminSecret})
      .expect(200);

    // Behind Cloud Run the public hostname arrives via X-Forwarded-Host.
    await request(app)
      .post('/api/admin/verify')
      .set('X-Forwarded-Host', deployed)
      .set('Origin', `https://${deployed}`)
      .send({key: config.adminSecret})
      .expect(200);

    // A different host in the Origin is still cross-origin and must be denied.
    await request(app)
      .post('/api/admin/verify')
      .set('Host', deployed)
      .set('Origin', 'https://attacker.example')
      .send({key: config.adminSecret})
      .expect(403);
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
  it('reports whether live voice is available before requesting device permissions', async () => {
    const {app} = testApp();
    await request(app).get('/api/live').expect(200, {enabled: true});

    const unavailable: GeminiService = {
      ready: false,
      generateText: async () => {
        throw new GeminiUnavailableError('unavailable');
      },
      generateImage: async () => {
        throw new GeminiUnavailableError('unavailable');
      },
    };
    const disabled = testApp({gemini: unavailable}).app;
    const response = await request(disabled).get('/api/live').expect(503);
    expect(response.body.error.code).toBe('LIVE_DISABLED');
  });

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

describe('Gemini failure handling', () => {
  it('fails fast and logs when the configured model is rejected', async () => {
    const retired = JSON.stringify({
      error: {code: 404, message: 'This model models/gemini-2.5-flash is no longer available'},
    });
    let attempts = 0;
    const service = new ManagedGeminiService({...config, geminiApiKey: 'test-key', geminiRetries: 3});
    const failing = async () => {
      attempts++;
      throw new Error(retired);
    };
    const logged: string[] = [];
    const originalError = console.error;
    console.error = (value: string) => void logged.push(value);
    try {
      await expect(
        (service as unknown as {
          execute(operation: () => Promise<unknown>, label: string): Promise<unknown>;
        }).execute(failing, 'generateText')
      ).rejects.toBeInstanceOf(GeminiUnavailableError);
    } finally {
      console.error = originalError;
    }

    expect(attempts).toBe(1);
    const entry = JSON.parse(logged[0]);
    expect(entry.status).toBe(404);
    expect(entry.permanent).toBe(true);
    expect(entry.model).toBe(config.geminiTextModel);
  });

  it('retries transient rate limits before giving up', async () => {
    const service = new ManagedGeminiService({...config, geminiApiKey: 'test-key', geminiRetries: 2});
    let attempts = 0;
    const failing = async () => {
      attempts++;
      throw new Error(JSON.stringify({error: {code: 429, message: 'quota exceeded'}}));
    };
    const originalError = console.error;
    console.error = () => undefined;
    try {
      await expect(
        (service as unknown as {
          execute(operation: () => Promise<unknown>, label: string): Promise<unknown>;
        }).execute(failing, 'generateText')
      ).rejects.toBeInstanceOf(GeminiUnavailableError);
    } finally {
      console.error = originalError;
    }
    expect(attempts).toBe(3);
  });
});

describe('tutor prompt contract', () => {
  it('teaches the model the whiteboard command the client parses', () => {
    expect(TUTOR_SYSTEM_INSTRUCTION).toContain('[GT_WHITEBOARD_COMMAND: {"id"');
    expect(TUTOR_SYSTEM_INSTRUCTION).toContain('GT_MEMORY_UPDATE');
    expect(TUTOR_SYSTEM_INSTRUCTION).toContain('#1a73e8');
  });

  it('appends the student profile instead of replacing the persona', async () => {
    const {app, gemini} = testApp();
    await request
      .agent(app)
      .post('/api/chat')
      .send({
        message: 'Explain a triangle',
        studentContext: {level: 'beginner', isDeafMode: true, subjects: ['math']},
      })
      .expect(200);

    const supplement = gemini.lastRequest?.instruction;
    expect(supplement).toContain('Estimated level: beginner');
    expect(supplement).toContain('Deaf mode is ACTIVE');
    // The persona is prepended inside ManagedGeminiService, so the supplement
    // must never carry it — otherwise a caller could overwrite the contract.
    expect(supplement).not.toContain('GT_WHITEBOARD_COMMAND');
  });

  it('describes the profile as data and omits raw internal keys', () => {
    const supplement = buildStudentProfileSupplement({isVisionAssist: true, level: 'unknown'});
    expect(supplement).toContain('not instructions');
    expect(supplement).not.toContain('isVisionAssist');
    expect(supplement).not.toContain('unknown');
    expect(buildStudentProfileSupplement(undefined)).toBeUndefined();
  });

  it('passes whiteboard commands through safety validation untouched', async () => {
    const {app, gemini} = testApp();
    const command =
      '[GT_WHITEBOARD_COMMAND: {"id": "n1", "type": "square", "x": 80, "y": 100, "content": "Problema", "color": "#1a73e8", "roughness": 0, "fontFamily": 2}]';
    gemini.reply = `Vamos desenhar isto.\n${command}`;
    const response = await request.agent(app).post('/api/chat').send({message: 'Desenha'}).expect(200);
    expect(response.body.response).toContain(command);
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
