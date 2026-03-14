import React, { useState, useRef, useEffect, useCallback } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality } from '@google/genai';
import {
  Mic, MicOff, Sparkles, Camera, CameraOff,
  BookOpen, ArrowRight, Volume2, MessageSquare,
  StopCircle, Send, Globe, CornerDownLeft, Palette, X, ZoomIn,
} from 'lucide-react';

// ─── Constants ────────────────────────────────────────────────────────────────

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

// Criterion 1: Gemini models  |  Criterion 2: Google GenAI SDK
const TEXT_MODEL  = 'gemini-2.5-flash';
const IMAGE_MODEL = 'gemini-3.1-flash-image-preview';
const LIVE_MODEL  = 'gemini-2.5-flash-native-audio-preview-12-2025';

// Topics where generating a visual diagram is highly beneficial
const VISUAL_TOPIC_RE = /\b(explain|how does|how do|what is|describe|show|draw|diagram|illustrate|visualize|cycle|process|system|structure|anatomy|cell|molecule|atom|circuit|photosynthesis|mitosis|meiosis|krebs|dna|protein|evolution|ecosystem|solar system|water cycle|carbon cycle|nitrogen cycle|food chain|neural network|algorithm|data structure|sorting|equation|geometry|triangle|function|derivative|integral|wave|gravity|quantum|thermodynamics|osmosis|diffusion|respiration|digestion|heart|brain|lung|skeleton|muscle|revolution|empire|civilization|volcano|earthquake|plate tectonic|weather|ocean|atmosphere|electromagnetic)\b/i;

interface ChatMessage {
  role: 'user' | 'assistant';
  text: string;
  image?: string;            // user-captured camera frame
  source?: 'text' | 'voice';
  grounded?: boolean;
  // Generated image fields — populated by Gemini image generation
  generatedImage?: string;   // base64 of AI-generated illustration
  generatedImageMime?: string;
  imageCaption?: string;
  isGeneratingImage?: boolean;
}

// ─── Markdown renderer ────────────────────────────────────────────────────────

function renderInline(text: string): React.ReactNode[] {
  const parts = text.split(/(`[^`\n]+`|\*\*[^*\n]+\*\*|\*[^*\n]+\*|\$[^$\n]+\$)/g);
  return parts.map((part, i) => {
    if (part.startsWith('`') && part.endsWith('`') && part.length > 2)
      return <code key={i} className="bg-[#f1f3f4] text-[#c5221f] px-1.5 py-0.5 rounded text-[0.8em] font-mono">{part.slice(1, -1)}</code>;
    if (part.startsWith('**') && part.endsWith('**') && part.length > 4)
      return <strong key={i} className="font-semibold">{part.slice(2, -2)}</strong>;
    if (part.startsWith('*') && part.endsWith('*') && part.length > 2)
      return <em key={i}>{part.slice(1, -1)}</em>;
    if (part.startsWith('$') && part.endsWith('$') && part.length > 2)
      return <span key={i} className="text-[#1a73e8] font-semibold bg-[#e8f0fe] px-1 rounded">{part.slice(1, -1)}</span>;
    return <span key={i}>{part}</span>;
  });
}

function MarkdownContent({ text, isUser }: { text: string; isUser: boolean }) {
  const lines = text.split('\n');
  const nodes: React.ReactNode[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (line.startsWith('```')) {
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].startsWith('```')) { codeLines.push(lines[i]); i++; }
      nodes.push(<pre key={`cb-${i}`} className="bg-[#1e1e2e] text-[#cdd6f4] rounded-xl p-4 my-2 overflow-x-auto text-xs font-mono leading-relaxed border border-[#313244]"><code>{codeLines.join('\n')}</code></pre>);
      i++; continue;
    }
    if (line.startsWith('### ')) { nodes.push(<h3 key={i} className="text-sm font-semibold mt-3 mb-1 text-[#202124]">{renderInline(line.slice(4))}</h3>); i++; continue; }
    if (line.startsWith('## '))  { nodes.push(<h2 key={i} className="text-base font-bold mt-3 mb-1 text-[#202124]">{renderInline(line.slice(3))}</h2>); i++; continue; }
    if (line.startsWith('# '))   { nodes.push(<h1 key={i} className="text-lg font-bold mt-4 mb-2 text-[#202124]">{renderInline(line.slice(2))}</h1>); i++; continue; }
    if (line.match(/^[-*•]\s/)) {
      const items: React.ReactNode[] = [];
      while (i < lines.length && lines[i].match(/^[-*•]\s/)) {
        items.push(<li key={i} className="flex gap-2"><span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-[#5f6368] shrink-0" /><span>{renderInline(lines[i].replace(/^[-*•]\s/, ''))}</span></li>);
        i++;
      }
      nodes.push(<ul key={`ul-${i}`} className="space-y-1 my-2">{items}</ul>); continue;
    }
    if (line.match(/^\d+\.\s/)) {
      const items: React.ReactNode[] = [];
      let n = 1;
      while (i < lines.length && lines[i].match(/^\d+\.\s/)) {
        items.push(<li key={i} className="flex gap-2"><span className="shrink-0 text-[#5f6368] font-medium w-5 text-right">{n}.</span><span>{renderInline(lines[i].replace(/^\d+\.\s/, ''))}</span></li>);
        i++; n++;
      }
      nodes.push(<ol key={`ol-${i}`} className="space-y-1 my-2">{items}</ol>); continue;
    }
    if (line.match(/^---+$/)) { nodes.push(<hr key={i} className="my-3 border-[#e8eaed]" />); i++; continue; }
    if (line.trim() === '') { if (nodes.length > 0) nodes.push(<div key={`sp-${i}`} className="h-1.5" />); i++; continue; }
    nodes.push(<p key={i} className={`leading-relaxed ${isUser ? '' : 'text-[#3c4043]'}`}>{renderInline(line)}</p>);
    i++;
  }
  return <div className="space-y-px">{nodes}</div>;
}

// ─── Generated Image component ────────────────────────────────────────────────
// Shows the AI-generated illustration with a lightbox on click.

function GeneratedImageCard({
  imageBase64, mimeType, caption,
  onRegenerate, isRegenerating,
}: {
  imageBase64: string; mimeType: string; caption?: string;
  onRegenerate?: () => void; isRegenerating?: boolean;
}) {
  const [lightbox, setLightbox] = useState(false);
  const src = `data:${mimeType};base64,${imageBase64}`;

  return (
    <>
      <div className="mt-3 rounded-xl overflow-hidden border border-[#e8eaed] bg-[#f8f9fa]">
        <div className="relative group cursor-zoom-in" onClick={() => setLightbox(true)}>
          <img src={src} alt="AI-generated illustration" className="w-full object-contain max-h-72" />
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center">
            <ZoomIn size={20} className="text-white opacity-0 group-hover:opacity-100 transition-opacity drop-shadow" />
          </div>
        </div>
        <div className="px-3 py-2 flex items-start justify-between gap-2">
          <div>
            <div className="flex items-center gap-1.5 mb-0.5">
              <Palette size={11} className="text-[#9b72cb]" />
              <span className="text-[10px] font-medium text-[#9b72cb]">AI Generated Illustration</span>
            </div>
            {caption && <p className="text-[11px] text-[#5f6368] leading-relaxed">{caption}</p>}
          </div>
          {onRegenerate && (
            <button onClick={onRegenerate} disabled={isRegenerating}
              className="shrink-0 text-[10px] text-[#1a73e8] hover:underline disabled:opacity-40 disabled:no-underline mt-0.5">
              {isRegenerating ? 'Generating…' : 'Regenerate'}
            </button>
          )}
        </div>
      </div>

      {/* Lightbox */}
      {lightbox && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
          onClick={() => setLightbox(false)}>
          <button className="absolute top-4 right-4 text-white/80 hover:text-white" onClick={() => setLightbox(false)}>
            <X size={24} />
          </button>
          <img src={src} alt="AI-generated illustration" className="max-w-full max-h-full rounded-xl shadow-2xl object-contain" onClick={e => e.stopPropagation()} />
        </div>
      )}
    </>
  );
}

