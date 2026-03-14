/**
 * Gemini Tutor Backend
 *
 * Built with the Google GenAI SDK (@google/genai).
 * Uses Google Cloud Firestore for chat session persistence.
 *
 * Google Cloud services used:
 *   - Cloud Firestore — stores chat sessions so history survives page reloads
 *   - Cloud Run — serverless deployment (via deploy.sh)
 */

import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';
import { Firestore } from '@google-cloud/firestore';

// Load .env from project root
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const app = express();
const PORT = parseInt(process.env.PORT || '8080');

app.use(cors({ origin: true }));
app.use(express.json({ limit: '10mb' }));

// ─── Configuration ───────────────────────────────────────────────────────────

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
const GCP_PROJECT = process.env.GOOGLE_CLOUD_PROJECT || '';
const MODEL_NAME = 'gemini-2.5-flash-lite';

if (!GEMINI_API_KEY) {
  console.error('❌ GEMINI_API_KEY is not set.');
  console.error('   Get one at https://aistudio.google.com/apikey');
  process.exit(1);
}

const TUTOR_SYSTEM_INSTRUCTION = `You are a friendly, patient AI tutor named "Gemini Tutor".
Your role is to:
- Help students understand problems step-by-step
- Never give direct answers; guide them to discover solutions
- Encourage and motivate them
- Explain concepts clearly in a simple way
- Ask follow-up questions to check understanding
- If you can see their homework (via an image), describe what you see and offer specific help
- Respond in the same language the student uses
Keep responses concise but helpful. Use simple formatting.`;

// ─── Google GenAI SDK Setup ──────────────────────────────────────────────────

const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

console.log(`✅ Using Google GenAI SDK (@google/genai)`);
console.log(`   Model: ${MODEL_NAME}`);

// ─── Google Cloud Firestore Setup ────────────────────────────────────────────
// Firestore stores chat sessions in the "sessions" collection.
// On Cloud Run, auth is automatic via the service account.
// Locally, set GOOGLE_APPLICATION_CREDENTIALS or use `gcloud auth application-default login`.
// If Firestore is unavailable, the app still works (history is in-memory only).

let db: Firestore | null = null;

try {
  db = new Firestore({
    ...(GCP_PROJECT ? { projectId: GCP_PROJECT } : {}),
  });
  // Quick connectivity check
  await db.collection('sessions').limit(1).get();
  console.log(`☁️  Google Cloud Firestore connected`);
  if (GCP_PROJECT) console.log(`   Project: ${GCP_PROJECT}`);
} catch (err: any) {
  console.warn(`⚠️  Firestore unavailable (${err.message?.slice(0, 80)})`);
  console.warn('   Chat history will not be persisted. Set up GCP credentials to enable.');
  db = null;
}

const SESSIONS_COLLECTION = 'sessions';

// ─── Firestore Helpers ───────────────────────────────────────────────────────

interface StoredMessage {
  role: 'user' | 'assistant';
  text: string;
  timestamp: string;
}

async function saveMessageToSession(
  sessionId: string,
  message: StoredMessage
): Promise<void> {
  if (!db) return;
  try {
    const sessionRef = db.collection(SESSIONS_COLLECTION).doc(sessionId);
    const doc = await sessionRef.get();
    if (doc.exists) {
      const data = doc.data()!;
      const messages: StoredMessage[] = data.messages || [];
      messages.push(message);
      await sessionRef.update({
        messages,
        updatedAt: new Date().toISOString(),
        messageCount: messages.length,
      });
    } else {
      await sessionRef.set({
        messages: [message],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        messageCount: 1,
      });
    }
  } catch (err) {
    console.error('Firestore save error:', err);
  }
}

async function getSessionHistory(
  sessionId: string
): Promise<StoredMessage[]> {
  if (!db) return [];
  try {
    const doc = await db.collection(SESSIONS_COLLECTION).doc(sessionId).get();
    if (doc.exists) {
      return (doc.data()?.messages as StoredMessage[]) || [];
    }
  } catch (err) {
    console.error('Firestore read error:', err);
  }
  return [];
}

// ─── Generate Content ────────────────────────────────────────────────────────

