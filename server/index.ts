/**
 * Gemini Tutor Backend
 *
 * Criterion 1 : Gemini model (gemini-2.0-flash)
 * Criterion 2 : Google GenAI SDK (@google/genai)
 * Criterion 3 : Google Cloud — Cloud Run (deployment) + Cloud Firestore (persistence)
 *
 * Tools: googleSearch grounding keeps answers up-to-date.
 */

import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';
import { Firestore } from '@google-cloud/firestore';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const app  = express();
const PORT = parseInt(process.env.PORT || '8080');

app.use(cors({ origin: true }));
app.use(express.json({ limit: '10mb' }));

// ─── Config ───────────────────────────────────────────────────────────────────

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
const GCP_PROJECT    = process.env.GOOGLE_CLOUD_PROJECT || '';
const MODEL_NAME     = 'gemini-2.5-flash';   // supports googleSearch grounding

if (!GEMINI_API_KEY) {
  console.error('❌  GEMINI_API_KEY is not set. Get one at https://aistudio.google.com/apikey');
  process.exit(1);
}

const TUTOR_SYSTEM_INSTRUCTION = `You are a friendly, patient AI tutor named "Gemini Tutor".
Your role is to:
- Help students understand problems step-by-step
- Never give direct answers; guide them to discover solutions
- Encourage and motivate them
- Explain concepts clearly using simple language
- Ask follow-up questions to check understanding
- If you can see their homework (via an image), describe what you see and offer specific help
- When answering factual questions, use the googleSearch tool to provide accurate, up-to-date information
- Respond in the same language the student uses
Keep responses concise but helpful. Use markdown formatting (bold, lists, code blocks) where appropriate.`;

// ─── Google GenAI SDK (Criterion 2) ──────────────────────────────────────────

const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
console.log(`✅  Google GenAI SDK | model: ${MODEL_NAME}`);

// ─── Cloud Firestore (Criterion 3) ───────────────────────────────────────────

let db: Firestore | null = null;
try {
  db = new Firestore({ ...(GCP_PROJECT ? { projectId: GCP_PROJECT } : {}) });
  await db.collection('sessions').limit(1).get();
  console.log(`☁️   Firestore connected${GCP_PROJECT ? ' | project: ' + GCP_PROJECT : ''}`);
} catch (err: any) {
  console.warn(`⚠️   Firestore unavailable (${err.message?.slice(0, 80)})`);
  console.warn('    History will not persist. Set GCP credentials to enable.');
  db = null;
}

const SESSIONS_COL = 'sessions';

// ─── Firestore helpers ────────────────────────────────────────────────────────

export interface StoredMessage {
  role: 'user' | 'assistant';
  text: string;
  timestamp: string;
  source?: 'text' | 'voice';
}

async function saveMessages(sessionId: string, msgs: StoredMessage[]): Promise<void> {
  if (!db || !msgs.length) return;
  try {
    const ref = db.collection(SESSIONS_COL).doc(sessionId);
    const doc = await ref.get();
    if (doc.exists) {
      const existing: StoredMessage[] = doc.data()!.messages || [];
      const merged = [...existing, ...msgs];
      await ref.update({ messages: merged, updatedAt: new Date().toISOString(), messageCount: merged.length });
    } else {
      await ref.set({ messages: msgs, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), messageCount: msgs.length });
    }
  } catch (err) { console.error('Firestore save error:', err); }
}

async function getHistory(sessionId: string): Promise<StoredMessage[]> {
  if (!db) return [];
  try {
    const doc = await db.collection(SESSIONS_COL).doc(sessionId).get();
    return doc.exists ? ((doc.data()?.messages as StoredMessage[]) || []) : [];
  } catch (err) { console.error('Firestore read error:', err); return []; }
}

// ─── Generate content with Google Search grounding ────────────────────────────

async function generateContent(
  prompt: string,
  imageBase64?: string,
  history?: Array<{ role: string; text: string }>
): Promise<string> {
  const contents: Array<{ role: string; parts: any[] }> = [];

  if (history?.length) {
    for (const msg of history) {
      contents.push({ role: msg.role === 'user' ? 'user' : 'model', parts: [{ text: msg.text }] });
    }
  }

  const parts: any[] = [];
  if (imageBase64) parts.push({ inlineData: { data: imageBase64, mimeType: 'image/jpeg' } });
  parts.push({ text: prompt });
  contents.push({ role: 'user', parts });

  const response = await ai.models.generateContent({
    model: MODEL_NAME,
    contents,
    config: {
      systemInstruction: TUTOR_SYSTEM_INSTRUCTION,
      // Google Search grounding — keeps answers factual and up-to-date
      tools: [{ googleSearch: {} }],
    },
  });

  return response.text || 'I could not generate a response.';
}

// ─── Routes ───────────────────────────────────────────────────────────────────

app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok', service: 'gemini-tutor-backend', sdk: 'google-genai',
    features: ['googleSearch', 'firestore', 'liveAudio'],
    googleCloud: { firestore: db ? 'connected' : 'unavailable', project: GCP_PROJECT || 'not set' },
    model: MODEL_NAME, timestamp: new Date().toISOString(),
  });
});

// Text chat — with history + Google Search grounding
app.post('/api/chat', async (req, res) => {
  try {
    const { message, image, history, sessionId } = req.body;
    if (!message && !image) { res.status(400).json({ error: 'Message or image required' }); return; }

    let chatHistory = history;
    if (sessionId && (!history || !history.length)) {
      const stored = await getHistory(sessionId);
      chatHistory = stored.map(m => ({ role: m.role === 'assistant' ? 'model' : m.role, text: m.text }));
    }

    const userText = message || 'Please analyze this image and help me understand it.';
    const response = await generateContent(userText, image, chatHistory);

    if (sessionId) {
      const now = new Date().toISOString();
      await saveMessages(sessionId, [
        { role: 'user', text: userText, timestamp: now, source: 'text' },
        { role: 'assistant', text: response, timestamp: now, source: 'text' },
      ]);
    }

    res.json({ response });
  } catch (err: any) {
    console.error('Chat error:', err);
    res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

// Save voice transcripts (called after Live API turn completes)
app.post('/api/save-voice', async (req, res) => {
  try {
    const { sessionId, messages } = req.body;
    if (!sessionId || !messages?.length) { res.status(400).json({ error: 'sessionId and messages required' }); return; }

    const now = new Date().toISOString();
    const toSave: StoredMessage[] = messages.map((m: any) => ({
      role: m.role as 'user' | 'assistant',
      text: m.text,
      timestamp: now,
      source: 'voice' as const,
    }));

    await saveMessages(sessionId, toSave);
    res.json({ saved: toSave.length });
  } catch (err: any) {
    console.error('Save voice error:', err);
    res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

// Get session history
app.get('/api/sessions/:sessionId', async (req, res) => {
  try {
    const messages = await getHistory(req.params.sessionId);
    res.json({ sessionId: req.params.sessionId, messages });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

// ─── Static (production) ─────────────────────────────────────────────────────

const distPath = path.join(__dirname, '..', 'dist');
app.use(express.static(distPath));
app.get('*', (_req, res) => res.sendFile(path.join(distPath, 'index.html')));

// ─── Start ────────────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`\n🚀  Gemini Tutor running on port ${PORT}`);
  console.log(`    Health : http://localhost:${PORT}/api/health`);
  console.log(`    Chat   : POST http://localhost:${PORT}/api/chat`);
  console.log(`    Voice  : POST http://localhost:${PORT}/api/save-voice`);
  console.log(`    History: GET  http://localhost:${PORT}/api/sessions/:id\n`);
});