// ─── Image generating skeleton ────────────────────────────────────────────────

function ImageGeneratingSkeleton() {
  return (
    <div className="mt-3 rounded-xl border border-[#e8eaed] bg-[#f8f9fa] overflow-hidden">
      <div className="h-40 bg-gradient-to-r from-[#f1f3f4] via-[#e8eaed] to-[#f1f3f4] animate-pulse" />
      <div className="px-3 py-2 flex items-center gap-2">
        <Palette size={11} className="text-[#9b72cb]" />
        <span className="text-[10px] text-[#9aa0a6]">Generating illustration with Gemini…</span>
      </div>
    </div>
  );
}

// ─── Welcome Screen ─────────────────────────────────────────────────────────────

function WelcomeScreen({ onStart }: { onStart: (key: string) => void }) {
  const [apiKey, setApiKey] = useState(
    () => localStorage.getItem('gemini_api_key') || process.env.GEMINI_API_KEY || ''
  );
  const [error, setError] = useState('');

  const handleStart = () => {
    const key = apiKey.trim();
    if (!key) { setError('Please enter your Gemini API key to continue.'); return; }
    localStorage.setItem('gemini_api_key', key);
    onStart(key);
  };

  return (
    <div className="min-h-dvh bg-white flex flex-col"
         style={{ paddingTop: 'env(safe-area-inset-top, 0px)',
                  paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
      {/* Nav */}
      <nav className="w-full flex items-center justify-end px-4 sm:px-6 py-3 gap-4 text-sm text-slate-500">
        <a href="https://aistudio.google.com/api-keys" target="_blank"
           className="hover:text-slate-800 hover:underline transition-colors">Get API Key</a>
        <a href="https://ai.google.dev/gemini-api/docs/live-api" target="_blank"
           className="hover:text-slate-800 hover:underline transition-colors">Docs</a>
      </nav>

      {/* Centre content */}
      <main className="flex-1 flex flex-col items-center justify-center px-4 sm:px-6 py-8">
        {/* Logo */}
        <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-gradient-to-br from-blue-500 via-purple-500 to-pink-500
                        flex items-center justify-center shadow-lg mb-6 sm:mb-8">
          <Sparkles className="text-white" size={28} />
        </div>

        {/* Title — scales from 2.5rem on small mobile to 4rem on desktop */}
        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-normal tracking-tight text-slate-800 mb-3 text-center leading-tight">
          <span className="text-[#4285f4]">G</span><span className="text-[#ea4335]">e</span>
          <span className="text-[#fbbc05]">m</span><span className="text-[#4285f4]">i</span>
          <span className="text-[#34a853]">n</span><span className="text-[#ea4335]">i</span>
          <span className="text-slate-800"> Tutor</span>
        </h1>

        <p className="text-base sm:text-lg text-slate-500 mb-8 sm:mb-10 text-center max-w-sm sm:max-w-md">
          Your AI-powered homework assistant — voice, camera and AI-generated visuals.
        </p>

        {/* API Key input — Google search bar style */}
        <div className="w-full max-w-xs sm:max-w-xl">
          <div className={`flex items-center gap-3 px-4 sm:px-5 py-3.5 sm:py-4 rounded-full bg-white border
                          shadow-sm transition-all hover:shadow-md
                          focus-within:shadow-[0_2px_12px_rgba(0,0,0,0.18)]
                          ${error ? 'border-red-300' : 'border-[#dfe1e5]'}`}>
            <BookOpen size={18} className="text-slate-400 shrink-0" />
            <input
              type="password" value={apiKey}
              onChange={e => { setApiKey(e.target.value); setError(''); }}
              onKeyDown={e => e.key === 'Enter' && handleStart()}
              placeholder="Paste your Gemini API Key..."
              className="flex-1 outline-none text-sm sm:text-base text-slate-700
                         placeholder:text-slate-400 bg-transparent min-w-0"
            />
            <button onClick={handleStart}
              className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-[#1a73e8] hover:bg-[#1765cc] text-white
                         flex items-center justify-center transition-colors shrink-0 shadow-sm">
              <ArrowRight size={17} />
            </button>
          </div>
          {error && <p className="text-red-500 text-xs sm:text-sm mt-2 pl-5">{error}</p>}
        </div>

        {/* Feature pills — wrap gracefully on small screens */}
        <div className="flex flex-wrap gap-2 sm:gap-3 mt-6 sm:mt-8 justify-center max-w-sm sm:max-w-none">
          {[
            { icon: Camera,       label: 'Camera Vision' },
            { icon: Mic,          label: 'Voice Chat' },
            { icon: Palette,      label: 'AI Illustrations' },
            { icon: Globe,        label: 'Web Search' },
            { icon: MessageSquare, label: 'Text Chat' },
          ].map(({ icon: Icon, label }) => (
            <span key={label} className="flex items-center gap-1.5 px-3 sm:px-4 py-1.5 sm:py-2
                                         bg-[#f8f9fa] rounded-full text-xs sm:text-sm
                                         text-[#5f6368] border border-[#e8eaed]">
              <Icon size={13} />{label}
            </span>
          ))}
        </div>
      </main>

      {/* Footer */}
      <footer className="w-full text-center py-3 sm:py-4 text-[10px] sm:text-xs text-[#9aa0a6]
                         border-t border-[#f1f3f4] px-4">
        Powered by Google Gemini · Live API · Image Generation · Google Cloud
      </footer>
    </div>
  );
}

// ─── Tutor Screen ─────────────────────────────────────────────────────────────

function TutorScreen({ apiKey, onBack }: { apiKey: string; onBack: () => void }) {
  // ── UI state ──────────────────────────────────────────────────────────────
  const [isConnected, setIsConnected]         = useState(false);
  const [isConnecting, setIsConnecting]       = useState(false);
  const [isCameraOn, setIsCameraOn]           = useState(false);
  const [isModelSpeaking, setIsModelSpeaking] = useState(false);
  const [statusMessage, setStatusMessage]     = useState('Ready to start');
  const [error, setError]                     = useState('');
  const [messages, setMessages]               = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput]             = useState('');
  const [isSending, setIsSending]             = useState(false);
  const [liveTranscript, setLiveTranscript]   = useState('');

  // Criterion 3: Cloud Firestore session via backend
  const [sessionId] = useState(() => {
    const s = sessionStorage.getItem('tutor_session_id');
    if (s) return s;
    const id = `session_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    sessionStorage.setItem('tutor_session_id', id);
    return id;
  });

  useEffect(() => {
    fetch(`/api/sessions/${sessionId}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.messages?.length) setMessages(d.messages.map((m: any) => ({ role: m.role, text: m.text, source: m.source }))); })
      .catch(() => {});
  }, [sessionId]);

  // ── Refs ───────────────────────────────────────────────────────────────────
  const videoRef              = useRef<HTMLVideoElement>(null);
  const sessionRef            = useRef<any>(null);
  const streamRef             = useRef<MediaStream | null>(null);
  const audioContextRef       = useRef<AudioContext | null>(null);
  const sendIntervalRef       = useRef<ReturnType<typeof setInterval> | null>(null);
  const chatEndRef            = useRef<HTMLDivElement>(null);
  const textareaRef           = useRef<HTMLTextAreaElement>(null);
  const isConnectedRef        = useRef(false);
  const isTearingDownRef      = useRef(false);
  const workletNodeRef        = useRef<AudioWorkletNode | null>(null);
  const audioStreamRef        = useRef<MediaStream | null>(null);
  const playbackCtxRef        = useRef<AudioContext | null>(null);
  const nextPlayTimeRef       = useRef<number>(0);
  const scheduledSourcesRef   = useRef<AudioBufferSourceNode[]>([]);
  const isModelSpeakingRef    = useRef(false);
  const messagesRef           = useRef<ChatMessage[]>([]);
  const liveModelTranscriptRef = useRef('');
  const liveUserTranscriptRef  = useRef('');

  useEffect(() => { messagesRef.current = messages; }, [messages]);
  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, liveTranscript]);

  // ── Helpers ────────────────────────────────────────────────────────────────
  const setModelSpeaking = useCallback((v: boolean) => {
    isModelSpeakingRef.current = v;
    setIsModelSpeaking(v);
  }, []);

  const flushAudioQueue = useCallback(() => {
    const now = playbackCtxRef.current?.currentTime ?? 0;
    scheduledSourcesRef.current.forEach(s => { try { s.stop(now); } catch { } });
    scheduledSourcesRef.current = [];
    nextPlayTimeRef.current = 0;
  }, []);

  const buildSystemInstruction = useCallback((msgs: ChatMessage[]) => {
    if (!msgs.length) return TUTOR_SYSTEM_INSTRUCTION;
    const summary = msgs.slice(-12).map(m => `${m.role === 'user' ? 'Student' : 'Tutor'}: ${m.text.slice(0, 200)}`).join('\n');
    return `${TUTOR_SYSTEM_INSTRUCTION}\n\n--- Conversation history (remember, do NOT repeat) ---\n${summary}\n--- End ---`;
  }, []);

  // ── Image generation ───────────────────────────────────────────────────────
  // Called after text responses for visual topics, and also from the
  // "Visualize" button on any assistant message.
  const generateVisual = useCallback(async (concept: string, msgIndex: number) => {
    // Mark message as generating
    setMessages(prev => prev.map((m, i) => i === msgIndex ? { ...m, isGeneratingImage: true } : m));

    try {
      let imageBase64 = '';
      let mimeType    = 'image/png';
      let caption     = '';

      // Try backend first (Cloud Run)
      try {
        const res = await fetch('/api/generate-image', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ concept, context: messagesRef.current[msgIndex]?.text?.slice(0, 300) }),
        });
        if (!res.ok) throw new Error(`Backend ${res.status}`);
        const data = await res.json();
        imageBase64 = data.imageBase64;
        mimeType    = data.mimeType;
        caption     = data.caption;
      } catch {
        // Fallback: direct Gemini image generation from browser
        if (!apiKey) throw new Error('Image generation unavailable.');
        const genAI = new GoogleGenAI({ apiKey });
        const response = await genAI.models.generateContent({
          model: IMAGE_MODEL,
          contents: `Create a clear, educational diagram or illustration for: "${concept}". White background, labeled, suitable for a student.`,
          config: {
            responseModalities: ['TEXT', 'IMAGE'] as any,
          },
        });
        for (const part of (response.candidates?.[0]?.content?.parts || [])) {
          if ((part as any).inlineData?.mimeType?.startsWith('image/')) {
            imageBase64 = (part as any).inlineData.data || '';
            mimeType    = (part as any).inlineData.mimeType;
          } else if ((part as any).text) {
            caption += (part as any).text;
          }
        }
      }

      setMessages(prev => prev.map((m, i) =>
        i === msgIndex
          ? { ...m, isGeneratingImage: false, generatedImage: imageBase64, generatedImageMime: mimeType, imageCaption: caption.trim() }
          : m
      ));
    } catch (err: any) {
      console.error('Image generation error:', err);
      setMessages(prev => prev.map((m, i) => i === msgIndex ? { ...m, isGeneratingImage: false } : m));
    }
  }, [apiKey]);

  // ── Camera ─────────────────────────────────────────────────────────────────
  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
      setIsCameraOn(true);
    } catch { setError('Could not access camera. Please check permissions.'); }
  }, []);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setIsCameraOn(false);
  }, []);

  const captureFrame = useCallback((): string | null => {
    if (!videoRef.current || !isCameraOn) return null;
    const c = document.createElement('canvas');
    c.width = videoRef.current.videoWidth || 640;
    c.height = videoRef.current.videoHeight || 480;
    c.getContext('2d')?.drawImage(videoRef.current, 0, 0, c.width, c.height);
    return c.toDataURL('image/jpeg', 0.8);
  }, [isCameraOn]);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setChatInput(e.target.value);
    const el = e.target;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 180) + 'px';
  }, []);

  const resetTextarea = useCallback(() => {
    setChatInput('');
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
  }, []);

  // ── Text Chat ──────────────────────────────────────────────────────────────
  const sendChatMessage = useCallback(async (includeImage = false) => {
    const text = chatInput.trim();
    if (!text && !includeImage) return;

    const frameDataUrl = includeImage ? captureFrame() : null;
    const frameBase64  = frameDataUrl?.split(',')[1];
    const userMsg: ChatMessage = {
      role: 'user',
      text: text || 'Please analyze this image and help me understand it.',
      image: frameDataUrl || undefined,
      source: 'text',
    };

    setMessages(prev => [...prev, userMsg]);
    resetTextarea();
    setIsSending(true);
    setError('');

    // Detect before the async call so we know the index to update
    const shouldVisualise = VISUAL_TOPIC_RE.test(userMsg.text);

    try {
      let response = '';
      let grounded = false;
      let autoImage: string | null = null;
      let autoImageMime: string | null = null;
      let autoCaption: string | null = null;

      try {
        const res = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: userMsg.text,
            image: frameBase64,
            sessionId,
            history: messages.slice(-12).map(m => ({ role: m.role, text: m.text })),
            generateImage: shouldVisualise,
          }),
        });
        if (!res.ok) throw new Error(`Backend ${res.status}`);
        const data = await res.json();
        response      = data.response;
        grounded      = data.grounded ?? false;
        autoImage     = data.generatedImage || null;
        autoImageMime = data.generatedImageMime || null;
        autoCaption   = data.imageCaption || null;
      } catch {
        // Client-side fallback with Google Search
        if (!apiKey) throw new Error('Backend unavailable and no API key provided.');
        const ai = new GoogleGenAI({ apiKey });
        const parts: any[] = [];
        if (frameBase64) parts.push({ inlineData: { data: frameBase64, mimeType: 'image/jpeg' } });
        parts.push({ text: userMsg.text });
        const histContents = messages.slice(-12).map(m => ({ role: m.role === 'user' ? 'user' : 'model', parts: [{ text: m.text }] }));
        histContents.push({ role: 'user', parts });
        const result = await ai.models.generateContent({
          model: TEXT_MODEL,
          contents: histContents,
          config: { systemInstruction: TUTOR_SYSTEM_INSTRUCTION, tools: [{ googleSearch: {} }] },
        });
        response = result.text || 'No response received.';
        grounded = !!(result.candidates?.[0]?.groundingMetadata);
      }

      // Add assistant message (with auto-generated image if available)
      const assistantMsg: ChatMessage = {
        role: 'assistant',
        text: response,
        source: 'text',
        grounded,
        generatedImage: autoImage || undefined,
        generatedImageMime: autoImageMime || undefined,
        imageCaption: autoCaption || undefined,
      };
      setMessages(prev => [...prev, assistantMsg]);

      // If backend did NOT return an image but topic warrants one, generate now
      if (shouldVisualise && !autoImage) {
        // The assistant msg is at index messages.length + 1 (after userMsg)
        const newIdx = messagesRef.current.length; // will be set after setState
        setTimeout(() => {
          setMessages(prev => {
            const idx = prev.length - 1;
            if (prev[idx]?.role === 'assistant' && !prev[idx]?.generatedImage) {
              generateVisual(userMsg.text, idx);
            }
            return prev;
          });
        }, 100);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to send message');
      setMessages(prev => [...prev, { role: 'assistant', text: `Sorry, something went wrong: ${err.message}`, source: 'text' }]);
    } finally { setIsSending(false); }
  }, [chatInput, captureFrame, messages, apiKey, sessionId, resetTextarea, generateVisual]);

  // ── Live API: video frames ─────────────────────────────────────────────────
  const startSendingFrames = useCallback((session: any) => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    sendIntervalRef.current = setInterval(() => {
      if (isTearingDownRef.current || !isConnectedRef.current || !sessionRef.current
          || !videoRef.current || !ctx || !streamRef.current) return;
      canvas.width = 640; canvas.height = 480;
      ctx.drawImage(videoRef.current, 0, 0, 640, 480);
      try { session.sendRealtimeInput({ media: { data: canvas.toDataURL('image/jpeg', 0.6).split(',')[1], mimeType: 'image/jpeg' } }); } catch { }
    }, 2000);
  }, []);

  // ── Live API: sequential audio playback ────────────────────────────────────
  const playAudio = useCallback((base64Audio: string) => {
    try {
      if (!playbackCtxRef.current || playbackCtxRef.current.state === 'closed') {
        playbackCtxRef.current = new AudioContext({ sampleRate: 24000 });
        nextPlayTimeRef.current = 0;
      }
      const ctx = playbackCtxRef.current;
      const raw = atob(base64Audio);
      const bytes = new Uint8Array(raw.length).map((_, i) => raw.charCodeAt(i));
      const pcm16 = new Int16Array(bytes.buffer);
      const f32 = new Float32Array(pcm16.length);
      for (let i = 0; i < pcm16.length; i++) f32[i] = pcm16[i] / 32768;
      const buf = ctx.createBuffer(1, f32.length, 24000);
      buf.getChannelData(0).set(f32);
      const src = ctx.createBufferSource();
      src.buffer = buf;
      src.connect(ctx.destination);
      const startAt = Math.max(ctx.currentTime, nextPlayTimeRef.current);
      src.start(startAt);
      nextPlayTimeRef.current = startAt + buf.duration;
      scheduledSourcesRef.current.push(src);
      src.onended = () => {
        scheduledSourcesRef.current = scheduledSourcesRef.current.filter(s => s !== src);
        if (scheduledSourcesRef.current.length === 0) { setModelSpeaking(false); setLiveTranscript(''); }
      };
      if (!isModelSpeakingRef.current) setModelSpeaking(true);
    } catch (err) { console.warn('Audio playback error:', err); }
  }, [setModelSpeaking]);

  // ── Interrupt ──────────────────────────────────────────────────────────────
  const interruptAgent = useCallback(() => {
    if (!isModelSpeakingRef.current) return;
    flushAudioQueue();
    setModelSpeaking(false);
    setLiveTranscript('');
    setStatusMessage('Interrupted — go ahead!');
  }, [flushAudioQueue, setModelSpeaking]);

  // ── Save voice turn to Firestore ───────────────────────────────────────────
  const saveVoiceTurn = useCallback(async (userText: string, assistantText: string) => {
    if (!userText && !assistantText) return;
    const msgs = [];
    if (userText) msgs.push({ role: 'user', text: userText });
    if (assistantText) msgs.push({ role: 'assistant', text: assistantText });
    try {
      await fetch('/api/save-voice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, messages: msgs }),
      });
    } catch { }
  }, [sessionId]);

  // ── Live API: start ────────────────────────────────────────────────────────
  const startSession = async () => {
    isTearingDownRef.current = false;
    liveModelTranscriptRef.current = '';
    liveUserTranscriptRef.current = '';
    setIsConnecting(true);
    setError('');

    try {
      setStatusMessage('Requesting camera & microphone...');
      if (!isCameraOn) await startCamera();
      const audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioStreamRef.current = audioStream;

      const audioCtx = new AudioContext({ sampleRate: 16000 });
      audioContextRef.current = audioCtx;

      const workletCode = `
        class PCMProcessor extends AudioWorkletProcessor {
          constructor() { super(); this._buf = new Float32Array(4096); this._off = 0; }
          process(inputs) {
            const ch = inputs[0]?.[0];
            if (ch) {
              for (let i = 0; i < ch.length; i++) {
                this._buf[this._off++] = ch[i];
                if (this._off >= 4096) {
                  const pcm = new Int16Array(4096);
                  for (let j = 0; j < 4096; j++) pcm[j] = Math.max(-32768, Math.min(32767, Math.round(this._buf[j] * 32767)));
                  this.port.postMessage(pcm.buffer, [pcm.buffer]);
                  this._buf = new Float32Array(4096); this._off = 0;
                }
              }
            }
            return true;
          }
        }
        registerProcessor('pcm-processor', PCMProcessor);
      `;
      const blobUrl = URL.createObjectURL(new Blob([workletCode], { type: 'application/javascript' }));
      await audioCtx.audioWorklet.addModule(blobUrl);
      URL.revokeObjectURL(blobUrl);

      const micSrc = audioCtx.createMediaStreamSource(audioStream);
      const workletNode = new AudioWorkletNode(audioCtx, 'pcm-processor');
      workletNodeRef.current = workletNode;
      micSrc.connect(workletNode);
      const silence = audioCtx.createGain();
      silence.gain.value = 0;
      workletNode.connect(silence);
      silence.connect(audioCtx.destination);

      setStatusMessage('Connecting to Gemini Live...');
      const genAI = new GoogleGenAI({ apiKey });
      const currentMessages = messagesRef.current;

      const session = await genAI.live.connect({
        model: LIVE_MODEL,
        callbacks: {
          onopen: () => {
            isConnectedRef.current = true;
            setIsConnected(true);
            setIsConnecting(false);
            setStatusMessage(currentMessages.length > 0 ? `Resuming — ${currentMessages.length} messages in context` : 'Live — show me your homework!');
          },

          onmessage: (msg: LiveServerMessage) => {
            // Server VAD interrupted
            if (msg.serverContent?.interrupted) {
              flushAudioQueue();
              setModelSpeaking(false);
              setLiveTranscript('');
              if (liveModelTranscriptRef.current.trim()) {
                const t = liveModelTranscriptRef.current.trim();
                setMessages(prev => [...prev, { role: 'assistant', text: t, source: 'voice' }]);
                saveVoiceTurn(liveUserTranscriptRef.current.trim(), t);
                liveUserTranscriptRef.current = '';
                liveModelTranscriptRef.current = '';
              }
              setStatusMessage('Listening...');
              return;
            }

            // Speech transcription
            if ((msg.serverContent as any)?.inputTranscription?.text)
              liveUserTranscriptRef.current += (msg.serverContent as any).inputTranscription.text;
            if ((msg.serverContent as any)?.outputTranscription?.text) {
              liveModelTranscriptRef.current += (msg.serverContent as any).outputTranscription.text;
              setLiveTranscript(liveModelTranscriptRef.current);
            }

            // Audio chunks
            if (msg.serverContent?.modelTurn?.parts) {
              for (const part of msg.serverContent.modelTurn.parts) {
                if (part.inlineData?.mimeType?.startsWith('audio/') && part.inlineData.data) {
                  playAudio(part.inlineData.data);
                  setStatusMessage('Speaking...');
                }
              }
            }

            // Turn complete — commit transcripts + auto-generate visual if relevant
            if (msg.serverContent?.turnComplete) {
              const userText  = liveUserTranscriptRef.current.trim();
              const modelText = liveModelTranscriptRef.current.trim();

              const newMessages: ChatMessage[] = [];
              if (userText)  newMessages.push({ role: 'user',      text: userText,  source: 'voice' });
              if (modelText) newMessages.push({ role: 'assistant', text: modelText, source: 'voice' });

              if (newMessages.length) {
                setMessages(prev => {
                  const updated = [...prev, ...newMessages];
                  // Auto-generate visual illustration for the voice turn if topic warrants it
                  const shouldViz = VISUAL_TOPIC_RE.test(userText) || VISUAL_TOPIC_RE.test(modelText);
                  if (shouldViz) {
                    const assistantIdx = updated.length - 1;
                    // Defer so state has settled
                    setTimeout(() => generateVisual(userText || modelText, assistantIdx), 300);
                  }
                  return updated;
                });
                saveVoiceTurn(userText, modelText);
              }

              liveUserTranscriptRef.current  = '';
              liveModelTranscriptRef.current = '';
              setLiveTranscript('');
              if (scheduledSourcesRef.current.length === 0) setModelSpeaking(false);
              setStatusMessage('Live — show me your homework!');
            }
          },

          onerror: (err: any) => {
            console.error('Live API error:', err);
            isTearingDownRef.current = true;
            isConnectedRef.current = false;
            sessionRef.current = null;
            workletNodeRef.current?.port.close();
            flushAudioQueue();
            setModelSpeaking(false);
            setLiveTranscript('');
            setError(`Connection error: ${err?.message || 'Unknown error'}`);
            setIsConnecting(false);
          },

          onclose: (event?: any) => {
            isTearingDownRef.current = true;
            isConnectedRef.current = false;
            sessionRef.current = null;
            workletNodeRef.current?.port.close();
            workletNodeRef.current?.disconnect();
            workletNodeRef.current = null;
            if (sendIntervalRef.current) { clearInterval(sendIntervalRef.current); sendIntervalRef.current = null; }
            audioStreamRef.current?.getTracks().forEach(t => t.stop());
            audioStreamRef.current = null;
            audioContextRef.current?.close();
            audioContextRef.current = null;
            flushAudioQueue();
            playbackCtxRef.current?.close();
            playbackCtxRef.current = null;
            nextPlayTimeRef.current = 0;
            setIsConnected(false);
            setIsConnecting(false);
            setModelSpeaking(false);
            setLiveTranscript('');
            if (event?.code && event.code !== 1000) console.warn(`Live closed: code=${event.code} reason=${event.reason ?? '(none)'}`);
            setStatusMessage('Session ended');
          },
        },
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } } },
          systemInstruction: buildSystemInstruction(currentMessages),
          tools: [{ googleSearch: {} }],
          ...({ inputAudioTranscription: {}, outputAudioTranscription: {} } as any),
        },
      });

      sessionRef.current = session;

      workletNode.port.onmessage = (e: MessageEvent) => {
        if (isTearingDownRef.current) return;
        const s = sessionRef.current;
        if (!isConnectedRef.current || !s) return;
        const bytes = new Uint8Array(e.data as ArrayBuffer);
        let bin = '';
        for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
        try { s.sendRealtimeInput({ media: { data: btoa(bin), mimeType: 'audio/pcm;rate=16000' } }); }
        catch { isTearingDownRef.current = true; isConnectedRef.current = false; sessionRef.current = null; workletNodeRef.current?.port.close(); }
      };

      startSendingFrames(session);
    } catch (err: any) {
      console.error('Session start error:', err);
      setError(`Failed to connect: ${err?.message || 'Unknown error'}`);
      setIsConnecting(false);
      setStatusMessage('Connection failed');
    }
  };

  // ── Live API: stop ─────────────────────────────────────────────────────────
  const stopSession = async () => {
    isTearingDownRef.current = true;
    isConnectedRef.current = false;
    const session = sessionRef.current;
    sessionRef.current = null;
    if (sendIntervalRef.current) { clearInterval(sendIntervalRef.current); sendIntervalRef.current = null; }
    workletNodeRef.current?.port.close();
    workletNodeRef.current?.disconnect();
    workletNodeRef.current = null;
    audioStreamRef.current?.getTracks().forEach(t => t.stop());
    audioStreamRef.current = null;
    audioContextRef.current?.close();
    audioContextRef.current = null;
    flushAudioQueue();
    playbackCtxRef.current?.close();
    playbackCtxRef.current = null;
    nextPlayTimeRef.current = 0;
    setModelSpeaking(false);
    setLiveTranscript('');
    await new Promise(r => setTimeout(r, 120));
    try { session?.close(); } catch { }
    setIsConnected(false);
    setStatusMessage('Session ended');
  };

  useEffect(() => () => { stopCamera(); stopSession(); }, []);

  // ─── Render ─────────────────────────────────────────────────────────────────
  //
  // Layout strategy:
  //   Mobile  (< md  ≤ 767px): tabs — Camera tab | Chat tab — full-screen each,
  //                             bottom fixed controls bar, safe-area padding for notch.
  //   Tablet  (md  768–1023px): side-by-side, video top-left, chat right, compact controls.
  //   Desktop (lg  1024px+)  : side-by-side, video 44%, chat fills rest, more padding.

  const [mobileTab, setMobileTab] = useState<'camera' | 'chat'>('chat');

  return (
    <div className="h-dvh bg-[#f8f9fa] text-[#202124] flex flex-col overflow-hidden"
         style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}>

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <header className="shrink-0 flex items-center justify-between
                         px-4 md:px-6 py-2.5 bg-white border-b border-[#e8eaed]"
              style={{ paddingLeft: 'max(1rem, env(safe-area-inset-left, 0px))',
                       paddingRight: 'max(1rem, env(safe-area-inset-right, 0px))' }}>
        <button onClick={onBack}
          className="flex items-center gap-2 text-[#5f6368] hover:text-[#202124] transition-colors min-h-[44px]">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#4285f4] via-[#9b72cb] to-[#d96570]
                          flex items-center justify-center shrink-0">
            <Sparkles className="text-white" size={16} />
          </div>
          <span className="text-sm font-medium hidden sm:inline">Gemini Tutor</span>
        </button>

        {/* Mobile tab switcher — only on mobile */}
        <div className="flex md:hidden items-center bg-[#f1f3f4] rounded-full p-0.5 gap-0.5">
          {(['camera', 'chat'] as const).map(tab => (
            <button key={tab} onClick={() => setMobileTab(tab)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all min-h-[32px] ${
                mobileTab === tab
                  ? 'bg-white text-[#202124] shadow-sm'
                  : 'text-[#5f6368]'
              }`}>
              {tab === 'camera' ? '📷 Camera' : '💬 Chat'}
            </button>
          ))}
        </div>

        {/* Status badge */}
        <div className="flex items-center gap-1.5">
          {isConnected && (
            <span className="hidden sm:inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px]
                             font-medium bg-[#e6f4ea] text-[#137333] border border-[#ceead6]">
              <Globe size={10} /> Search
            </span>
          )}
          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-medium ${
            isConnected ? 'bg-[#e6f4ea] text-[#137333] border border-[#ceead6]'
            : isConnecting ? 'bg-[#fef7e0] text-[#b06000] border border-[#fde58b]'
            : 'bg-[#f1f3f4] text-[#5f6368] border border-[#e8eaed]'
          }`}>
            <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${
              isConnected ? 'bg-[#34a853] animate-pulse'
              : isConnecting ? 'bg-[#fbbc05] animate-pulse'
              : 'bg-[#9aa0a6]'
            }`} />
            <span className="hidden xs:inline">
              {isConnected ? 'Live' : isConnecting ? 'Connecting' : 'Off'}
            </span>
          </span>
        </div>
      </header>

      {/* ── Main content ────────────────────────────────────────────────────── */}
      <main className="flex-1 overflow-hidden flex flex-col md:flex-row gap-0 md:gap-3
                       md:p-3 lg:p-4 md:max-w-7xl md:mx-auto md:w-full">

        {/* ══ LEFT: Camera panel ══════════════════════════════════════════════ */}
        {/* Mobile: shown only when mobileTab === 'camera'; tablet+: always visible */}
        <div className={`
          flex-col gap-2 md:gap-3
          md:w-[42%] lg:w-[44%] md:shrink-0
          ${mobileTab === 'camera' ? 'flex' : 'hidden md:flex'}
          flex-1 md:flex-none
          overflow-hidden
          px-3 pt-3 pb-0 md:p-0
        `}>

          {/* Video */}
          <div className="relative bg-[#1c1c1e] rounded-2xl overflow-hidden shadow-sm
                          aspect-video md:aspect-video max-h-[38vh] md:max-h-none w-full">
            <video ref={videoRef} autoPlay playsInline muted
              className={`w-full h-full object-cover ${isCameraOn ? '' : 'hidden'}`} />
            {!isCameraOn && (
              <div className="w-full h-full flex flex-col items-center justify-center text-[#9aa0a6] gap-2">
                <Camera size={36} strokeWidth={1.5} />
                <p className="text-xs">Camera is off</p>
              </div>
            )}
            {isConnected && (
              <div className="absolute top-2.5 left-2.5 flex items-center gap-1.5 px-2.5 py-1
                              bg-black/55 backdrop-blur-sm rounded-full">
                <span className="w-2 h-2 rounded-full bg-[#ea4335] animate-pulse" />
                <span className="text-white text-[10px] font-bold tracking-widest">LIVE</span>
              </div>
            )}
            {isModelSpeaking && (
              <div className="absolute bottom-2.5 left-1/2 -translate-x-1/2 flex items-center gap-1.5
                              px-3 py-1.5 bg-black/65 backdrop-blur-sm rounded-full">
                {[0, 140, 280].map(d => (
                  <span key={d} className="w-1.5 rounded-full bg-[#4285f4] animate-bounce"
                    style={{ height: '14px', animationDelay: `${d}ms` }} />
                ))}
                <span className="text-white text-[10px] ml-1 font-medium">Speaking</span>
              </div>
            )}
          </div>

          {/* Status + error */}
          <p className="text-[11px] text-[#9aa0a6] text-center shrink-0">{statusMessage}</p>
          {error && (
            <div className="px-3 py-2 bg-[#fce8e6] border border-[#f5c6c2] rounded-xl
                            text-[#c5221f] text-xs text-center shrink-0">
              {error}
            </div>
          )}

          {/* Controls row — hidden on mobile (moved to bottom bar) */}
          <div className="hidden md:flex items-center gap-2.5 justify-center flex-wrap shrink-0">
            <button onClick={isCameraOn ? stopCamera : startCamera}
              className={`w-11 h-11 rounded-full flex items-center justify-center transition-all shadow-sm ${
                isCameraOn
                  ? 'bg-white text-[#5f6368] border border-[#dadce0] hover:bg-[#f8f9fa]'
                  : 'bg-[#f1f3f4] text-[#9aa0a6] hover:bg-[#e8eaed]'
              }`}>
              {isCameraOn ? <Camera size={19} /> : <CameraOff size={19} />}
            </button>

            {isConnected && isModelSpeaking && (
              <button onClick={interruptAgent}
                className="px-4 py-2.5 rounded-full flex items-center gap-2 font-medium text-sm
                           bg-[#f9ab00] hover:bg-[#e8a000] text-white shadow-sm transition-all animate-pulse">
                <StopCircle size={17} /> Interrupt
              </button>
            )}

            <button onClick={isConnected ? stopSession : startSession} disabled={isConnecting}
              className={`px-5 py-2.5 rounded-full flex items-center gap-2 font-medium text-sm
                          transition-all shadow-sm hover:shadow disabled:opacity-50 disabled:cursor-not-allowed ${
                isConnected
                  ? 'bg-[#ea4335] text-white hover:bg-[#d93025]'
                  : 'bg-[#1a73e8] text-white hover:bg-[#1765cc]'
              }`}>
              {isConnected
                ? <><MicOff size={17} /> Stop Voice</>
                : isConnecting
                  ? <><svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>Connecting...</>
                  : <><Mic size={17} /> Start Voice</>
              }
            </button>
          </div>

          {/* Capture button on mobile camera tab */}
          {isCameraOn && mobileTab === 'camera' && (
            <button onClick={() => { sendChatMessage(true); setMobileTab('chat'); }}
              disabled={isSending}
              className="md:hidden shrink-0 mx-auto flex items-center gap-2 px-5 py-2.5
                         rounded-full bg-[#1a73e8] text-white text-sm font-medium
                         shadow-sm disabled:opacity-50 transition-all">
              <Camera size={16} /> Capture & Ask
            </button>
          )}
        </div>

        {/* ══ RIGHT: Chat panel ═══════════════════════════════════════════════ */}
        <div className={`
          flex-col bg-white md:rounded-2xl shadow-sm md:border border-[#e8eaed] overflow-hidden
          flex-1
          ${mobileTab === 'chat' ? 'flex' : 'hidden md:flex'}
        `}>

          {/* Chat header */}
          <div className="shrink-0 px-4 py-2.5 border-b border-[#f1f3f4] flex items-center gap-2.5"
               style={{ paddingLeft: 'max(1rem, env(safe-area-inset-left, 0px))',
                        paddingRight: 'max(1rem, env(safe-area-inset-right, 0px))' }}>
            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[#4285f4] via-[#9b72cb] to-[#d96570]
                            flex items-center justify-center shrink-0">
              <Sparkles size={13} className="text-white" />
            </div>
            <span className="text-sm font-medium text-[#202124]">Gemini Tutor</span>
            <div className="ml-auto flex items-center gap-2">
              {isCameraOn && (
                <button onClick={() => sendChatMessage(true)} disabled={isSending}
                  className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium
                             text-[#1a73e8] bg-[#e8f0fe] hover:bg-[#d2e3fc] rounded-full
                             transition-colors disabled:opacity-50 min-h-[32px]">
                  <Camera size={11} /> Capture & Ask
                </button>
              )}
              {messages.length > 0 && (
                <span className="text-[10px] text-[#9aa0a6] bg-[#f1f3f4] px-2 py-0.5 rounded-full">
                  {messages.length}
                </span>
              )}
            </div>
          </div>

          {/* Messages scroll area */}
          <div className="flex-1 overflow-y-auto px-3 sm:px-4 py-4 space-y-4">
            {messages.length === 0 && !liveTranscript && (
              <div className="h-full flex flex-col items-center justify-center gap-3 py-8 px-4">
                <div className="w-12 h-12 md:w-14 md:h-14 rounded-full bg-gradient-to-br
                                from-[#4285f4] via-[#9b72cb] to-[#d96570] flex items-center justify-center">
                  <Sparkles size={20} className="text-white" />
                </div>
                <div className="text-center">
                  <p className="text-base font-medium text-[#202124] mb-1">How can I help you today?</p>
                  <p className="text-xs text-[#9aa0a6] max-w-[260px]">
                    Ask anything — visual topics get an AI illustration automatically.
                  </p>
                </div>
                <div className="flex flex-col gap-2 w-full max-w-xs mt-1">
                  {[
                    'Explain how photosynthesis works',
                    'Describe the Krebs cycle',
                    'How does DNA replication work?',
                  ].map(s => (
                    <button key={s}
                      onClick={() => { setChatInput(s); textareaRef.current?.focus(); }}
                      className="text-left px-4 py-2.5 rounded-xl border border-[#e8eaed] text-xs
                                 text-[#5f6368] hover:bg-[#f8f9fa] hover:border-[#dadce0]
                                 transition-colors flex items-center gap-2 min-h-[40px]">
                      <Palette size={11} className="text-[#9b72cb] shrink-0" /> {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((msg, i) => (
              <div key={i} className={`flex gap-2 sm:gap-2.5 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                {msg.role === 'assistant' && (
                  <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-gradient-to-br from-[#4285f4] via-[#9b72cb] to-[#d96570]
                                  flex items-center justify-center shrink-0 mt-0.5">
                    <Sparkles size={11} className="text-white" />
                  </div>
                )}
                <div className="max-w-[88%] sm:max-w-[82%]">
                  <div className={`px-3.5 sm:px-4 py-2.5 sm:py-3 text-sm leading-relaxed ${
                    msg.role === 'user'
                      ? 'bg-[#e8f0fe] text-[#1a1a1a] rounded-2xl rounded-tr-sm'
                      : 'bg-[#f8f9fa] text-[#3c4043] rounded-2xl rounded-tl-sm border border-[#e8eaed]'
                  }`}>
                    {msg.image && (
                      <img src={msg.image} alt="Captured"
                        className="rounded-lg mb-2.5 max-h-32 sm:max-h-36 w-auto" />
                    )}
                    <MarkdownContent text={msg.text} isUser={msg.role === 'user'} />

                    {msg.role === 'assistant' && msg.isGeneratingImage && <ImageGeneratingSkeleton />}
                    {msg.role === 'assistant' && msg.generatedImage && !msg.isGeneratingImage && (
                      <GeneratedImageCard
                        imageBase64={msg.generatedImage}
                        mimeType={msg.generatedImageMime || 'image/png'}
                        caption={msg.imageCaption}
                        onRegenerate={() => generateVisual(
                          messages.slice(0, i).reverse().find(m => m.role === 'user')?.text || msg.text, i
                        )}
                        isRegenerating={false}
                      />
                    )}
                  </div>

                  {/* Metadata */}
                  <div className={`flex items-center gap-1.5 mt-1 px-1 flex-wrap
                                   ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    {msg.source === 'voice' && (
                      <span className="text-[10px] text-[#9aa0a6] flex items-center gap-0.5">
                        <Mic size={9} /> Voice
                      </span>
                    )}
                    {msg.grounded && (
                      <span className="text-[10px] text-[#1e8e3e] flex items-center gap-0.5
                                       bg-[#e6f4ea] px-1.5 py-0.5 rounded-full">
                        <Globe size={9} /> Search
                      </span>
                    )}
                    {msg.role === 'assistant' && !msg.generatedImage && !msg.isGeneratingImage && (
                      <button
                        onClick={() => {
                          const q = messages.slice(0, i).reverse().find(m => m.role === 'user')?.text || msg.text;
                          generateVisual(q, i);
                        }}
                        className="text-[10px] text-[#9b72cb] flex items-center gap-0.5
                                   hover:bg-[#f3e8ff] px-1.5 py-0.5 rounded-full transition-colors min-h-[24px]">
                        <Palette size={9} /> Visualize
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}

            {liveTranscript && (
              <div className="flex gap-2 sm:gap-2.5 flex-row">
                <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-gradient-to-br from-[#4285f4] via-[#9b72cb] to-[#d96570]
                                flex items-center justify-center shrink-0 mt-0.5">
                  <Sparkles size={11} className="text-white" />
                </div>
                <div className="max-w-[88%] sm:max-w-[82%] px-3.5 sm:px-4 py-2.5 bg-[#f8f9fa] border border-[#e8eaed]
                                rounded-2xl rounded-tl-sm text-sm text-[#5f6368] italic">
                  {liveTranscript}
                  <span className="inline-block w-1 h-3.5 bg-[#4285f4] ml-0.5 animate-pulse rounded-sm" />
                </div>
              </div>
            )}

            {isSending && !liveTranscript && (
              <div className="flex gap-2 sm:gap-2.5">
                <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-gradient-to-br from-[#4285f4] via-[#9b72cb] to-[#d96570]
                                flex items-center justify-center shrink-0">
                  <Sparkles size={11} className="text-white" />
                </div>
                <div className="bg-[#f8f9fa] border border-[#e8eaed] rounded-2xl rounded-tl-sm px-4 py-3.5">
                  <div className="flex gap-1.5 items-center">
                    {[0, 160, 320].map(d => (
                      <span key={d} className="w-2 h-2 bg-[#bdc1c6] rounded-full animate-bounce"
                        style={{ animationDelay: `${d}ms` }} />
                    ))}
                  </div>
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* ── Input area ───────────────────────────────────────────────────── */}
          <div className="shrink-0 px-3 sm:px-4 pb-3 sm:pb-4 pt-2 border-t border-[#f1f3f4]"
               style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom, 0px))',
                        paddingLeft:   'max(0.75rem, env(safe-area-inset-left, 0px))',
                        paddingRight:  'max(0.75rem, env(safe-area-inset-right, 0px))' }}>
            <div className="relative rounded-[22px] bg-[#f1f3f4] border border-transparent
                            focus-within:bg-white focus-within:border-[#e0e0e0]
                            focus-within:shadow-[0_2px_10px_rgba(0,0,0,0.1)] transition-all">
              <textarea
                ref={textareaRef} value={chatInput}
                onChange={handleInputChange}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendChatMessage(false); } }}
                placeholder="Ask Gemini Tutor..."
                rows={1} disabled={isSending}
                className="w-full px-4 sm:px-5 pt-3.5 pb-11 text-sm text-[#202124] bg-transparent
                           resize-none outline-none placeholder:text-[#9aa0a6] leading-relaxed
                           max-h-[140px] sm:max-h-[180px] disabled:opacity-60"
              />
              <div className="absolute bottom-0 left-0 right-0 px-3 pb-2.5 flex items-center justify-between">
                <div className="flex items-center gap-1">
                  {isCameraOn && (
                    <button onClick={() => sendChatMessage(true)} disabled={isSending}
                      className="w-8 h-8 rounded-full hover:bg-[#e8eaed] flex items-center justify-center
                                 transition-colors text-[#5f6368]" title="Capture & Ask">
                      <Camera size={16} />
                    </button>
                  )}
                  <span className="text-[10px] text-[#bdc1c6] hidden lg:inline pl-1">
                    <CornerDownLeft size={9} className="inline mr-0.5" />Enter · Shift+Enter
                  </span>
                </div>
                <button onClick={() => sendChatMessage(false)}
                  disabled={isSending || !chatInput.trim()}
                  className="w-9 h-9 rounded-full flex items-center justify-center transition-all
                             bg-[#1a73e8] hover:bg-[#1765cc] text-white shadow-sm
                             disabled:bg-[#e8eaed] disabled:text-[#bdc1c6] disabled:shadow-none
                             disabled:cursor-not-allowed">
                  <Send size={15} />
                </button>
              </div>
            </div>
            <p className="text-center text-[10px] text-[#bdc1c6] mt-1.5 hidden sm:block">
              Gemini Tutor · Live Voice · AI Illustrations · Google Search · Google Cloud
            </p>
          </div>
        </div>
      </main>

      {/* ══ Mobile bottom controls bar ══════════════════════════════════════════
          Fixed above the keyboard on mobile. Tabs switch between Camera/Chat.
          Contains all voice controls in one swipeable row. */}
      <div className="md:hidden shrink-0 bg-white border-t border-[#e8eaed] flex items-center
                      justify-around px-4 py-2 gap-2"
           style={{ paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom, 0px))',
                    paddingLeft: 'max(1rem, env(safe-area-inset-left, 0px))',
                    paddingRight: 'max(1rem, env(safe-area-inset-right, 0px))' }}>

        {/* Camera toggle */}
        <button onClick={isCameraOn ? stopCamera : startCamera}
          className={`flex flex-col items-center gap-0.5 min-w-[52px] min-h-[44px] justify-center
                      rounded-xl transition-all px-2 ${
            isCameraOn ? 'text-[#1a73e8] bg-[#e8f0fe]' : 'text-[#5f6368]'
          }`}>
          {isCameraOn ? <Camera size={20} /> : <CameraOff size={20} />}
          <span className="text-[9px] font-medium">{isCameraOn ? 'Camera' : 'Camera'}</span>
        </button>

        {/* Interrupt (shown when model is speaking) */}
        {isConnected && isModelSpeaking ? (
          <button onClick={interruptAgent}
            className="flex flex-col items-center gap-0.5 min-w-[52px] min-h-[44px] justify-center
                       rounded-xl bg-[#fef7e0] text-[#b06000] animate-pulse px-2">
            <StopCircle size={20} />
            <span className="text-[9px] font-medium">Stop</span>
          </button>
        ) : (
          <div className="min-w-[52px]" />
        )}

        {/* Start / Stop Voice — centre, most prominent */}
        <button onClick={isConnected ? stopSession : startSession} disabled={isConnecting}
          className={`flex flex-col items-center gap-0.5 min-w-[64px] min-h-[52px] justify-center
                      rounded-2xl font-medium transition-all px-3 shadow-sm disabled:opacity-50 ${
            isConnected
              ? 'bg-[#ea4335] text-white'
              : 'bg-[#1a73e8] text-white'
          }`}>
          {isConnected
            ? <><MicOff size={22} /><span className="text-[9px]">Stop</span></>
            : isConnecting
              ? <><svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg><span className="text-[9px]">...</span></>
              : <><Mic size={22} /><span className="text-[9px]">Voice</span></>
          }
        </button>

        {/* Placeholder / spacer right side */}
        <div className="min-w-[52px]" />

        {/* Go to chat tab shortcut */}
        <button onClick={() => setMobileTab('chat')}
          className={`flex flex-col items-center gap-0.5 min-w-[52px] min-h-[44px] justify-center
                      rounded-xl transition-all px-2 ${
            mobileTab === 'chat' ? 'text-[#1a73e8] bg-[#e8f0fe]' : 'text-[#5f6368]'
          }`}>
          <MessageSquare size={20} />
          <span className="text-[9px] font-medium">Chat</span>
        </button>
      </div>
    </div>
  );
}



// ─── App Root ─────────────────────────────────────────────────────────────────

export default function App() {
  const [screen, setScreen] = useState<'welcome' | 'tutor'>('welcome');
  const [apiKey, setApiKey] = useState('');
  if (screen === 'welcome')
    return <WelcomeScreen onStart={k => { setApiKey(k); setScreen('tutor'); }} />;
  return <TutorScreen apiKey={apiKey} onBack={() => setScreen('welcome')} />;
}
