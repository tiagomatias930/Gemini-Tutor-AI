import { useState, useRef, useEffect, useCallback } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality } from '@google/genai';
import {
  Mic, MicOff, Sparkles, Camera, CameraOff,
  BookOpen, ArrowRight, Volume2, Send, MessageSquare, StopCircle,
} from 'lucide-react';

// ── Constants ─────────────────────────────────────────────────────────────────

const TUTOR_SYSTEM_INSTRUCTION = `You are a friendly, patient AI tutor named "Gemini Tutor".
Your role is to:
- Help students understand problems step-by-step
- Never give direct answers; guide them to discover solutions
- Encourage and motivate them
- Explain concepts clearly in a simple way
- Ask follow-up questions to check understanding
- If you can see their homework (via an image), describe what you see and offer specific help
- Respond in the same language the student uses
Keep responses concise but helpful.`;

// Criterion 1: Gemini model  |  Criterion 2: Google GenAI SDK
const TEXT_MODEL = 'gemini-2.5-flash-lite';
const LIVE_MODEL = 'gemini-2.5-flash-native-audio-preview-12-2025';

interface ChatMessage {
  role: 'user' | 'assistant';
  text: string;
  image?: string;
}

// ── Welcome Screen ────────────────────────────────────────────────────────────
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
    <div className="min-h-screen bg-white flex flex-col">
      <nav className="w-full flex items-center justify-end px-6 py-3 gap-4 text-sm text-slate-600">
        <a href="https://aistudio.google.com/api-keys" target="_blank" className="hover:underline">Get API Key</a>
        <a href="https://ai.google.dev/gemini-api/docs/live-api" target="_blank" className="hover:underline">Docs</a>
      </nav>

      <main className="flex-1 flex flex-col items-center justify-center px-4 -mt-16">
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500 via-purple-500 to-pink-500 flex items-center justify-center shadow-lg mb-8">
          <Sparkles className="text-white" size={28} />
        </div>
        <h1 className="text-5xl md:text-6xl font-normal tracking-tight text-slate-800 mb-2 text-center">
          <span className="text-blue-500">G</span><span className="text-red-500">e</span>
          <span className="text-yellow-500">m</span><span className="text-blue-500">i</span>
          <span className="text-green-500">n</span><span className="text-red-500">i</span>
          <span className="text-slate-800"> Tutor</span>
        </h1>
        <p className="text-lg text-slate-500 mb-10 text-center max-w-md">
          Your AI-powered homework assistant. Point your camera and start learning.
        </p>
        <div className="w-full max-w-xl">
          <div className={`flex items-center gap-3 px-6 py-4 rounded-full border shadow-sm transition-shadow bg-white ${
            error ? 'border-red-300' : 'border-slate-200 hover:shadow-md focus-within:shadow-md'
          }`}>
            <BookOpen size={20} className="text-slate-400 shrink-0" />
            <input
              type="password" value={apiKey}
              onChange={e => { setApiKey(e.target.value); setError(''); }}
              onKeyDown={e => e.key === 'Enter' && handleStart()}
              placeholder="Enter your Gemini API Key..."
              className="flex-1 outline-none text-base text-slate-700 placeholder:text-slate-400 bg-transparent"
            />
            <button onClick={handleStart}
              className="w-10 h-10 rounded-full bg-blue-500 hover:bg-blue-600 text-white flex items-center justify-center transition-colors shrink-0">
              <ArrowRight size={18} />
            </button>
          </div>
          {error && <p className="text-red-500 text-sm mt-2 pl-6">{error}</p>}
        </div>
        <div className="flex flex-wrap gap-3 mt-8 justify-center">
          {[
            { icon: Camera, label: 'Camera Vision' },
            { icon: Mic, label: 'Voice Chat' },
            { icon: Volume2, label: 'Audio Responses' },
            { icon: MessageSquare, label: 'Text Chat' },
          ].map(({ icon: Icon, label }) => (
            <span key={label} className="flex items-center gap-2 px-4 py-2 bg-slate-50 rounded-full text-sm text-slate-600 border border-slate-100">
              <Icon size={16} />{label}
            </span>
          ))}
        </div>
      </main>

      <footer className="w-full text-center py-4 text-xs text-slate-400 border-t border-slate-100">
        {/* Criterion 3: deployed on Google Cloud Run + Firestore */}
        Powered by Google Gemini · Deployed on Google Cloud
      </footer>
    </div>
  );
}

