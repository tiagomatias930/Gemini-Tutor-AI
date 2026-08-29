import {GoogleGenAI} from '@google/genai';
import type {AppConfig} from './config.js';
import {strictSafetySettings} from './safety.js';
import {TUTOR_SYSTEM_INSTRUCTION} from './tutor-prompt.js';

export interface FileAttachment {
  name: string;
  mimeType: string;
  data: string;
  isText: boolean;
}

export interface TextRequest {
  prompt: string;
  imageBase64?: string;
  history: Array<{role: 'user' | 'assistant'; text: string}>;
  fileData?: FileAttachment;
  instruction?: string;
  search?: boolean;
}

export interface GeneratedImage {
  imageBase64: string;
  mimeType: string;
  caption: string;
}

export interface GeminiService {
  readonly ready: boolean;
  generateText(request: TextRequest): Promise<string>;
  generateImage(concept: string, context?: string): Promise<GeneratedImage>;
}


export class ManagedGeminiService implements GeminiService {
  private readonly ai?: GoogleGenAI;
  private readonly semaphore: Semaphore;
  readonly ready: boolean;

  constructor(private readonly config: AppConfig) {
    this.ai = config.geminiApiKey ? new GoogleGenAI({apiKey: config.geminiApiKey}) : undefined;
    this.ready = Boolean(this.ai);
    this.semaphore = new Semaphore(config.geminiConcurrency);
  }

  async generateText(request: TextRequest): Promise<string> {
    const ai = this.requireClient();
    const contents: Array<{role: string; parts: Array<Record<string, unknown>>}> = request.history
      .slice(-30)
      .map(message => ({
        role: message.role === 'assistant' ? 'model' : 'user',
        parts: [{text: message.text.slice(0, 20_000)}],
      }));
    const parts: Array<Record<string, unknown>> = [];
    if (request.imageBase64) {
      parts.push({inlineData: {data: request.imageBase64, mimeType: 'image/jpeg'}});
    }
    let prompt = request.prompt;
    if (request.fileData) {
      if (request.fileData.isText) {
        prompt = `[File: ${request.fileData.name}]\n${request.fileData.data}\n\n${prompt}`;
      } else {
        parts.push({
          inlineData: {data: request.fileData.data, mimeType: request.fileData.mimeType},
        });
      }
    }
    parts.push({text: prompt});
    contents.push({role: 'user', parts});

    const response = await this.execute(() =>
      ai.models.generateContent({
        model: this.config.geminiTextModel,
        contents,
        config: {
          // The persona and whiteboard contract are always sent; caller-supplied
          // context is appended so it can never replace them.
          systemInstruction: [TUTOR_SYSTEM_INSTRUCTION, request.instruction]
            .filter(Boolean)
            .join('\n\n'),
          safetySettings: strictSafetySettings,
          ...(this.config.enableSearch && request.search ? {tools: [{googleSearch: {}}]} : {}),
        },
      }),
      'generateText'
    );
    if (!response.text) throw new GeminiUnavailableError('Gemini returned an empty response');
    return response.text;
  }

  async generateImage(concept: string, context?: string): Promise<GeneratedImage> {
    const ai = this.requireClient();
    const prompt = [
      `Create a clear, labelled educational illustration for: "${concept.slice(0, 500)}".`,
      context ? `Context: ${context.slice(0, 2_000)}` : '',
      'Use a light background and show key relationships clearly.',
    ]
      .filter(Boolean)
      .join(' ');
    const response = await this.execute(() =>
      ai.models.generateContent({
        model: this.config.geminiImageModel,
        contents: prompt,
        config: {
          responseModalities: ['TEXT', 'IMAGE'],
          safetySettings: strictSafetySettings,
        },
      }),
      'generateImage'
    );
    let imageBase64 = '';
    let mimeType = 'image/png';
    let caption = '';
    for (const part of response.candidates?.[0]?.content?.parts ?? []) {
      if (part.inlineData?.mimeType?.startsWith('image/')) {
        imageBase64 = part.inlineData.data ?? '';
        mimeType = part.inlineData.mimeType;
      } else if (part.text) {
        caption += part.text;
      }
    }
    if (!imageBase64) throw new GeminiUnavailableError('Gemini returned no image');
    return {imageBase64, mimeType, caption: caption.trim()};
  }

  private requireClient(): GoogleGenAI {
    if (!this.ai) throw new GeminiUnavailableError('Gemini is not configured');
    return this.ai;
  }

  private async execute<T>(operation: () => Promise<T>, label: string): Promise<T> {
    let lastError: unknown;
    for (let attempt = 0; attempt <= this.config.geminiRetries; attempt++) {
      try {
        return await withTimeout(
          this.semaphore.run(operation),
          this.config.geminiTimeoutMs,
          'Gemini request timed out'
        );
      } catch (error) {
        lastError = error;
        const status = statusOf(error);
        const permanent = status !== undefined && status < 500 && status !== 429;
        // Misconfiguration (retired model, bad key) never recovers by retrying,
        // and retrying hides it behind a generic "temporarily unavailable".
        if (permanent || attempt === this.config.geminiRetries) {
          console.error(
            JSON.stringify({
              level: 'error',
              message: 'Gemini request failed',
              operation: label,
              model: label === 'generateImage' ? this.config.geminiImageModel : this.config.geminiTextModel,
              status: status ?? null,
              attempts: attempt + 1,
              permanent,
              detail: messageOf(error).slice(0, 500),
            })
          );
          break;
        }
        await delay(200 * 2 ** attempt + Math.floor(Math.random() * 100));
      }
    }
    throw new GeminiUnavailableError('Gemini is temporarily unavailable', {cause: lastError});
  }
}

export class GeminiUnavailableError extends Error {}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** Gemini reports HTTP status inside a JSON string on the Error message. */
function statusOf(error: unknown): number | undefined {
  const message = messageOf(error);
  try {
    const parsed = JSON.parse(message) as {error?: {code?: unknown}};
    if (typeof parsed.error?.code === 'number') return parsed.error.code;
  } catch {
    // Non-JSON provider errors fall through to the status prefix check below.
  }
  const match = /\b(4\d{2}|5\d{2})\b/.exec(message);
  return match ? Number(match[1]) : undefined;
}

class Semaphore {
  private active = 0;
  private readonly waiting: Array<() => void> = [];

  constructor(private readonly maximum: number) {}

  async run<T>(operation: () => Promise<T>): Promise<T> {
    await this.acquire();
    try {
      return await operation();
    } finally {
      this.active--;
      this.waiting.shift()?.();
    }
  }

  private async acquire(): Promise<void> {
    if (this.active >= this.maximum) {
      await new Promise<void>(resolve => this.waiting.push(resolve));
    }
    this.active++;
  }
}

async function withTimeout<T>(promise: Promise<T>, milliseconds: number, message: string): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new GeminiUnavailableError(message)), milliseconds);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function delay(milliseconds: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, milliseconds));
}
