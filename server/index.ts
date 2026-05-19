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
import { validateInput, validateOutput, strictSafetySettings } from './safety.ts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const app = express();
const PORT = parseInt(process.env.PORT || '8080');

app.use(cors({ origin: true }));
app.use(express.json({ limit: '100mb' }));

// ─── Configuration ────────────────────────────────────────────────────────────

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || ' ';
const GCP_PROJECT = process.env.GOOGLE_CLOUD_PROJECT || '';

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

## SESSION START — TRIAGE & ONBOARDING
When the conversation begins, introduce yourself and gather:
1. Subject/Topic
2. Student's current level (Beginner, Intermediate, Advanced)
3. Specific goal for this session

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
You can draw beautiful, highly professional diagrams, flowcharts, or equations on the student's whiteboard to explain concepts.
- ALWAYS aim for a clean, professional corporate look: use \`"roughness": 0\` (perfect straight lines) and \`"fontFamily": 2\` (modern Helvetica/sans-serif font).
- Layout elements in a structured, aligned manner with appropriate spacing and alignment.
- Use a clean color palette: \`#1a73e8\` (primary blue), \`#34a853\` (green for concepts/stable states), \`#ea4335\` (red for critical steps/attention), \`#fbbc05\` (yellow for warnings), \`#9c27b0\` (purple for structures).
- Connect shapes using arrows (\`type: "arrow"\`) to represent flow or links.
- Provide beautiful shaded boxes using \`"fillStyle": "solid"\` or \`"cross-hatch"\` and a nice \`backgroundColor\` (e.g., \`#e8f0fe\` with \`color: "#1a73e8"\`).
- Format: \`[GT_WHITEBOARD_COMMAND: {"id": "id1", "type": "square|circle|text|arrow|line", "x": 100, "y": 100, "width": 120, "height": 60, "content": "Label", "color": "#1a73e8", "roughness": 0, "fontFamily": 2, "fillStyle": "solid", "backgroundColor": "#e8f0fe"}]\`
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
  try {
    const { message, image, history, sessionId, generateImage: wantsImage, fileData, studentContext } = req.body;
    if (!message && !image && !fileData) { res.status(400).json({ error: 'Message, image, or file required' }); return; }

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
      if (!studentContext.triageComplete) lines.push('Note: This is the START of the session. Begin with triage/onboarding.');
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
      }
      
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
