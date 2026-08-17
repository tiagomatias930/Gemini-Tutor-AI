/**
 * Ngola Tutor Backend
 *
 * Criterion 1 : Gemini model — gemini-2.5-flash (text) + gemini-2.5-flash-image (image)
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
import { validateInput, validateOutput, strictSafetySettings } from './safety.js';
import { telemetry } from './telemetry.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const app = express();
const PORT = parseInt(process.env.PORT || '8080');

app.use(cors({ origin: true }));
app.use(express.json({ limit: '100mb' }));

// ─── Configuration ────────────────────────────────────────────────────────────

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || ' ';
const GCP_PROJECT = process.env.GOOGLE_CLOUD_PROJECT || '';
const ADMIN_SECRET = process.env.ADMIN_SECRET || 'ngola-admin-2025';

// Admin authentication middleware
function requireAdminAuth(req: express.Request, res: express.Response, next: express.NextFunction) {
  const authHeader = req.headers.authorization;
  const adminKeyHeader = req.headers['x-admin-key'];
  const queryKey = req.query.adminKey as string | undefined;

  let providedKey = '';
  if (authHeader && authHeader.startsWith('Bearer ')) {
    providedKey = authHeader.slice(7).trim();
  } else if (typeof adminKeyHeader === 'string') {
    providedKey = adminKeyHeader.trim();
  } else if (queryKey) {
    providedKey = queryKey.trim();
  }

  if (!providedKey || providedKey !== ADMIN_SECRET) {
    res.status(401).json({
      error: 'Acesso não autorizado. Chave de administração inválida ou em falta.'
    });
    return;
  }
  next();
}

// Text + reasoning model (supports Google Search grounding)
const TEXT_MODEL = 'gemini-2.5-flash';
// Image generation model — produces images from text prompts.
// Used to satisfy the hackathon requirement: "leverage... the creative power
// of video/image generation" alongside the Gemini Live API.
const IMAGE_MODEL = 'gemini-2.5-flash-image';

const TUTOR_SYSTEM_INSTRUCTION = `You are a friendly, patient AI tutor named "Ngola Tutor".

## LANGUAGE RULES (HIGHEST PRIORITY)
- DETECT the language of the student's FIRST message and use THAT language for ALL your responses.
- If the student writes/speaks in Portuguese, respond in Portuguese pt-PT. If in English, respond in English en-GB. If in French, respond in French fr-FR. Match ANY language.
- NEVER default to Spanish unless the student explicitly writes or speaks in Spanish.
- If Portuguese and Spanish seem ambiguous, ALWAYS prefer Portuguese.
- If the student switches languages mid-conversation, switch with them immediately.
- For voice/audio sessions: if you cannot clearly detect the language, default to Portuguese, NOT Spanish.

## SESSION START — ADAPTIVE LEVEL DETECTION & INTERACTION
When the conversation begins, introduce yourself and prompt the user for the topic they want to learn.
DO NOT explicitly ask the student for their level (Beginner, Intermediate, Advanced) or specific learning goals.
Instead, analyze the student's messages, vocabulary, complexity of questions, and background knowledge to dynamically deduce (predict) their level and goals. Immediately adapt your explanation depth, pace, and teaching style to this profile.
Emit a context update tag once you have an initial estimation (typically in your first or second response), and update it if your estimation changes:
\`[GT_CONTEXT_UPDATE: {"level": "beginner|intermediate|advanced", "subjects": ["<subject>"], "goal": "<specific goal>"}]\`
Do not read this tag aloud in audio sessions.

## STUDENT CONTEXTUAL MEMORY
Maintain a persistent profile for the student:
- **Language**: Use the student's language (PT-PT, EN-GB, etc.).
- **Strengths/Struggles**: Track what they know and where they fail.
- **Pedagogical Pace**: Adjust complexity dynamically.

## ACCESSIBILITY & VISION (PHASE 3)
- **Blind Mode ('isVisionAssist')**: ACT AS DIGITAL EYES. Use detailed clock-face spatial descriptions. Prioritize audio-friendly explanations.
- **Intelligent Alerts**: Watch for student fatigue (yawning, looking away) or environmental hazards. Warn about safety and suggest breaks.
- **Deaf Mode ('isDeafMode')**: Use visual language and trigger avatar gestures with keywords.

## TEACHING METHODOLOGY (SOCRATIC & STEP-BY-STEP)
- **GUIDE, DON'T TELL**: Use questions and hints.
- **Step-by-Step**: Break complex problems into tiny, manageable questions.
- **Visual Feedback**: If vision is active, reference what you see (e.g., "I see you're using a '+' instead of a '-', why is that?").

## INTERACTIVE WHITEBOARD COMMANDS
You can draw beautiful, highly professional diagrams, flowcharts, or equations on the student's Excalidraw whiteboard to explain concepts.
Always output commands in this format (multiple commands per turn allowed):
\`[GT_WHITEBOARD_COMMAND: {"id": "unique_id", "type": "square|circle|text|arrow|line", "x": 100, "y": 100, "width": 120, "height": 60, "content": "LabelText", "color": "#1a73e8", "roughness": 0, "fontFamily": 2, "fillStyle": "solid", "backgroundColor": "#e8f0fe"}]\`

### Design Principles:
- ALWAYS aim for a clean, professional corporate look: use \`"roughness": 0\` (perfect straight lines) and \`"fontFamily": 2\` (modern Helvetica/sans-serif font).
- Layout elements in a structured, aligned manner with appropriate spacing and alignment.
- Connect related shapes with arrows (\`"type": "arrow"\`) to represent flow or links.
- Use a clean color palette:
  - **Blue** (\`#1a73e8\`, fill \`#e8f0fe\`): General concepts, structural containers.
  - **Green** (\`#34a853\`, fill \`#e6f4ea\`): Stable states, correct steps, key definitions.
  - **Red** (\`#ea4335\`, fill \`#fce8e6\`): Critical areas, attention points, warnings.
  - **Yellow** (\`#fbbc05\`, fill \`#fef7e0\`): Cautions, intermediate steps.
  - **Purple** (\`#9c27b0\`, fill \`#f3e5f5\`): Auxiliary structures, annotations.
- Pair filled boxes with \`"fillStyle": "solid"\` or \`"cross-hatch"\` and the corresponding soft background fill color.

### Examples:
- Two-step flow:
  \`[GT_WHITEBOARD_COMMAND: {"id": "n1", "type": "square", "x": 80, "y": 100, "width": 160, "height": 60, "content": "Problema", "color": "#1a73e8", "roughness": 0, "fontFamily": 2, "fillStyle": "solid", "backgroundColor": "#e8f0fe"}]\`
  \`[GT_WHITEBOARD_COMMAND: {"id": "a1", "type": "arrow", "x": 240, "y": 130, "width": 80, "height": 0, "color": "#1a73e8", "roughness": 0}]\`
  \`[GT_WHITEBOARD_COMMAND: {"id": "n2", "type": "square", "x": 320, "y": 100, "width": 160, "height": 60, "content": "Solução", "color": "#34a853", "roughness": 0, "fontFamily": 2, "fillStyle": "solid", "backgroundColor": "#e6f4ea"}]\`
- Warning Step:
  \`[GT_WHITEBOARD_COMMAND: {"id": "w1", "type": "square", "x": 80, "y": 220, "width": 200, "height": 60, "content": "Atenção: divisão por zero", "color": "#ea4335", "roughness": 0, "fontFamily": 2, "fillStyle": "cross-hatch", "backgroundColor": "#fce8e6"}]\`
- You can output multiple command tags in one turn to draw complete, comprehensive educational layouts.

## ACCESSIBILITY & VIDEO SUPPORT
- **Sign Language Avatar**: If the student uses "Deaf Mode", use clear, visual language. The avatar will react to keywords like "Certo", "Atenção", "Explica", "Penso".
- **Video Analysis**: If the student uploads a video (MP4), analyze it frame-by-frame if necessary to provide a pedagogical narration. Identify key moments and explain what's happening.

## FORMATTING
Keep responses concise. Use markdown. If the student uses voice, keep explanations short and rhythmic.`;

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

interface FileAttachment {
  name: string;
  mimeType: string;
  data: string;   // base64 for binary files, plain text for text files
  isText: boolean;
}

async function generateText(
  prompt: string,
  imageBase64?: string,
  history?: Array<{ role: string; text: string }>,
  fileData?: FileAttachment,
  effectiveInstruction?: string
): Promise<string> {
  const contents: Array<{ role: string; parts: any[] }> = [];

  if (history?.length) {
    for (const msg of history) {
      contents.push({ role: msg.role === 'user' ? 'user' : 'model', parts: [{ text: msg.text }] });
    }
  }

  const parts: any[] = [];
  if (imageBase64) parts.push({ inlineData: { data: imageBase64, mimeType: 'image/jpeg' } });

  if (fileData) {
    if (fileData.isText) {
      // Inject raw text content into the prompt so the model can read it
      const fileContent = `[Arquivo recebido: ${fileData.name}]\n\n${fileData.data}\n\n---\n\n`;
      prompt = fileContent + (prompt || 'Por favor lê este ficheiro e atua como meu guia pedagógico, ajudando-me a compreender o conteúdo passo a passo.');
    } else {
      // PDF or binary image — send as inlineData (Gemini supports PDF natively)
      parts.push({ inlineData: { data: fileData.data, mimeType: fileData.mimeType } });
    }
  }

  parts.push({ text: prompt });
  contents.push({ role: 'user', parts });

  const response = await ai.models.generateContent({
    model: TEXT_MODEL,
    contents,
    config: {
      systemInstruction: effectiveInstruction || TUTOR_SYSTEM_INSTRUCTION,
      tools: [{ googleSearch: {} }],
      safetySettings: strictSafetySettings,
    },
  });

  return response.text || 'I could not generate a response.';
}

// ─── Image generation (Criterion 1 — creative image output) ──────────────────
//
// Uses gemini-2.5-flash-preview-image-generation with responseModalities IMAGE+TEXT.
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
        safetySettings: strictSafetySettings,
      },
    });

    let imageBase64 = '';
    let mimeType = 'image/png';
    let caption = '';

    for (const part of (response.candidates?.[0]?.content?.parts || [])) {
      if (part.inlineData?.mimeType?.startsWith('image/')) {
        imageBase64 = part.inlineData.data || '';
        mimeType = part.inlineData.mimeType;
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
  const startTime = Date.now();
  try {
    const { 
      message, image, history, sessionId, generateImage: wantsImage, 
      fileData, studentContext, locationConsent, cacheEnabled, country, city 
    } = req.body;
    if (!message && !image && !fileData) { 
      telemetry.recordRequest(Date.now() - startTime, false);
      res.status(400).json({ error: 'Message, image, or file required' }); 
      return; 
    }

    let chatHistory = history;
    if (sessionId && (!history || !history.length)) {
      const stored = await getHistory(sessionId);
      chatHistory = stored.map(m => ({ role: m.role === 'assistant' ? 'model' : m.role, text: m.text }));
    }

    // Build effective system instruction with student context
    let effectiveInstruction = TUTOR_SYSTEM_INSTRUCTION;
    if (studentContext) {
      const lines: string[] = ['\n\n--- Student Profile (this session) ---'];
      if (studentContext.language) lines.push(`Language: ${studentContext.language}`);
      if (studentContext.level && studentContext.level !== 'unknown') lines.push(`Level: ${studentContext.level}`);
      if (studentContext.subjects?.length) lines.push(`Subjects: ${studentContext.subjects.join(', ')}`);
      if (studentContext.learningStyle && studentContext.learningStyle !== 'unknown') lines.push(`Learning style: ${studentContext.learningStyle}`);
      if (studentContext.strengths?.length) lines.push(`Strengths: ${studentContext.strengths.join(', ')}`);
      if (studentContext.struggles?.length) lines.push(`Struggles: ${studentContext.struggles.join(', ')}`);
      if (studentContext.topicsCovered?.length) lines.push(`Topics covered: ${studentContext.topicsCovered.join(', ')}`);
      if (studentContext.isDeafMode) lines.push('Mode: DEAF/MUTE MODE ACTIVE. Use visual descriptions, simple sentence structures, and more emojis. Prioritize the gestural avatar keywords (Certo, Atenção, Explica, Penso).');
      if (studentContext.isVisionAssist) lines.push('Mode: VISION ASSIST ACTIVE. Act as digital eyes. Use clock-face spatial descriptions and warn about hazards.');
      if (!studentContext.triageComplete) lines.push('Note: This is the START of the session. Welcome the student, ask what they want to study, and estimate their level and goals.');
      lines.push('--- End Student Profile ---');
      effectiveInstruction += lines.join('\n');
    }

    const userText = message || (fileData ? `Analisa este ficheiro: ${fileData.name}` : 'Please analyze this image and help me understand it.');

    // ── Input Safety & Policy Guardrails (Pre-flight Validation) ──
    const inputSafety = validateInput(userText);
    if (!inputSafety.safe) {
      const refusalResponse = inputSafety.response || 'Prompt blocked due to security policies.';
      
      if (sessionId) {
        const now = new Date().toISOString();
        await saveMessages(sessionId, [
          { role: 'user', text: userText, timestamp: now, source: 'text' },
          { role: 'assistant', text: refusalResponse, timestamp: now, source: 'text' },
        ]);
        telemetry.trackSession(sessionId, req, {
          tokensUsed: telemetry.estimateTokens(userText + refusalResponse),
          locationConsent, cacheEnabled, country, city
        });
      }
      
      telemetry.recordRequest(Date.now() - startTime, true);
      res.json({
        response: refusalResponse,
        generatedImage: null,
        generatedImageMime: null,
        imageCaption: null,
      });
      return;
    }

    const textResponseRaw = await generateText(userText, image, chatHistory, fileData, effectiveInstruction);

    // ── Output Alignment & Socratic Guardrails (Post-flight Validation) ──
    const outputSafety = validateOutput(textResponseRaw, userText);
    const textResponse = outputSafety.response;

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

      const promptTokens = telemetry.estimateTokens(userText + effectiveInstruction);
      const completionTokens = telemetry.estimateTokens(textResponse + (generatedImg ? ' [Image]' : ''));
      telemetry.trackSession(sessionId, req, {
        tokensUsed: promptTokens + completionTokens,
        promptTokens,
        completionTokens,
        locationConsent,
        cacheEnabled,
        country,
        city
      });
    }

    telemetry.recordRequest(Date.now() - startTime, true);

    res.json({
      response: textResponse,
      generatedImage: generatedImg?.imageBase64 || null,
      generatedImageMime: generatedImg?.mimeType || null,
      imageCaption: generatedImg?.caption || null,
    });
  } catch (err: any) {
    telemetry.recordRequest(Date.now() - startTime, false);
    console.error('Chat error:', err);
    res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

// ── On-demand image generation (called by frontend "Visualize" button) ─────────
app.post('/api/generate-image', async (req, res) => {
  const startTime = Date.now();
  try {
    const { concept, context, sessionId, locationConsent, cacheEnabled } = req.body;
    if (!concept) { 
      telemetry.recordRequest(Date.now() - startTime, false);
      res.status(400).json({ error: 'concept is required' }); 
      return; 
    }

    const result = await generateImage(concept, context);
    if (!result) { 
      telemetry.recordRequest(Date.now() - startTime, false);
      res.status(500).json({ error: 'Image generation returned no image' }); 
      return; 
    }

    if (sessionId) {
      telemetry.trackSession(sessionId, req, {
        tokensUsed: 120, // Estimated token weight for image synthesis
        locationConsent,
        cacheEnabled
      });
    }

    telemetry.recordRequest(Date.now() - startTime, true);

    res.json({
      imageBase64: result.imageBase64,
      mimeType: result.mimeType,
      caption: result.caption,
    });
  } catch (err: any) {
    telemetry.recordRequest(Date.now() - startTime, false);
    console.error('Generate image error:', err);
    res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

// ── Save voice transcripts ─────────────────────────────────────────────────────
app.post('/api/save-voice', async (req, res) => {
  const startTime = Date.now();
  try {
    const { sessionId, messages, locationConsent, cacheEnabled, country, city } = req.body;
    if (!sessionId || !messages?.length) { 
      telemetry.recordRequest(Date.now() - startTime, false);
      res.status(400).json({ error: 'sessionId and messages required' }); 
      return; 
    }

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

// ── Telemetry Heartbeat (tracks session duration & location status) ───────────
app.post('/api/telemetry/heartbeat', (req, res) => {
  try {
    const { sessionId, durationSeconds, locationConsent, cacheEnabled, country, city } = req.body;
    if (!sessionId) {
      res.status(400).json({ error: 'sessionId required' });
      return;
    }

    const session = telemetry.recordHeartbeat(sessionId, req, {
      durationSeconds,
      locationConsent,
      cacheEnabled,
      country,
      city
    });

    res.json({
      status: 'ok',
      activeDurationSeconds: session.durationSeconds,
      totalTokens: session.totalTokens,
      isOnline: true
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

// ── Admin Authentication & Telemetry / User Data Endpoints ────────────────────

// Verify Admin Key
app.post('/api/admin/verify', (req, res) => {
  const { key } = req.body || {};
  if (key && typeof key === 'string' && key.trim() === ADMIN_SECRET) {
    res.json({ success: true, message: 'Autenticado com sucesso.' });
  } else {
    res.status(401).json({ success: false, error: 'Chave de administração inválida.' });
  }
});

// Telemetry & KPI Summary (Protected: strictly for Admin)
app.get('/api/telemetry/kpi', requireAdminAuth, (_req, res) => {
  try {
    const summary = telemetry.getKPISummary();
    res.json({
      status: 'ok',
      ...summary
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

// Alias for Admin Metrics (Protected)
app.get('/api/admin/metrics', requireAdminAuth, (_req, res) => {
  res.json(telemetry.getKPISummary());
});

// Get all user sessions & detailed telemetry (Protected)
app.get('/api/admin/sessions', requireAdminAuth, (_req, res) => {
  try {
    const sessions = telemetry.getAllSessions();
    res.json({
      status: 'ok',
      count: sessions.length,
      sessions
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

// Inspect a specific user session & conversation history (Protected)
app.get('/api/admin/session/:sessionId', requireAdminAuth, async (req, res) => {
  try {
    const sessionId = req.params.sessionId;
    const sessionTelemetry = telemetry.getSession(sessionId);
    const messages = await getHistory(sessionId);
    res.json({
      sessionId,
      telemetry: sessionTelemetry || null,
      messages
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

// ─── LGPD Compliance Endpoints ──────────────────────────────────────────────

// DELETE session data (Right to Deletion)
app.delete('/api/admin/session/:id', (req, res) => {
  const adminKey = req.headers['x-admin-key'] || req.headers['authorization']?.replace('Bearer ', '');
  if (adminKey !== ADMIN_SECRET) return res.status(403).json({ error: 'Unauthorized' });

  const deleted = telemetry.deleteSession(req.params.id);
  res.json({ success: deleted, message: deleted ? 'Sessão eliminada com sucesso (LGPD Art. 18, VI)' : 'Sessão não encontrada' });
});

// POST anonymize session (Right to Anonymization)
app.post('/api/admin/session/:id/anonymize', (req, res) => {
  const adminKey = req.headers['x-admin-key'] || req.headers['authorization']?.replace('Bearer ', '');
  if (adminKey !== ADMIN_SECRET) return res.status(403).json({ error: 'Unauthorized' });

  const anonymized = telemetry.anonymizeSession(req.params.id);
  res.json({ success: anonymized, message: anonymized ? 'Sessão anonimizada com sucesso (LGPD Art. 18, IV)' : 'Sessão não encontrada' });
});

// GET export session data (Data Portability)
app.get('/api/admin/session/:id/export', (req, res) => {
  const adminKey = req.headers['x-admin-key'] || req.headers['authorization']?.replace('Bearer ', '');
  if (adminKey !== ADMIN_SECRET) return res.status(403).json({ error: 'Unauthorized' });

  const data = telemetry.exportSessionData(req.params.id);
  if (!data) return res.status(404).json({ error: 'Sessão não encontrada' });
  res.json(data);
});

// POST purge expired data
app.post('/api/admin/data/purge', (req, res) => {
  const adminKey = req.headers['x-admin-key'] || req.headers['authorization']?.replace('Bearer ', '');
  if (adminKey !== ADMIN_SECRET) return res.status(403).json({ error: 'Unauthorized' });

  const days = req.body?.retentionDays || 90;
  const purged = telemetry.purgeExpiredData(days);
  res.json({ success: true, purgedCount: purged, message: `${purged} sessões expiradas eliminadas (LGPD Art. 16)` });
});

// GET LGPD compliance summary
app.get('/api/admin/lgpd/summary', (req, res) => {
  const adminKey = req.headers['x-admin-key'] || req.headers['authorization']?.replace('Bearer ', '');
  if (adminKey !== ADMIN_SECRET) return res.status(403).json({ error: 'Unauthorized' });

  res.json(telemetry.getLGPDSummary());
});

// ─── Static frontend (production) ────────────────────────────────────────────

const distPath = path.join(__dirname, '..', 'dist');
app.use(express.static(distPath));
app.get('/*path', (_req, res) => res.sendFile(path.join(distPath, 'index.html')));

// ─── Start ────────────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`\n🚀  Gemini Tutor running on port ${PORT}`);
  console.log(`    Health      : http://localhost:${PORT}/api/health`);
  console.log(`    Chat        : POST http://localhost:${PORT}/api/chat`);
  console.log(`    Image Gen   : POST http://localhost:${PORT}/api/generate-image`);
  console.log(`    Voice Save  : POST http://localhost:${PORT}/api/save-voice`);
  console.log(`    History     : GET  http://localhost:${PORT}/api/sessions/:id\n`);
});