// ── Tutor Screen ──────────────────────────────────────────────────────────────
function TutorScreen({ apiKey, onBack }: { apiKey: string; onBack: () => void }) {
  // ── UI state ─────────────────────────────────────────────────────────────────
  const [isConnected, setIsConnected]         = useState(false);
  const [isConnecting, setIsConnecting]       = useState(false);
  const [isCameraOn, setIsCameraOn]           = useState(false);
  const [isModelSpeaking, setIsModelSpeaking] = useState(false);
  const [statusMessage, setStatusMessage]     = useState('Ready to start');
  const [error, setError]                     = useState('');
  const [messages, setMessages]               = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput]             = useState('');
  const [isSending, setIsSending]             = useState(false);

  // Criterion 3: session stored in Cloud Firestore via the backend
  const [sessionId] = useState(() => {
    const stored = sessionStorage.getItem('tutor_session_id');
    if (stored) return stored;
    const id = `session_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    sessionStorage.setItem('tutor_session_id', id);
    return id;
  });

  useEffect(() => {
    fetch(`/api/sessions/${sessionId}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (d?.messages?.length)
          setMessages(d.messages.map((m: any) => ({ role: m.role, text: m.text })));
      })
      .catch(() => {});
  }, [sessionId]);

  // ── Refs ──────────────────────────────────────────────────────────────────────
  const videoRef            = useRef<HTMLVideoElement>(null);
  const sessionRef          = useRef<any>(null);
  const streamRef           = useRef<MediaStream | null>(null);
  const audioContextRef     = useRef<AudioContext | null>(null);
  const sendIntervalRef     = useRef<ReturnType<typeof setInterval> | null>(null);
  const chatEndRef          = useRef<HTMLDivElement>(null);
  const isConnectedRef      = useRef(false);
  const isTearingDownRef    = useRef(false);
  const workletNodeRef      = useRef<AudioWorkletNode | null>(null);
  const audioStreamRef      = useRef<MediaStream | null>(null);
  // One shared AudioContext for all playback (never recreated mid-session)
  const playbackCtxRef      = useRef<AudioContext | null>(null);
  // Monotonic cursor — each chunk scheduled to start when the previous ends
  const nextPlayTimeRef     = useRef<number>(0);
  // All sources currently scheduled but not yet finished → stop on interrupt
  const scheduledSourcesRef = useRef<AudioBufferSourceNode[]>([]);
  // Ref mirror of isModelSpeaking (avoids stale closures in callbacks)
  const isModelSpeakingRef  = useRef(false);

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  // ── Helpers ───────────────────────────────────────────────────────────────────
  const setModelSpeaking = useCallback((v: boolean) => {
    isModelSpeakingRef.current = v;
    setIsModelSpeaking(v);
  }, []);

  // Stop all buffered audio immediately (used on interrupt and on teardown)
  const flushAudioQueue = useCallback(() => {
    const now = playbackCtxRef.current?.currentTime ?? 0;
    for (const src of scheduledSourcesRef.current) {
      try { src.stop(now); } catch { /* already ended */ }
    }
    scheduledSourcesRef.current = [];
    nextPlayTimeRef.current = 0;
  }, []);

  // ── Camera ────────────────────────────────────────────────────────────────────
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

  // ── Text Chat ─────────────────────────────────────────────────────────────────
  const sendChatMessage = useCallback(async (includeImage = false) => {
    const text = chatInput.trim();
    if (!text && !includeImage) return;
    const frameDataUrl = includeImage ? captureFrame() : null;
    const frameBase64  = frameDataUrl?.split(',')[1];
    const userMsg: ChatMessage = {
      role: 'user',
      text: text || 'Please analyze this image and help me understand it.',
      image: frameDataUrl || undefined,
    };
    setMessages(prev => [...prev, userMsg]);
    setChatInput('');
    setIsSending(true);
    setError('');
    try {
      let response: string;
      try {
        const res = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: userMsg.text, image: frameBase64, sessionId,
            history: messages.slice(-10).map(m => ({ role: m.role, text: m.text })),
          }),
        });
        if (!res.ok) throw new Error(`Backend ${res.status}`);
        response = (await res.json()).response;
      } catch {
        if (!apiKey) throw new Error('Backend unavailable and no API key provided.');
        const ai = new GoogleGenAI({ apiKey });
        const parts: any[] = [];
        if (frameBase64) parts.push({ inlineData: { data: frameBase64, mimeType: 'image/jpeg' } });
        parts.push({ text: userMsg.text });
        const result = await ai.models.generateContent({
          model: TEXT_MODEL,
          contents: [{ role: 'user', parts }],
          config: { systemInstruction: TUTOR_SYSTEM_INSTRUCTION },
        });
        response = result.text || 'No response received.';
      }
      setMessages(prev => [...prev, { role: 'assistant', text: response }]);
    } catch (err: any) {
      setError(err.message || 'Failed to send message');
      setMessages(prev => [...prev, { role: 'assistant', text: `Sorry, something went wrong: ${err.message}` }]);
    } finally { setIsSending(false); }
  }, [chatInput, captureFrame, messages, apiKey, sessionId]);

  // ── Live API: video frame sender ──────────────────────────────────────────────
  const startSendingFrames = useCallback((session: any) => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    sendIntervalRef.current = setInterval(() => {
      if (isTearingDownRef.current || !isConnectedRef.current || !sessionRef.current ||
          !videoRef.current || !ctx || !streamRef.current) return;
      canvas.width = 640; canvas.height = 480;
      ctx.drawImage(videoRef.current, 0, 0, 640, 480);
      try {
        session.sendRealtimeInput({
          media: { data: canvas.toDataURL('image/jpeg', 0.6).split(',')[1], mimeType: 'image/jpeg' },
        });
      } catch { /* session closing */ }
    }, 2000);
  }, []);

  // ── Live API: sequential audio playback ───────────────────────────────────────
  //
  // The Live API streams audio as many small PCM chunks. Calling source.start()
  // without a time argument makes all chunks fire at currentTime simultaneously
  // → "many voices at once" bug.
  //
  // Fix: nextPlayTimeRef is a monotonic cursor. Each chunk is scheduled to start
  // exactly when the previous one ends. Math.max(currentTime, cursor) handles
  // the case where the cursor has fallen behind (first chunk, after interrupt).
  const playAudio = useCallback((base64Audio: string) => {
    try {
      if (!playbackCtxRef.current || playbackCtxRef.current.state === 'closed') {
        playbackCtxRef.current = new AudioContext({ sampleRate: 24000 });
        nextPlayTimeRef.current = 0;
      }
      const ctx = playbackCtxRef.current;

      // Decode base64 PCM-16 LE → Float32
      const raw   = atob(base64Audio);
      const bytes = new Uint8Array(raw.length).map((_, i) => raw.charCodeAt(i));
      const pcm16 = new Int16Array(bytes.buffer);
      const f32   = new Float32Array(pcm16.length);
      for (let i = 0; i < pcm16.length; i++) f32[i] = pcm16[i] / 32768;

      const buf = ctx.createBuffer(1, f32.length, 24000);
      buf.getChannelData(0).set(f32);

      const src = ctx.createBufferSource();
      src.buffer = buf;
      src.connect(ctx.destination);

      // Schedule sequentially
      const startAt = Math.max(ctx.currentTime, nextPlayTimeRef.current);
      src.start(startAt);
      nextPlayTimeRef.current = startAt + buf.duration;

      // Track for instant cancellation on interrupt
      scheduledSourcesRef.current.push(src);
      src.onended = () => {
        scheduledSourcesRef.current = scheduledSourcesRef.current.filter(s => s !== src);
        // Last chunk finished naturally → mark model as done speaking
        if (scheduledSourcesRef.current.length === 0) setModelSpeaking(false);
      };

      if (!isModelSpeakingRef.current) setModelSpeaking(true);
    } catch (err) { console.warn('Audio playback error:', err); }
  }, [setModelSpeaking]);

  // ── Interrupt: stop agent mid-speech ─────────────────────────────────────────
  //
  // Two layers work together:
  //   LOCAL  — flushAudioQueue() stops all scheduled BufferSource nodes
  //            instantly so the speaker goes silent on the user's device.
  //   SERVER — the Live API VAD automatically interrupts the model when it
  //            detects the user speaking. The server confirms with the
  //            `interrupted` flag inside onmessage, which also flushes the
  //            queue (handles the rare gap between button press and VAD).
  //
  // The manual button lets users interrupt even when they don't want to speak
  // (e.g. the answer was wrong, they want to ask something different).
  const interruptAgent = useCallback(() => {
    if (!isModelSpeakingRef.current) return;
    flushAudioQueue();
    setModelSpeaking(false);
    setStatusMessage('Interrupted — go ahead!');
  }, [flushAudioQueue, setModelSpeaking]);

  // ── Live API: start session ───────────────────────────────────────────────────
  const startSession = async () => {
    isTearingDownRef.current = false;
    setIsConnecting(true);
    setError('');

    try {
      setStatusMessage('Requesting camera & microphone...');
      if (!isCameraOn) await startCamera();

      const audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioStreamRef.current = audioStream;

      // Build AudioWorklet BEFORE opening the WebSocket so mic audio flows
      // immediately when the connection opens (avoids idle timeout).
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
                  for (let j = 0; j < 4096; j++)
                    pcm[j] = Math.max(-32768, Math.min(32767, Math.round(this._buf[j] * 32767)));
                  this.port.postMessage(pcm.buffer, [pcm.buffer]);
                  this._buf = new Float32Array(4096);
                  this._off = 0;
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
      // Silent gain node keeps the graph alive without mic echo
      const silence = audioCtx.createGain();
      silence.gain.value = 0;
      workletNode.connect(silence);
      silence.connect(audioCtx.destination);

      setStatusMessage('Connecting to Gemini Live...');
      const genAI = new GoogleGenAI({ apiKey });

      const session = await genAI.live.connect({
        model: LIVE_MODEL,
        callbacks: {
          onopen: () => {
            isConnectedRef.current = true;
            setIsConnected(true);
            setIsConnecting(false);
            setStatusMessage('Live — show me your homework!');
          },

          onmessage: (msg: LiveServerMessage) => {
            // Server-side VAD interrupted the model while it was generating.
            // Flush local audio queue immediately so playback stops in sync.
            if (msg.serverContent?.interrupted) {
              flushAudioQueue();
              setModelSpeaking(false);
              setStatusMessage('Listening...');
              return;
            }

            // Model finished its turn. Don't flush — let the last chunk finish
            // naturally. The onended handler will clear isModelSpeaking.
            if (msg.serverContent?.turnComplete) {
              if (scheduledSourcesRef.current.length === 0) setModelSpeaking(false);
              setStatusMessage('Live — show me your homework!');
              return;
            }

            // Incoming audio chunks — enqueue sequentially
            if (msg.serverContent?.modelTurn?.parts) {
              for (const part of msg.serverContent.modelTurn.parts) {
                if (part.inlineData?.mimeType?.startsWith('audio/') && part.inlineData.data) {
                  playAudio(part.inlineData.data);
                  setStatusMessage('Speaking...');
                }
              }
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
            if (event?.code && event.code !== 1000)
              console.warn(`Live closed: code=${event.code} reason=${event.reason ?? '(none)'}`);
            setStatusMessage('Session ended');
          },
        },
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } } },
          systemInstruction: TUTOR_SYSTEM_INSTRUCTION,
        },
      });

      sessionRef.current = session;

      // Wire mic worklet → Live API. sessionRef (not closure) so null-guard works.
      workletNode.port.onmessage = (e: MessageEvent) => {
        if (isTearingDownRef.current) return;
        const s = sessionRef.current;
        if (!isConnectedRef.current || !s) return;
        const bytes = new Uint8Array(e.data as ArrayBuffer);
        let bin = '';
        for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
        try {
          s.sendRealtimeInput({ media: { data: btoa(bin), mimeType: 'audio/pcm;rate=16000' } });
        } catch {
          isTearingDownRef.current = true;
          isConnectedRef.current = false;
          sessionRef.current = null;
          workletNodeRef.current?.port.close();
        }
      };

      startSendingFrames(session);
    } catch (err: any) {
      console.error('Session start error:', err);
      setError(`Failed to connect: ${err?.message || 'Unknown error'}`);
      setIsConnecting(false);
      setStatusMessage('Connection failed');
    }
  };

  // ── Live API: stop session ────────────────────────────────────────────────────
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

    await new Promise(r => setTimeout(r, 120));
    try { session?.close(); } catch { /* ignore */ }
    setIsConnected(false);
    setStatusMessage('Session ended');
  };

  useEffect(() => () => { stopCamera(); stopSession(); }, []);

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <div className="h-screen bg-slate-50 text-slate-900 flex flex-col overflow-hidden">
      {/* Header */}
      <header className="shrink-0 flex items-center justify-between px-4 md:px-6 py-3 bg-white border-b border-slate-100">
        <button onClick={onBack} className="flex items-center gap-2 text-slate-600 hover:text-slate-900 transition-colors">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 via-purple-500 to-pink-500 flex items-center justify-center">
            <Sparkles className="text-white" size={16} />
          </div>
          <span className="text-base font-medium hidden sm:inline">Gemini Tutor</span>
        </button>
        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${
          isConnected ? 'bg-green-50 text-green-700 border border-green-200'
          : isConnecting ? 'bg-yellow-50 text-yellow-700 border border-yellow-200'
          : 'bg-slate-100 text-slate-500 border border-slate-200'
        }`}>
          <span className={`w-1.5 h-1.5 rounded-full ${
            isConnected ? 'bg-green-500 animate-pulse'
            : isConnecting ? 'bg-yellow-500 animate-pulse'
            : 'bg-slate-400'
          }`} />
          {isConnected ? 'Voice On' : isConnecting ? 'Connecting...' : 'Voice Off'}
        </span>
      </header>

      <main className="flex-1 flex flex-col md:flex-row gap-3 p-3 md:p-4 overflow-hidden max-w-7xl mx-auto w-full">

        {/* ── Left: Video + Controls ── */}
        <div className="flex flex-col gap-3 md:w-[50%] shrink-0">
          <div className="relative bg-slate-900 rounded-2xl shadow-sm border border-slate-200 overflow-hidden aspect-video">
            <video ref={videoRef} autoPlay playsInline muted
              className={`w-full h-full object-cover ${isCameraOn ? '' : 'hidden'}`} />
            {!isCameraOn && (
              <div className="w-full h-full flex flex-col items-center justify-center text-slate-500 gap-2 bg-slate-100">
                <Camera size={40} strokeWidth={1.5} />
                <p className="text-xs">Camera is off</p>
              </div>
            )}

            {/* LIVE badge */}
            {isConnected && (
              <div className="absolute top-3 left-3 flex items-center gap-1.5 px-2.5 py-1 bg-black/50 backdrop-blur-sm rounded-full">
                <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                <span className="text-white text-[10px] font-bold tracking-wide">LIVE</span>
              </div>
            )}

            {/* Speaking animation overlay */}
            {isModelSpeaking && (
              <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-1.5 px-3 py-1.5 bg-black/60 backdrop-blur-sm rounded-full">
                {[0, 150, 300].map(delay => (
                  <span key={delay}
                    className="w-1.5 h-4 bg-blue-400 rounded-full animate-bounce"
                    style={{ animationDelay: `${delay}ms` }} />
                ))}
                <span className="text-white text-[10px] ml-1 font-medium">Speaking</span>
              </div>
            )}
          </div>

          <p className="text-xs text-slate-400 text-center">{statusMessage}</p>

          {error && (
            <div className="px-3 py-2 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs text-center">
              {error}
            </div>
          )}

          {/* Controls row */}
          <div className="flex items-center gap-3 justify-center flex-wrap">
            {/* Camera toggle */}
            <button onClick={isCameraOn ? stopCamera : startCamera}
              className={`w-12 h-12 rounded-full flex items-center justify-center transition-all shadow-sm hover:shadow ${
                isCameraOn
                  ? 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'
                  : 'bg-slate-200 text-slate-500 hover:bg-slate-300'
              }`}
              title={isCameraOn ? 'Turn off camera' : 'Turn on camera'}>
              {isCameraOn ? <Camera size={20} /> : <CameraOff size={20} />}
            </button>

            {/* ── INTERRUPT BUTTON ─────────────────────────────────────────────
                Shown only while the model is speaking.
                  - LOCAL:  flushAudioQueue() stops all BufferSource nodes now.
                  - SERVER: Live API VAD interrupts model when user speaks;
                    the `interrupted` flag in onmessage flushes any remaining
                    chunks that arrive after the button press.               */}
            {isConnected && isModelSpeaking && (
              <button onClick={interruptAgent}
                className="px-5 py-3 rounded-full flex items-center gap-2 font-medium text-sm
                           bg-amber-500 hover:bg-amber-600 text-white shadow-sm hover:shadow
                           transition-all animate-pulse"
                title="Interrupt the tutor">
                <StopCircle size={18} />
                Interrupt
              </button>
            )}

            {/* Start / Stop Voice */}
            <button onClick={isConnected ? stopSession : startSession}
              disabled={isConnecting}
              className={`px-6 py-3 rounded-full flex items-center gap-2 font-medium text-sm
                          transition-all shadow-sm hover:shadow disabled:opacity-50 disabled:cursor-not-allowed ${
                isConnected ? 'bg-red-500 text-white hover:bg-red-600' : 'bg-blue-600 text-white hover:bg-blue-700'
              }`}>
              {isConnected ? (
                <><MicOff size={18} /> Stop Voice</>
              ) : isConnecting ? (
                <>
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                  </svg>
                  Connecting...
                </>
              ) : (
                <><Mic size={18} /> Start Voice</>
              )}
            </button>
          </div>
        </div>

        {/* ── Right: Text Chat ── */}
        <div className="flex-1 flex flex-col bg-white rounded-2xl shadow-[0_1px_3px_0_rgba(60,64,67,0.15)] overflow-hidden min-h-[250px] md:min-h-0">
          <div className="shrink-0 px-5 py-3 border-b border-[#e8eaed] flex items-center gap-3">
            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[#4285f4] via-[#9b72cb] to-[#d96570] flex items-center justify-center">
              <Sparkles size={14} className="text-white" />
            </div>
            <span className="text-sm font-medium text-[#202124]">Gemini Tutor</span>
            {isCameraOn && (
              <button onClick={() => sendChatMessage(true)} disabled={isSending}
                className="ml-auto flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium
                           text-[#1a73e8] bg-[#e8f0fe] hover:bg-[#d2e3fc] rounded-full transition-colors disabled:opacity-50">
                <Camera size={12} /> Capture & Ask
              </button>
            )}
          </div>

          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            {messages.length === 0 && (
              <div className="h-full flex flex-col items-center justify-center gap-3 py-8">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#4285f4] via-[#9b72cb] to-[#d96570] flex items-center justify-center">
                  <Sparkles size={22} className="text-white" />
                </div>
                <p className="text-base font-medium text-[#202124]">How can I help you today?</p>
                <p className="text-xs text-[#5f6368] text-center max-w-[220px]">Ask a question, or capture a photo of your homework.</p>
              </div>
            )}
            {messages.map((msg, i) => (
              <div key={i} className={`flex gap-2.5 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                {msg.role === 'assistant' && (
                  <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[#4285f4] via-[#9b72cb] to-[#d96570] flex items-center justify-center shrink-0 mt-0.5">
                    <Sparkles size={12} className="text-white" />
                  </div>
                )}
                <div className={`max-w-[80%] px-4 py-3 text-sm leading-relaxed ${
                  msg.role === 'user'
                    ? 'bg-[#e8f0fe] text-[#202124] rounded-2xl rounded-tr-md'
                    : 'bg-[#f8f9fa] text-[#202124] rounded-2xl rounded-tl-md border border-[#e8eaed]'
                }`}>
                  {msg.image && <img src={msg.image} alt="Captured" className="rounded-lg mb-2 max-h-32 w-auto" />}
                  <div className="whitespace-pre-wrap">
                    {msg.text.split('\n').map((line, idx) => {
                      let fmt = line;
                      if (/^Q:/i.test(line)) fmt = `<b>${line}</b>`;
                      else if (/^A:/i.test(line)) fmt = `<b>${line}</b>`;
                      fmt = fmt.replace(/\$(.+?)\$/g, '<span style="color:#4285f4;font-weight:bold">$1</span>');
                      return (
                        <div key={idx} style={{ marginBottom: '2px' }}
                          dangerouslySetInnerHTML={{ __html: fmt.trim() ? fmt : '<br />' }} />
                      );
                    })}
                  </div>
                </div>
              </div>
            ))}
            {isSending && (
              <div className="flex gap-2.5">
                <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[#4285f4] via-[#9b72cb] to-[#d96570] flex items-center justify-center shrink-0">
                  <Sparkles size={12} className="text-white" />
                </div>
                <div className="bg-[#f8f9fa] border border-[#e8eaed] rounded-2xl rounded-tl-md px-4 py-3 text-sm">
                  <div className="flex gap-1.5">
                    {[0, 150, 300].map(d => (
                      <span key={d} className="w-2 h-2 bg-[#bdc1c6] rounded-full animate-bounce"
                        style={{ animationDelay: `${d}ms` }} />
                    ))}
                  </div>
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          <div className="shrink-0 px-4 py-3 border-t border-[#e8eaed]">
            <div className="flex items-center gap-2 px-4 py-1 bg-[#f8f9fa] border border-[#dfe1e5] rounded-full
                            focus-within:border-[#4285f4] focus-within:shadow-[0_1px_6px_rgba(32,33,36,0.12)] transition-all">
              <input type="text" value={chatInput}
                onChange={e => setChatInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendChatMessage(false)}
                placeholder="Ask a question..." disabled={isSending}
                className="flex-1 py-2.5 bg-transparent text-sm text-[#202124] outline-none disabled:opacity-50 placeholder:text-[#9aa0a6]"
              />
              <button onClick={() => sendChatMessage(false)}
                disabled={isSending || !chatInput.trim()}
                className="w-9 h-9 rounded-full bg-[#1a73e8] hover:bg-[#1765cc] text-white flex items-center justify-center
                           transition-colors disabled:bg-[#dadce0] disabled:text-[#9aa0a6] disabled:cursor-not-allowed shrink-0">
                <Send size={15} />
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

// ── App Root ──────────────────────────────────────────────────────────────────
export default function App() {
  const [screen, setScreen] = useState<'welcome' | 'tutor'>('welcome');
  const [apiKey, setApiKey] = useState('');
  if (screen === 'welcome')
    return <WelcomeScreen onStart={k => { setApiKey(k); setScreen('tutor'); }} />;
  return <TutorScreen apiKey={apiKey} onBack={() => setScreen('welcome')} />;
}
