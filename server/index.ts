/**
 * Gemini Tutor Backend
 *
 * Criterion 1 : Gemini model — gemini-2.0-flash (text) + gemini-2.0-flash-preview-image-generation (image)
 * Criterion 2 : Google GenAI SDK (@google/genai)
 * Criterion 3 : Google Cloud — Cloud Run (deployment) + Cloud Firestore (persistence) + Cloud Build (CI/CD)
 *
 * Features:
 *   - /api/chat        — text chat with Google Search grounding + auto image generation
 *   - /api/generate-image — on-demand image generation for any concept
 *   - /api/save-voice  — persist voice transcripts to Firestore
 *   - /api/sessions/:id — load session history
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
app.use(express.json({ limit: '20mb' }));

// ─── Configuration ────────────────────────────────────────────────────────────

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
const GCP_PROJECT    = process.env.GOOGLE_CLOUD_PROJECT || '';

// Text + reasoning model (supports Google Search grounding)
const TEXT_MODEL  = 'gemini-2.5-flash';
// Image generation model — produces images from text prompts.
// Used to satisfy the hackathon requirement: "leverage... the creative power
// of video/image generation" alongside the Gemini Live API.
const IMAGE_MODEL = 'gemini-2.5-flash-preview-image-generation';

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
- If you can see their homework (via an image), describe it and offer specific help
- Use the googleSearch tool to answer factual or current-events questions accurately
- Respond in the same language the student uses
Keep responses concise but helpful. Use markdown (bold, lists, code blocks) where it aids clarity.`;

// Keywords that strongly suggest the student would benefit from a visual
const VISUAL_TOPIC_RE = /\b(explain|how does|what is|describe|show|draw|diagram|illustrate|visualize|cycle|process|system|structure|anatomy|cell|molecule|atom|circuit|photosynthesis|mitosis|meiosis|krebs|dna|protein|evolution|ecosystem|solar system|water cycle|carbon cycle|nitrogen cycle|food chain|neural network|algorithm|data structure|sorting|equation|geometry|triangle|function|derivative|integral|wave|gravity|quantum|thermodynamics|osmosis|diffusion|respiration|digestion|heart|brain|lung|skeleton|muscle|revolution|empire|civilization|volcano|earthquake|plate tectonic|weather|ocean|atmosphere|electromagnetic|newton|einstein|pythagoras|archimedes)\b/i;

// ─── Google GenAI SDK (Criterion 2) ──────────────────────────────────────────

const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
console.log(`✅  GenAI SDK | text: ${TEXT_MODEL} | image: ${IMAGE_MODEL}`);

// ─── Cloud Firestore (Criterion 3) ───────────────────────────────────────────

let db: Firestore | null = null;
try {
  db = new Firestore({ ...(GCP_PROJECT ? { projectId: GCP_PROJECT } : {}) });
  await db.collection('sessions').limit(1).get();
  console.log(`☁️   Firestore connected${GCP_PROJECT ? ' | project: ' + GCP_PROJECT : ''}`);
} catch (err: any) {
  console.warn(`⚠️   Firestore unavailable (${err.message?.slice(0, 80)})`);
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

// ─── Text generation (with Google Search grounding) ──────────────────────────

async function generateText(
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
    model: TEXT_MODEL,
    contents,
    config: {
      systemInstruction: TUTOR_SYSTEM_INSTRUCTION,
      tools: [{ googleSearch: {} }],
    },
  });

  return response.text || 'I could not generate a response.';
}

// ─── Image generation (Criterion 1 — creative image output) ──────────────────
//
// Uses gemini-2.0-flash-preview-image-generation with responseModalities IMAGE+TEXT.
// This is the "creative power of video/image generation" required by the hackathon.
// The model generates an educational diagram/illustration alongside a caption.

interface GeneratedImage {
  imageBase64: string;
  mimeType: string;
  caption: string;
}

async function generateImage(concept: string, tutorContext?: string): Promise<GeneratedImage | null> {
  try {
    const prompt = [
      `Create a clear, educational diagram or illustration that visually explains: "${concept}".`,
      tutorContext ? `Educational context: ${tutorContext.slice(0, 300)}` : '',
      'Requirements: clean and labeled, suitable for a student, white or light background, show key components and relationships clearly.',
    ].filter(Boolean).join(' ');

    const response = await ai.models.generateContent({
      model: IMAGE_MODEL,
      contents: prompt,
      config: {
        // Both TEXT (caption) and IMAGE output — full multimodal generation
        responseModalities: ['TEXT', 'IMAGE'],
      },
    });

    let imageBase64 = '';
    let mimeType    = 'image/png';
    let caption     = '';

    for (const part of (response.candidates?.[0]?.content?.parts || [])) {
      if (part.inlineData?.mimeType?.startsWith('image/')) {
        imageBase64 = part.inlineData.data || '';
        mimeType    = part.inlineData.mimeType;
      } else if (part.text) {
        caption += part.text;
      }
    }

    if (!imageBase64) return null;
    return { imageBase64, mimeType, caption: caption.trim() };
  } catch (err: any) {
    console.error('Image generation error:', err.message);
    return null;
  }
}

// ─── Routes ───────────────────────────────────────────────────────────────────

app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'gemini-tutor-backend',
    models: { text: TEXT_MODEL, image: IMAGE_MODEL },
    features: ['googleSearch', 'imageGeneration', 'liveAudio', 'firestore'],
    googleCloud: { firestore: db ? 'connected' : 'unavailable', project: GCP_PROJECT || 'not set' },
    timestamp: new Date().toISOString(),
  });
});

// ── Text chat + optional auto image generation ─────────────────────────────────
app.post('/api/chat', async (req, res) => {
  try {
    const { message, image, history, sessionId, generateImage: wantsImage } = req.body;
    if (!message && !image) { res.status(400).json({ error: 'Message or image required' }); return; }

    let chatHistory = history;
    if (sessionId && (!history || !history.length)) {
      const stored = await getHistory(sessionId);
      chatHistory = stored.map(m => ({ role: m.role === 'assistant' ? 'model' : m.role, text: m.text }));
    }

    const userText   = message || 'Please analyze this image and help me understand it.';
    const textResponse = await generateText(userText, image, chatHistory);

    // Auto-detect if a generated image would help understanding.
    // Triggered when: caller requests it explicitly OR the topic matches visual keywords.
    const shouldGenerateImg = wantsImage || VISUAL_TOPIC_RE.test(userText);
    let generatedImg: GeneratedImage | null = null;

    if (shouldGenerateImg) {
      // Extract the core concept from the user's message for a better image prompt
      const concept = userText.slice(0, 200);
      generatedImg = await generateImage(concept, textResponse);
    }

    if (sessionId) {
      const now = new Date().toISOString();
      await saveMessages(sessionId, [
        { role: 'user', text: userText, timestamp: now, source: 'text' },
        { role: 'assistant', text: textResponse, timestamp: now, source: 'text' },
      ]);
    }

    res.json({
      response: textResponse,
      generatedImage: generatedImg?.imageBase64 || null,
      generatedImageMime: generatedImg?.mimeType || null,
      imageCaption: generatedImg?.caption || null,
    });
  } catch (err: any) {
    console.error('Chat error:', err);
    res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

// ── On-demand image generation (called by frontend "Visualize" button) ─────────
app.post('/api/generate-image', async (req, res) => {
  try {
    const { concept, context } = req.body;
    if (!concept) { res.status(400).json({ error: 'concept is required' }); return; }

    const result = await generateImage(concept, context);
    if (!result) { res.status(500).json({ error: 'Image generation returned no image' }); return; }

    res.json({
      imageBase64: result.imageBase64,
      mimeType: result.mimeType,
      caption: result.caption,
    });
  } catch (err: any) {
    console.error('Generate image error:', err);
    res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

// ── Save voice transcripts ─────────────────────────────────────────────────────
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

// ── Session history ────────────────────────────────────────────────────────────
app.get('/api/sessions/:sessionId', async (req, res) => {
  try {
    const messages = await getHistory(req.params.sessionId);
    res.json({ sessionId: req.params.sessionId, messages });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

// ─── Static frontend (production) ────────────────────────────────────────────

const distPath = path.join(__dirname, '..', 'dist');
app.use(express.static(distPath));
app.get('*', (_req, res) => res.sendFile(path.join(distPath, 'index.html')));

// ─── Start ────────────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`\n🚀  Gemini Tutor running on port ${PORT}`);
  console.log(`    Health      : http://localhost:${PORT}/api/health`);
  console.log(`    Chat        : POST http://localhost:${PORT}/api/chat`);
  console.log(`    Image Gen   : POST http://localhost:${PORT}/api/generate-image`);
  console.log(`    Voice Save  : POST http://localhost:${PORT}/api/save-voice`);
  console.log(`    History     : GET  http://localhost:${PORT}/api/sessions/:id\n`);
});
