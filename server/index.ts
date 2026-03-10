/**
 * Gemini Tutor Backend
 *
 * This server uses Google Cloud Vertex AI to power the AI tutor.
 * When deployed on Google Cloud Run, it authenticates automatically
 * via the service account. For local development, falls back to
 * the Gemini API key.
 *
 * Google Cloud services used:
 *   - Vertex AI (Gemini model) for generative AI
 *   - Cloud Run for serverless deployment
 */

import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

// Load .env from project root
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const app = express();
const PORT = parseInt(process.env.PORT || '8080');

app.use(cors({ origin: true }));
app.use(express.json({ limit: '10mb' }));

// ─── Configuration ───────────────────────────────────────────────────────────

const GCP_PROJECT = process.env.GOOGLE_CLOUD_PROJECT || '';
const GCP_LOCATION = process.env.GOOGLE_CLOUD_LOCATION || 'us-central1';
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
const MODEL_NAME = 'gemini-3.1-flash-lite-preview';;

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

// ─── AI Backend Setup (Vertex AI or API Key) ────────────────────────────────

type ContentGenerator = (
  prompt: string,
  imageBase64?: string,
  history?: Array<{ role: string; text: string }>
) => Promise<string>;

let generateContent: ContentGenerator;

if (GCP_PROJECT) {
  // ═══════════════════════════════════════════════════════════════════════════
  // ✅ GOOGLE CLOUD VERTEX AI
  // When running on GCP (Cloud Run, GKE, Compute Engine), authentication
  // is handled automatically via the attached service account.
  // Vertex AI endpoint: https://${location}-aiplatform.googleapis.com
  // ═══════════════════════════════════════════════════════════════════════════
  const { VertexAI } = await import('@google-cloud/vertexai');

  const vertexAI = new VertexAI({
    project: GCP_PROJECT,
    location: GCP_LOCATION,
  });

  const model = vertexAI.getGenerativeModel({
    model: MODEL_NAME,
    systemInstruction: {
      role: 'system',
      parts: [{ text: TUTOR_SYSTEM_INSTRUCTION }],
    },
  });

  console.log(`✅ Using Google Cloud Vertex AI`);
  console.log(`   Project:  ${GCP_PROJECT}`);
  console.log(`   Location: ${GCP_LOCATION}`);
  console.log(`   Model:    ${MODEL_NAME}`);

  generateContent = async (prompt, imageBase64, history) => {
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

    const result = await model.generateContent({ contents });
    const response = result.response;
    return (
      response.candidates?.[0]?.content?.parts?.[0]?.text ||
      'I could not generate a response.'
    );
  };
} else if (GEMINI_API_KEY) {
  // ═══════════════════════════════════════════════════════════════════════════
  // 🔑 LOCAL DEVELOPMENT MODE - Uses Gemini API with API Key
  // For production, deploy to GCP and use Vertex AI instead.
  // ═══════════════════════════════════════════════════════════════════════════
  const { GoogleGenAI } = await import('@google/genai');
  const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

  console.log('🔑 Using Gemini API with API key (local development mode)');
  console.log(`   Model: ${MODEL_NAME}`);

  generateContent = async (prompt, imageBase64, history) => {
    const contents: Array<{ role: string; parts: any[] }> = [];

    if (history?.length) {
      for (const msg of history) {
        contents.push({
          role: msg.role === 'user' ? 'user' : 'model',
          parts: [{ text: msg.text }],
        });
      }
    }

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
  };
} else {
  console.error('❌ No authentication configured.');
  console.error('   Set GOOGLE_CLOUD_PROJECT (for Vertex AI on GCP)');
  console.error('   or GEMINI_API_KEY (for local development)');
  process.exit(1);
}

// ─── API Routes ──────────────────────────────────────────────────────────────

// Health check - useful for Cloud Run health probes
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'gemini-tutor-backend',
    mode: GCP_PROJECT ? 'vertex-ai' : 'api-key',
    project: GCP_PROJECT || undefined,
    timestamp: new Date().toISOString(),
  });
});

// Chat endpoint - text conversation with optional image
app.post('/api/chat', async (req, res) => {
  try {
    const { message, image, history } = req.body;

    if (!message && !image) {
      res.status(400).json({ error: 'Message or image is required' });
      return;
    }

    const response = await generateContent(
      message || 'Please analyze this image and help me understand it.',
      image || undefined,
      history
    );

    res.json({ response });
  } catch (error: any) {
    console.error('Chat error:', error);
    res.status(500).json({
      error: error.message || 'Internal server error',
    });
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
  console.log(`   Health:  http://localhost:${PORT}/api/health`);
  console.log(`   Chat:    POST http://localhost:${PORT}/api/chat`);
  console.log(`   Analyze: POST http://localhost:${PORT}/api/analyze\n`);
});
