import { useState, useRef, useEffect, useCallback } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality } from '@google/genai';
import { Mic, MicOff, Sparkles, Camera, CameraOff, BookOpen, ArrowRight, Volume2, Send, MessageSquare } from 'lucide-react';

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

interface ChatMessage {
  role: 'user' | 'assistant';
  text: string;
  image?: string; // data URL for display
}

// ── Welcome Screen (Google-style) ────────────────────────────────────────────
function WelcomeScreen({ onStart }: { onStart: (key: string) => void }) {
  const [apiKey, setApiKey] = useState(() => {
    return localStorage.getItem('gemini_api_key') || process.env.GEMINI_API_KEY || '';
  });
  const [error, setError] = useState('');

  const handleStart = () => {
    const key = apiKey.trim();
    if (!key) {
      setError('Please enter your Gemini API key to continue.');
      return;
    }
    localStorage.setItem('gemini_api_key', key);
    onStart(key);
  };

  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* Top bar */}
      <nav className="w-full flex items-center justify-end px-6 py-3 gap-4 text-sm text-slate-600">
        <a href="https://aistudio.google.com/api-keys" target="_blank"
           className="hover:underline">Get API Key</a>
        <a href="https://aistudio.google.com/docs" target="_blank"
           className="hover:underline">Docs</a>
      </nav>

      {/* Center content */}
      <main className="flex-1 flex flex-col items-center justify-center px-4 -mt-16">
        {/* Logo */}
        <div className="flex items-center gap-3 mb-8">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500 via-purple-500 to-pink-500 flex items-center justify-center shadow-lg">
            <Sparkles className="text-white" size={28} />
          </div>
        </div>

        <h1 className="text-5xl md:text-6xl font-normal tracking-tight text-slate-800 mb-2 text-center">
          <span className="text-blue-500">G</span>
          <span className="text-red-500">e</span>
          <span className="text-yellow-500">m</span>
          <span className="text-blue-500">i</span>
          <span className="text-green-500">n</span>
          <span className="text-red-500">i</span>
          <span className="text-slate-800"> Tutor</span>
        </h1>

        <p className="text-lg text-slate-500 mb-10 text-center max-w-md">
          Your AI-powered homework assistant. Point your camera and start learning.
        </p>

        {/* Search-bar style input */}
        <div className="w-full max-w-xl">
          <div className={`flex items-center gap-3 px-6 py-4 rounded-full border ${
            error ? 'border-red-300 shadow-red-100' : 'border-slate-200 hover:shadow-md focus-within:shadow-md'
          } shadow-sm transition-shadow bg-white`}>
            <BookOpen size={20} className="text-slate-400 shrink-0" />
            <input
              type="password"
              value={apiKey}
              onChange={(e) => { setApiKey(e.target.value); setError(''); }}
              onKeyDown={(e) => e.key === 'Enter' && handleStart()}
              placeholder="Enter your Gemini API Key..."
              className="flex-1 outline-none text-base text-slate-700 placeholder:text-slate-400 bg-transparent"
            />
            <button
              onClick={handleStart}
              className="w-10 h-10 rounded-full bg-blue-500 hover:bg-blue-600 text-white flex items-center justify-center transition-colors shrink-0"
            >
              <ArrowRight size={18} />
            </button>
          </div>
          {error && <p className="text-red-500 text-sm mt-2 pl-6">{error}</p>}
        </div>

        {/* Feature pills */}
        <div className="flex flex-wrap gap-3 mt-8 justify-center">
          {[
            { icon: Camera, label: 'Camera Vision' },
            { icon: Mic, label: 'Voice Chat' },
            { icon: Volume2, label: 'Audio Responses' },
            { icon: MessageSquare, label: 'Text Chat' },
          ].map(({ icon: Icon, label }) => (
            <span key={label} className="flex items-center gap-2 px-4 py-2 bg-slate-50 rounded-full text-sm text-slate-600 border border-slate-100">
              <Icon size={16} />
              {label}
            </span>
          ))}
        </div>
      </main>

      {/* Footer */}
      <footer className="w-full text-center py-4 text-xs text-slate-400 border-t border-slate-100">
        Powered by Google Cloud Vertex AI &middot; Gemini Tutor
      </footer>
    </div>
  );
}

