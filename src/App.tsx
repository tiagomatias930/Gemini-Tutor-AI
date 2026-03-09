import { useState, useRef } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality } from '@google/genai';
import { Mic, MicOff, Sparkles } from 'lucide-react';

export default function App() {
  const [isConnected, setIsConnected] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const sessionRef = useRef<any>(null);

  const startSession = async () => {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.error("GEMINI_API_KEY is not defined");
      return;
    }
    const ai = new GoogleGenAI({ apiKey });
    
    // Request camera and microphone
    const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    if (videoRef.current) {
      videoRef.current.srcObject = stream;
    }

    const sessionPromise = ai.live.connect({
      model: "gemini-3.1-flash-native-audio-preview-09-2025",
      callbacks: {
        onopen: () => {
          setIsConnected(true);
        },
        onmessage: async (message: LiveServerMessage) => {
          console.log("Received message:", message);
        },
        onerror: (error) => {
          console.error("Live API error:", error);
        },
        onclose: () => {
          setIsConnected(false);
        }
      },
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: { prebuiltVoiceConfig: { voiceName: "Zephyr" } },
        },
        systemInstruction: "You are a helpful AI tutor. You can see the user's homework through their camera and help them understand it.",
      },
    });
    sessionRef.current = sessionPromise;
  };

  const stopSession = async () => {
    if (sessionRef.current) {
      const session = await sessionRef.current;
      session.close();
      const stream = videoRef.current?.srcObject as MediaStream;
      stream?.getTracks().forEach(track => track.stop());
      setIsConnected(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 p-4 md:p-8 flex flex-col items-center">
      <header className="w-full max-w-4xl flex items-center justify-between mb-8">
        <div className="flex items-center gap-2">
          <Sparkles className="text-blue-600" />
          <h1 className="text-2xl font-semibold text-slate-900">Gemini Live Tutor</h1>
        </div>
      </header>

      <main className="w-full max-w-4xl flex flex-col items-center gap-6">
        <div className="w-full aspect-video bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden flex items-center justify-center">
          <video 
            ref={videoRef} 
            autoPlay 
            playsInline 
            muted 
            className="w-full h-full object-cover" 
          />
        </div>

        <button
          onClick={isConnected ? stopSession : startSession}
          className={`px-8 py-4 rounded-full flex items-center gap-3 font-medium text-lg transition-all shadow-md hover:shadow-lg ${
            isConnected 
              ? 'bg-red-50 text-red-700 hover:bg-red-100' 
              : 'bg-blue-600 text-white hover:bg-blue-700'
          }`}
        >
          {isConnected ? <><MicOff size={24} /> Stop Tutoring</> : <><Mic size={24} /> Start Tutoring</>}
        </button>
      </main>
    </div>
  );
}