async function generateContent(
  prompt: string,
  imageBase64?: string,
  history?: Array<{ role: string; text: string }>
): Promise<string> {
  const contents: Array<{ role: string; parts: any[] }> = [];

  // Add conversation history
  if (history?.length) {
    for (const msg of history) {
      contents.push({
        role: msg.role === 'user' ? 'user' : 'model',
        parts: [{ text: msg.text }],
      });
    }
  }

  // Add current user message
  const parts: any[] = [];
  if (imageBase64) {
    parts.push({
      inlineData: { data: imageBase64, mimeType: 'image/jpeg' },
    });
  }
  parts.push({ text: prompt });
  contents.push({ role: 'user', parts });

  const response = await ai.models.generateContent({
    model: MODEL_NAME,
    contents,
    config: {
      systemInstruction: TUTOR_SYSTEM_INSTRUCTION,
    },
  });

  return response.text || 'I could not generate a response.';
}

// ─── API Routes ──────────────────────────────────────────────────────────────

// Health check — useful for Cloud Run health probes
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'gemini-tutor-backend',
    sdk: 'google-genai',
    googleCloud: {
      firestore: db ? 'connected' : 'unavailable',
      project: GCP_PROJECT || 'not set',
    },
    model: MODEL_NAME,
    timestamp: new Date().toISOString(),
  });
});

// Chat endpoint — text conversation with optional image + Firestore persistence
app.post('/api/chat', async (req, res) => {
  try {
    const { message, image, history, sessionId } = req.body;

    if (!message && !image) {
      res.status(400).json({ error: 'Message or image is required' });
      return;
    }

    // If a sessionId is provided and no history sent, load from Firestore
    let chatHistory = history;
    if (sessionId && (!history || history.length === 0)) {
      const stored = await getSessionHistory(sessionId);
      chatHistory = stored.map(m => ({
        role: m.role === 'assistant' ? 'model' : m.role,
        text: m.text,
      }));
    }

    const userText = message || 'Please analyze this image and help me understand it.';
    const response = await generateContent(
      userText,
      image || undefined,
      chatHistory
    );

    // Persist both messages to Firestore
    if (sessionId) {
      const now = new Date().toISOString();
      await saveMessageToSession(sessionId, { role: 'user', text: userText, timestamp: now });
      await saveMessageToSession(sessionId, { role: 'assistant', text: response, timestamp: now });
    }

    res.json({ response });
  } catch (error: any) {
    console.error('Chat error:', error);
    res.status(500).json({
      error: error.message || 'Internal server error',
    });
  }
});

// Get session history from Firestore
app.get('/api/sessions/:sessionId', async (req, res) => {
  try {
    const messages = await getSessionHistory(req.params.sessionId);
    res.json({ sessionId: req.params.sessionId, messages });
  } catch (error: any) {
    console.error('Session fetch error:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// Analyze homework image
app.post('/api/analyze', async (req, res) => {
  try {
    const { image } = req.body;

    if (!image) {
      res.status(400).json({ error: 'Image is required' });
      return;
    }

    const response = await generateContent(
      `Analyze this homework or study material carefully. 
       1. Describe what you see (subject, type of problems, etc.)
       2. Identify any specific questions or exercises visible
       3. Offer to help the student understand the material
       Be encouraging and supportive.`,
      image
    );

    res.json({ analysis: response });
  } catch (error: any) {
    console.error('Analyze error:', error);
    res.status(500).json({
      error: error.message || 'Internal server error',
    });
  }
});

// ─── Serve Frontend Static Files (Production) ───────────────────────────────

const distPath = path.join(__dirname, '..', 'dist');
app.use(express.static(distPath));
app.get('*', (_req, res) => {
  res.sendFile(path.join(distPath, 'index.html'));
});

// ─── Start Server ────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`\n🚀 Gemini Tutor Backend running on port ${PORT}`);
  console.log(`   Health:   http://localhost:${PORT}/api/health`);
  console.log(`   Chat:     POST http://localhost:${PORT}/api/chat`);
  console.log(`   Sessions: GET  http://localhost:${PORT}/api/sessions/:id`);
  console.log(`   Analyze:  POST http://localhost:${PORT}/api/analyze\n`);
});