// ── Tutor Screen ─────────────────────────────────────────────────────────────
function TutorScreen({ apiKey, onBack }: { apiKey: string; onBack: () => void }) {
  // -- Live session state --
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isCameraOn, setIsCameraOn] = useState(false);
  const [statusMessage, setStatusMessage] = useState('Ready to start');
  const [error, setError] = useState('');

  // -- Chat state --
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [isSending, setIsSending] = useState(false);

  // -- Session ID for Firestore persistence (Google Cloud) --
  const [sessionId] = useState(() => {
    const stored = sessionStorage.getItem('tutor_session_id');
    if (stored) return stored;
    const id = `session_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    sessionStorage.setItem('tutor_session_id', id);
    return id;
  });

  // Load previous session history from Firestore on mount
  useEffect(() => {
    fetch(`/api/sessions/${sessionId}`)
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (data?.messages?.length) {
          setMessages(data.messages.map((m: any) => ({
            role: m.role,
            text: m.text,
          })));
        }
      })
      .catch(() => { /* Firestore unavailable, start fresh */ });
  }, [sessionId]);

  // -- Refs --
  const videoRef = useRef<HTMLVideoElement>(null);
  const sessionRef = useRef<any>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const sendIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const isConnectedRef = useRef(false);
  const workletNodeRef = useRef<AudioWorkletNode | null>(null);
  const audioStreamRef = useRef<MediaStream | null>(null);

  // Auto-scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // ── Camera ──────────────────────────────────────────────────────────────────
  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
      setIsCameraOn(true);
    } catch (err) {
      console.error('Camera error:', err);
      setError('Could not access camera. Please check permissions.');
    }
  }, []);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach(track => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setIsCameraOn(false);
  }, []);

  // ── Capture frame from video ────────────────────────────────────────────────
  const captureFrame = useCallback((): string | null => {
    if (!videoRef.current || !isCameraOn) return null;
    const canvas = document.createElement('canvas');
    const video = videoRef.current;
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', 0.8);
  }, [isCameraOn]);

  // ── Text Chat (goes through backend or direct API) ──────────────────────────
  const sendChatMessage = useCallback(async (includeImage = false) => {
    const text = chatInput.trim();
    if (!text && !includeImage) return;

    const frameDataUrl = includeImage ? captureFrame() : null;
    const frameBase64 = frameDataUrl ? frameDataUrl.split(',')[1] : undefined;

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

      // Try backend first (works when deployed on Cloud Run, or locally with proxy)
      try {
        const res = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: userMsg.text,
            image: frameBase64,
            sessionId,
            history: messages.slice(-10).map(m => ({ role: m.role, text: m.text })),
          }),
        });
        if (!res.ok) throw new Error(`Backend responded ${res.status}`);
        const data = await res.json();
        response = data.response;
      } catch {
        // Fallback: direct Gemini API call from browser
        if (!apiKey) throw new Error('Backend unavailable and no API key provided.');
        const ai = new GoogleGenAI({ apiKey });
        const parts: any[] = [];
        if (frameBase64) {
          parts.push({ inlineData: { data: frameBase64, mimeType: 'image/jpeg' } });
        }
        parts.push({ text: userMsg.text });

        const result = await ai.models.generateContent({
          model: 'gemini-3.1-flash-lite-preview',
          contents: [{ role: 'user', parts }],
          config: { systemInstruction: TUTOR_SYSTEM_INSTRUCTION },
        });
        response = result.text || 'No response received.';
      }

      setMessages(prev => [...prev, { role: 'assistant', text: response }]);
    } catch (err: any) {
      setError(err.message || 'Failed to send message');
      setMessages(prev => [...prev, { role: 'assistant', text: `Sorry, something went wrong: ${err.message}` }]);
    } finally {
      setIsSending(false);
    }
  }, [chatInput, captureFrame, messages, apiKey]);

  // ── Live API: Send video frames ─────────────────────────────────────────────
  const startSendingFrames = useCallback((session: any) => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    sendIntervalRef.current = setInterval(() => {
      if (!isConnectedRef.current || !sessionRef.current || !videoRef.current || !ctx || !streamRef.current) return;
      canvas.width = 640;
      canvas.height = 480;
      ctx.drawImage(videoRef.current, 0, 0, 640, 480);
      const base64 = canvas.toDataURL('image/jpeg', 0.6).split(',')[1];
      try {
        session.sendRealtimeInput({ media: { data: base64, mimeType: 'image/jpeg' } });
      } catch {
        // Session may be closing, ignore
      }
    }, 2000);
  }, []);

  // ── Live API: Send audio (AudioWorkletNode) ────────────────────────────────
  const startSendingAudio = useCallback(async (session: any) => {
    try {
      const audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioStreamRef.current = audioStream;
      const audioContext = new AudioContext({ sampleRate: 16000 });
      audioContextRef.current = audioContext;

      // Create AudioWorklet processor from inline code (buffers 4096 samples)
      const workletCode = `
        class PCMProcessor extends AudioWorkletProcessor {
          constructor() {
            super();
            this._buffer = new Float32Array(4096);
            this._offset = 0;
          }
          process(inputs) {
            const input = inputs[0];
            if (input && input.length > 0) {
              const channelData = input[0];
              for (let i = 0; i < channelData.length; i++) {
                this._buffer[this._offset++] = channelData[i];
                if (this._offset >= 4096) {
                  const pcm16 = new Int16Array(4096);
                  for (let j = 0; j < 4096; j++) {
                    pcm16[j] = Math.max(-32768, Math.min(32767, Math.round(this._buffer[j] * 32767)));
                  }
                  this.port.postMessage(pcm16.buffer, [pcm16.buffer]);
                  this._offset = 0;
                }
              }
            }
            return true;
          }
        }
        registerProcessor('pcm-processor', PCMProcessor);
      `;
      const blob = new Blob([workletCode], { type: 'application/javascript' });
      const workletUrl = URL.createObjectURL(blob);
      await audioContext.audioWorklet.addModule(workletUrl);
      URL.revokeObjectURL(workletUrl);

      const source = audioContext.createMediaStreamSource(audioStream);
      const workletNode = new AudioWorkletNode(audioContext, 'pcm-processor');
      workletNodeRef.current = workletNode;

      workletNode.port.onmessage = (e: MessageEvent) => {
        if (!isConnectedRef.current || !sessionRef.current) return;
        const pcm16Buffer = new Uint8Array(e.data as ArrayBuffer);
        const base64 = btoa(String.fromCharCode(...pcm16Buffer));
        try {
          session.sendRealtimeInput({ media: { data: base64, mimeType: 'audio/pcm;rate=16000' } });
        } catch { /* session may be closing, ignore */ }
      };

      source.connect(workletNode);
      workletNode.connect(audioContext.destination);
    } catch (err) {
      console.error('Microphone error:', err);
      setError('Could not access microphone.');
    }
  }, []);

  // ── Live API: Play audio response ───────────────────────────────────────────
  const playAudio = useCallback((base64Audio: string) => {
    const audioContext = new AudioContext();
    const binaryString = atob(base64Audio);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i);
    const pcm16 = new Int16Array(bytes.buffer);
    const float32 = new Float32Array(pcm16.length);
    for (let i = 0; i < pcm16.length; i++) float32[i] = pcm16[i] / 32768;
    const audioBuffer = audioContext.createBuffer(1, float32.length, 24000);
    audioBuffer.getChannelData(0).set(float32);
    const source = audioContext.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(audioContext.destination);
    source.start();
  }, []);

  // ── Live API: Start session ─────────────────────────────────────────────────
  const startSession = async () => {
    setIsConnecting(true);
    setError('');
    setStatusMessage('Connecting to Gemini Live...');
    try {
      const ai = new GoogleGenAI({ apiKey });
      if (!isCameraOn) await startCamera();

      const session = await ai.live.connect({
        model: "gemini-3.1-flash-lite-preview",
        callbacks: {
          onopen: () => {
            isConnectedRef.current = true;
            setIsConnected(true);
            setIsConnecting(false);
            setStatusMessage('Live — show me your homework!');
          },
          onmessage: (message: LiveServerMessage) => {
            if (message.serverContent?.modelTurn?.parts) {
              for (const part of message.serverContent.modelTurn.parts) {
                if (part.inlineData?.mimeType?.startsWith('audio/')) {
                  playAudio(part.inlineData.data!);
                }
              }
            }
          },
          onerror: (error: any) => {
            console.error("Live API error:", error);
            setError(`Connection error: ${error?.message || 'Unknown error'}`);
            setIsConnecting(false);
          },
          onclose: () => {
            // Block all senders immediately
            isConnectedRef.current = false;
            sessionRef.current = null;
            // Then clean up resources
            if (sendIntervalRef.current) clearInterval(sendIntervalRef.current);
            sendIntervalRef.current = null;
            workletNodeRef.current?.port.close();
            workletNodeRef.current?.disconnect();
            workletNodeRef.current = null;
            audioStreamRef.current?.getTracks().forEach(t => t.stop());
            audioStreamRef.current = null;
            audioContextRef.current?.close();
            audioContextRef.current = null;
            setIsConnected(false);
            setIsConnecting(false);
            setStatusMessage('Session ended');
          }
        },
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: "Zephyr" } },
          },
          systemInstruction: TUTOR_SYSTEM_INSTRUCTION,
        },
      });

      sessionRef.current = session;
      startSendingFrames(session);
      startSendingAudio(session);
    } catch (err: any) {
      console.error('Session start error:', err);
      setError(`Failed to connect: ${err?.message || 'Unknown error'}`);
      setIsConnecting(false);
      setStatusMessage('Connection failed');
    }
  };

  const stopSession = async () => {
    // 1. Immediately block all senders via guard flags
    isConnectedRef.current = false;
    const session = sessionRef.current;
    sessionRef.current = null;

    // 2. Stop frame interval and audio worklet
    if (sendIntervalRef.current) clearInterval(sendIntervalRef.current);
    sendIntervalRef.current = null;
    workletNodeRef.current?.port.close();
    workletNodeRef.current?.disconnect();
    workletNodeRef.current = null;
    audioStreamRef.current?.getTracks().forEach(t => t.stop());
    audioStreamRef.current = null;
    audioContextRef.current?.close();
    audioContextRef.current = null;

    // 3. Wait for any in-flight messages to be discarded
    await new Promise(r => setTimeout(r, 120));

    // 4. Now safe to close the WebSocket
    if (session) {
      try { session.close(); } catch { /* ignore */ }
    }
    setIsConnected(false);
    setStatusMessage('Session ended');
  };

  useEffect(() => {
    return () => { stopCamera(); stopSession(); };
  }, []);

  // ── Render ──────────────────────────────────────────────────────────────────
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
        <div className="flex items-center gap-2">
          <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${
            isConnected ? 'bg-green-50 text-green-700 border border-green-200'
              : isConnecting ? 'bg-yellow-50 text-yellow-700 border border-yellow-200'
              : 'bg-slate-100 text-slate-500 border border-slate-200'
          }`}>
            <span className={`w-1.5 h-1.5 rounded-full ${
              isConnected ? 'bg-green-500 animate-pulse' : isConnecting ? 'bg-yellow-500 animate-pulse' : 'bg-slate-400'
            }`} />
            {isConnected ? 'Voice On' : isConnecting ? 'Connecting...' : 'Voice Off'}
          </span>
        </div>
      </header>

      {/* Main: Video + Chat */}
      <main className="flex-1 flex flex-col md:flex-row gap-3 p-3 md:p-4 overflow-hidden max-w-7xl mx-auto w-full">
        {/* Left Panel: Video + Controls */}
        <div className="flex flex-col gap-3 md:w-[50%] shrink-0">
          {/* Video */}
          <div className="relative bg-slate-900 rounded-2xl shadow-sm border border-slate-200 overflow-hidden aspect-video">
            {/* Always render video so ref is available for startCamera */}
            <video ref={videoRef} autoPlay playsInline muted
              className={`w-full h-full object-cover ${isCameraOn ? '' : 'hidden'}`}
            />
            {!isCameraOn && (
              <div className="w-full h-full flex flex-col items-center justify-center text-slate-500 gap-2 bg-slate-100">
                <Camera size={40} strokeWidth={1.5} />
                <p className="text-xs">Camera is off</p>
              </div>
            )}
            {isConnected && (
              <div className="absolute top-3 left-3 flex items-center gap-1.5 px-2.5 py-1 bg-black/50 backdrop-blur-sm rounded-full">
                <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"/>
                <span className="text-white text-[10px] font-bold tracking-wide">LIVE</span>
              </div>
            )}
          </div>

          {/* Status */}
          <p className="text-xs text-slate-400 text-center">{statusMessage}</p>

          {/* Error */}
          {error && (
            <div className="px-3 py-2 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs text-center">
              {error}
            </div>
          )}

          {/* Controls */}
          <div className="flex items-center gap-3 justify-center">
            <button
              onClick={isCameraOn ? stopCamera : startCamera}
              className={`w-12 h-12 rounded-full flex items-center justify-center transition-all shadow-sm hover:shadow ${
                isCameraOn ? 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'
                  : 'bg-slate-200 text-slate-500 hover:bg-slate-300'
              }`}
              title={isCameraOn ? 'Turn off camera' : 'Turn on camera'}
            >
              {isCameraOn ? <Camera size={20} /> : <CameraOff size={20} />}
            </button>

            <button
              onClick={isConnected ? stopSession : startSession}
              disabled={isConnecting}
              className={`px-6 py-3 rounded-full flex items-center gap-2 font-medium text-sm transition-all shadow-sm hover:shadow disabled:opacity-50 disabled:cursor-not-allowed ${
                isConnected ? 'bg-red-500 text-white hover:bg-red-600'
                  : 'bg-blue-600 text-white hover:bg-blue-700'
              }`}
            >
              {isConnected ? (
                <><MicOff size={18} /> Stop Voice</>
              ) : isConnecting ? (
                <>
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Connecting...
                </>
              ) : (
                <><Mic size={18} /> Start Voice</>
              )}
            </button>
          </div>
        </div>

        {/* Right Panel: Text Chat — Google style */}
        <div className="flex-1 flex flex-col bg-white rounded-2xl shadow-[0_1px_3px_0_rgba(60,64,67,0.15)] overflow-hidden min-h-[250px] md:min-h-0">
          {/* Chat header */}
          <div className="shrink-0 px-5 py-3 border-b border-[#e8eaed] flex items-center gap-3">
            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[#4285f4] via-[#9b72cb] to-[#d96570] flex items-center justify-center">
              <Sparkles size={14} className="text-white" />
            </div>
            <span className="text-sm font-medium text-[#202124]">Gemini Tutor</span>
            {isCameraOn && (
              <button
                onClick={() => sendChatMessage(true)}
                disabled={isSending}
                className="ml-auto flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[#1a73e8] bg-[#e8f0fe] hover:bg-[#d2e3fc] rounded-full transition-colors disabled:opacity-50"
                title="Capture camera frame and ask about it"
              >
                <Camera size={12} />
                Capture & Ask
              </button>
            )}
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            {messages.length === 0 && (
              <div className="h-full flex flex-col items-center justify-center gap-3 py-8">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#4285f4] via-[#9b72cb] to-[#d96570] flex items-center justify-center">
                  <Sparkles size={22} className="text-white" />
                </div>
                <p className="text-base font-medium text-[#202124]">How can I help you today?</p>
                <p className="text-xs text-[#5f6368] text-center max-w-[220px]">Ask me a question, or capture a photo of your homework.</p>
              </div>
            )}
            {messages.map((msg, i) => (
              <div key={i} className={`flex gap-2.5 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                {/* Avatar */}
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
                  {msg.image && (
                    <img src={msg.image} alt="Captured" className="rounded-lg mb-2 max-h-32 w-auto" />
                  )}
                  <div className="whitespace-pre-wrap">{msg.text}</div>
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
                    <span className="w-2 h-2 bg-[#bdc1c6] rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-2 h-2 bg-[#bdc1c6] rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-2 h-2 bg-[#bdc1c6] rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Input — Google search-bar style */}
          <div className="shrink-0 px-4 py-3 border-t border-[#e8eaed]">
            <div className="flex items-center gap-2 px-4 py-1 bg-[#f8f9fa] border border-[#dfe1e5] rounded-full focus-within:border-[#4285f4] focus-within:shadow-[0_1px_6px_rgba(32,33,36,0.12)] transition-all">
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && sendChatMessage(false)}
                placeholder="Ask a question..."
                disabled={isSending}
                className="flex-1 py-2.5 bg-transparent text-sm text-[#202124] outline-none disabled:opacity-50 placeholder:text-[#9aa0a6]"
              />
              <button
                onClick={() => sendChatMessage(false)}
                disabled={isSending || !chatInput.trim()}
                className="w-9 h-9 rounded-full bg-[#1a73e8] hover:bg-[#1765cc] text-white flex items-center justify-center transition-colors disabled:bg-[#dadce0] disabled:text-[#9aa0a6] disabled:cursor-not-allowed shrink-0"
              >
                <Send size={15} />
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

// ── App Root ─────────────────────────────────────────────────────────────────
export default function App() {
  const [screen, setScreen] = useState<'welcome' | 'tutor'>('welcome');
  const [apiKey, setApiKey] = useState('');

  const handleStart = (key: string) => {
    setApiKey(key);
    setScreen('tutor');
  };

  if (screen === 'welcome') {
    return <WelcomeScreen onStart={handleStart} />;
  }

  return <TutorScreen apiKey={apiKey} onBack={() => setScreen('welcome')} />;
}
