import React, { lazy, Suspense, useState, useRef, useEffect, useCallback } from 'react';
import {
  Mic, MicOff, Sparkles, Camera, CameraOff,
  BookOpen, ArrowRight, Volume2, MessageSquare,
  StopCircle, Send, Globe, CornerDownLeft, Palette, X, ZoomIn, Paperclip, FileText,
  Moon, Sun, Eye, Edit3, Search, Activity, ShieldCheck, WifiOff, Wifi, HardDrive
} from 'lucide-react';
import { useTheme } from './contexts/ThemeContext';
import { t, type Lang } from './i18n';
import type { WhiteboardElement } from './components/chat/Whiteboard';
import { LibrasInterpreter } from './components/avatar/LibrasInterpreter';
import { TermsAndPrivacyModal } from './components/legal/TermsAndPrivacyModal';
import {
  getConsentPreferences, saveOfflineChatBackup,
  getOfflineChatBackup, detectClientGeo, bootstrapStudentSession,
  rememberServerSessionId, startTelemetryHeartbeat
} from './utils/telemetryClient';
import { apiFetch, apiJson, connectLiveSession } from './api/client';

// ─── Localized Friendly Error Handler ──────────────────────────────────────────
const formatFriendlyError = (errorMsg: string, lang: Lang): string => {
  // If the error message is a raw JSON string from Google Cloud / Gemini API
  let parsedMsg = errorMsg;
  try {
    if (errorMsg.trim().startsWith('{') || errorMsg.trim().startsWith('[')) {
      const parsed = JSON.parse(errorMsg);
      parsedMsg = parsed.error?.message || parsed.message || errorMsg;
    }
  } catch {
    // Keep as string if parsing fails
  }

  const lower = parsedMsg.toLowerCase();

  if (lower.includes('live voice is unavailable')) {
    return lang === 'pt'
      ? 'A tutoria por voz ainda não está disponível neste servidor. Pode continuar pelo chat de texto.'
      : 'Live voice is not available on this server yet. You can continue with text chat.';
  }

  // 1. High Demand / Rate limit (503 UNAVAILABLE, 429 quota, etc.)
  if (lower.includes('experiencing high demand') || lower.includes('unavailable') || lower.includes('503') || lower.includes('rate limit') || lower.includes('quota') || lower.includes('capacity')) {
    if (lang === 'pt') {
      return "Olá! O meu servidor está a receber muitas visitas de outros estudantes neste momento. 🚀 É um pico temporário! Por favor, aguarde um minutinho e tente enviar a mensagem novamente. Obrigado pela paciência!";
    } else {
      return "Hello! My server is currently experiencing a high volume of requests from other students. 🚀 This is usually temporary! Please wait a minute and try again. Thank you for your patience!";
    }
  }

  // 2. Network offline / connection issues
  if (lower.includes('failed to fetch') || lower.includes('network') || lower.includes('offline') || lower.includes('connection')) {
    if (lang === 'pt') {
      return "Parece que estamos com um problema de ligação à internet. 🌐 Por favor, verifique a sua ligação e tente novamente.";
    } else {
      return "It looks like we are experiencing a connection issue. 🌐 Please check your internet connection and try again.";
    }
  }

  // 3. Backend authorization issues
  if (lower.includes('api key') || lower.includes('invalid key') || lower.includes('unauthorized') || lower.includes('403')) {
    if (lang === 'pt') {
      return "O serviço de tutoria não está autorizado neste momento. Por favor, tente novamente mais tarde.";
    } else {
      return "The tutoring service is not authorized right now. Please try again later.";
    }
  }

  // 4. Default fallback friendly error
  if (lang === 'pt') {
    return `Desculpe, ocorreu um pequeno contratempo no processamento: ${parsedMsg}. Vamos tentar de novo?`;
  } else {
    return `Sorry, we hit a small bump in the road: ${parsedMsg}. Shall we try again?`;
  }
};

// ─── Constants ────────────────────────────────────────────────────────────────

const Whiteboard = lazy(() => import('./components/chat/Whiteboard').then(module => ({ default: module.Whiteboard })));
const SignLanguageAvatar = lazy(() => import('./components/avatar/SignLanguageAvatar').then(module => ({ default: module.SignLanguageAvatar })));

// Topics where generating a visual diagram is highly beneficial
const VISUAL_TOPIC_RE = /\b(explain|how does|what is|describe|show|draw|diagram|illustrate|visualize|cycle|process|system|structure|anatomy|cell|molecule|atom|circuit|photosynthesis|mitosis|meiosis|krebs|dna|protein|evolution|ecosystem|solar system|water cycle|carbon cycle|nitrogen cycle|food chain|neural network|algorithm|data structure|sorting|equation|geometry|triangle|function|derivative|integral|wave|gravity|quantum|thermodynamics|osmosis|diffusion|respiration|digestion|heart|brain|lung|skeleton|muscle|revolution|empire|civilization|volcano|earthquake|plate tectonic|weather|ocean|atmosphere|electromagnetic|newton|einstein|pythagoras|archimedes|map|chart|graph|plot)\b/i;

interface StudentContext {
  language: string;
  level: string;
  subjects: string[];
  learningStyle: string;
  strengths: string[];
  struggles: string[];
  topicsCovered: string[];
  triageComplete: boolean;
  messageCount: number;
  isDeafMode?: boolean;
  isVisionAssist?: boolean;
}
const EMPTY_STUDENT_CONTEXT: StudentContext = {
  language: '', level: 'unknown', subjects: [], learningStyle: 'unknown',
  strengths: [], struggles: [], topicsCovered: [],
  triageComplete: false, messageCount: 0,
  isDeafMode: false, isVisionAssist: false,
};

function detectLanguage(text: string): string {
  const lower = text.toLowerCase();
  // Portuguese-only indicators
  if (/\b(obrigad[oa]|também|então|não|está|você|ainda|trabalho|escola|universidade|faculdade|dúvida|compreend|ficheiro|preciso de)\b/.test(lower)) return 'pt';
  // Spanish-only indicators (words that don't exist in Portuguese)
  if (/\b(necesito|ayuda|gracias|entiendo|también|nosotros|vosotros|ustedes|trabajo|escuela|universidad)\b/.test(lower)) return 'es';
  // French indicators
  if (/\b(bonjour|merci|comment|pourquoi|besoin|comprend|expliquer?|question|je suis|s'il vous|c'est)\b/.test(lower)) return 'fr';
  // Shared pt/es words → default to Portuguese
  if (/\b(como|porque|por favor|explicar?|estudar?|ajuda|problema|matemática)\b/.test(lower)) return 'pt';
  if (text.trim().length > 0) return 'en';
  return '';
}

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
  attachedFile?: { name: string; mimeType: string }; // metadata for display only
}

interface FileAttachment {
  name: string;
  mimeType: string;
  data: string;    // base64 for binary files, plain text for text files
  isText: boolean;
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

function MarkdownContent({ text, isUser, isDark }: { text: string; isUser: boolean; isDark: boolean }) {
  // Strip internal tags
  const cleanText = text
    .replace(/\[GT_MEMORY_UPDATE:.*?\]/gs, '')
    .replace(/\[GT_WHITEBOARD_COMMAND:.*?\]/gs, '')
    .replace(/\[GT_CONTEXT_UPDATE:.*?\]/gs, '')
    .trim();
  const lines = cleanText.split('\n');
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
    const headingClass = isDark ? 'text-white' : 'text-[#202124]';
    if (line.startsWith('### ')) { nodes.push(<h3 key={i} className={`text-sm font-semibold mt-3 mb-1 ${headingClass}`}>{renderInline(line.slice(4))}</h3>); i++; continue; }
    if (line.startsWith('## ')) { nodes.push(<h2 key={i} className={`text-base font-bold mt-3 mb-1 ${headingClass}`}>{renderInline(line.slice(3))}</h2>); i++; continue; }
    if (line.startsWith('# ')) { nodes.push(<h1 key={i} className={`text-lg font-bold mt-4 mb-2 ${headingClass}`}>{renderInline(line.slice(2))}</h1>); i++; continue; }
    if (line.match(/^[-*•]\s/)) {
      const items: React.ReactNode[] = [];
      while (i < lines.length && lines[i].match(/^[-*•]\s/)) {
        items.push(<li key={i} className="flex gap-2"><span className={`mt-1.5 w-1.5 h-1.5 rounded-full shrink-0 ${isDark ? 'bg-gray-400' : 'bg-[#5f6368]'}`} /><span>{renderInline(lines[i].replace(/^[-*•]\s/, ''))}</span></li>);
        i++;
      }
      nodes.push(<ul key={`ul-${i}`} className="space-y-1 my-2">{items}</ul>); continue;
    }
    if (line.match(/^\d+\.\s/)) {
      const items: React.ReactNode[] = [];
      let n = 1;
      while (i < lines.length && lines[i].match(/^\d+\.\s/)) {
        items.push(<li key={i} className="flex gap-2"><span className={`shrink-0 font-medium w-5 text-right ${isDark ? 'text-gray-400' : 'text-[#5f6368]'}`}>{n}.</span><span>{renderInline(lines[i].replace(/^\d+\.\s/, ''))}</span></li>);
        i++; n++;
      }
      nodes.push(<ol key={`ol-${i}`} className="space-y-1 my-2">{items}</ol>); continue;
    }
    if (line.match(/^---+$/)) { nodes.push(<hr key={i} className={`my-3 ${isDark ? 'border-white/10' : 'border-[#e8eaed]'}`} />); i++; continue; }
    if (line.trim() === '') { if (nodes.length > 0) nodes.push(<div key={`sp-${i}`} className="h-1.5" />); i++; continue; }
    nodes.push(<p key={i} className={`leading-relaxed ${isUser ? '' : isDark ? 'text-gray-200' : 'text-[#3c4043]'}`}>{renderInline(line)}</p>);
    i++;
  }
  return <div className="space-y-px">{nodes}</div>;
}

// ─── Generated Image component ────────────────────────────────────────────────
// Shows the AI-generated illustration with a lightbox on click.

function GeneratedImageCard({
  imageBase64, mimeType, caption,
  onRegenerate, isRegenerating, isDark
}: {
  imageBase64: string; mimeType: string; caption?: string;
  onRegenerate?: () => void; isRegenerating?: boolean; isDark: boolean;
}) {
  const [lightbox, setLightbox] = useState(false);
  const closeLightboxRef = useRef<HTMLButtonElement>(null);
  const src = `data:${mimeType};base64,${imageBase64}`;
  useEffect(() => {
    if (!lightbox) return;
    closeLightboxRef.current?.focus();
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setLightbox(false);
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [lightbox]);

  return (
    <>
      <div className={`mt-3 rounded-xl overflow-hidden border transition-colors ${isDark ? 'border-white/10 bg-white/5' : 'border-[#e8eaed] bg-[#f8f9fa]'}`}>
        <button type="button" aria-label="Open illustration preview" className="relative group cursor-zoom-in block w-full" onClick={() => setLightbox(true)}>
          <img src={src} alt="AI-generated illustration" className="w-full object-contain max-h-72" />
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center">
            <ZoomIn size={20} className="text-white opacity-0 group-hover:opacity-100 transition-opacity drop-shadow" />
          </div>
        </button>
        <div className="px-3 py-2 flex items-start justify-between gap-2">
          <div>
            <div className="flex items-center gap-1.5 mb-0.5">
              <Palette size={11} className="text-[#9b72cb]" />
              <span className="text-[10px] font-bold text-[#9b72cb] uppercase tracking-tight">AI Illustration</span>
            </div>
            {caption && <p className={`text-[11px] leading-relaxed ${isDark ? 'text-gray-400' : 'text-[#5f6368]'}`}>{caption}</p>}
          </div>
        </div>
      </div>

      {/* Lightbox */}
      {lightbox && (
        <div role="dialog" aria-modal="true" aria-label="Illustration preview" className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
          onClick={() => setLightbox(false)}>
          <button ref={closeLightboxRef} aria-label="Close illustration preview" className="absolute top-4 right-4 text-white/80 hover:text-white" onClick={() => setLightbox(false)}>
            <X size={24} />
          </button>
          <img src={src} alt="AI-generated illustration" className="max-w-full max-h-full rounded-xl shadow-2xl object-contain" onClick={e => e.stopPropagation()} />
        </div>
      )}
    </>
  );
}
// ─── Image generating skeleton ────────────────────────────────────────────────

function ImageGeneratingSkeleton({ isDark }: { isDark: boolean }) {
  return (
    <div className={`mt-3 rounded-xl border overflow-hidden ${isDark ? 'border-white/10 bg-white/5' : 'border-[#e8eaed] bg-[#f8f9fa]'}`}>
      <div className={`h-40 animate-pulse ${isDark ? 'bg-gradient-to-r from-gray-800 via-gray-700 to-gray-800' : 'bg-gradient-to-r from-[#f1f3f4] via-[#e8eaed] to-[#f1f3f4]'}`} />
      <div className="px-3 py-2 flex items-center gap-2">
        <Palette size={11} className="text-[#9b72cb]" />
        <span className={`text-[10px] ${isDark ? 'text-gray-500' : 'text-[#9aa0a6]'}`}>Generating illustration …</span>
      </div>
    </div>
  );
}


// ─── Mobile camera PiP preview (uses MediaStream directly, separate from desktop ref) ──

function MobileCamPreview({ stream }: { stream: MediaStream | null }) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    if (ref.current && stream) {
      ref.current.srcObject = stream;
    }
  }, [stream]);
  return <video ref={ref} autoPlay playsInline muted className="w-full h-full object-cover" />;
}

// ─── Shared chat message list (used by both desktop and mobile) ───────────────

function ChatMessages({
  messages, liveTranscript, isSending, chatEndRef, onSuggestion, onVisualize,
  extraTopPad = false, isDark, lang
}: {
  messages: ChatMessage[];
  liveTranscript: string;
  isSending: boolean;
  chatEndRef: React.RefObject<HTMLDivElement | null>;
  onSuggestion: (s: string) => void;
  onVisualize: (q: string, i: number) => void;
  extraTopPad?: boolean;
  isDark: boolean;
  lang: Lang;
}) {
  return (
    <div className={`px-3 sm:px-4 py-6 space-y-6 ${extraTopPad ? 'pt-[140px]' : ''}`}>
      {messages.length === 0 && !liveTranscript && (
        <div className="flex flex-col items-center justify-center gap-6 pt-16 pb-8 px-4">
          <div className={`w-20 h-20 rounded-3xl backdrop-blur-xl border flex items-center justify-center mb-2 shadow-2xl ${isDark ? 'bg-white/5 border-white/20 shadow-blue-500/5' : 'bg-white/40 border-white/40 shadow-blue-500/10'}`}>
            <img src="./logoGT.png" alt="Logo" className="w-12 h-12" />
          </div>
          <div className="text-center space-y-2">
            <h2 className={`text-2xl font-bold tracking-tight ${isDark ? 'text-white' : 'text-[#1a1c1e]'}`}>{t(lang, 'chatHowCanHelp')}</h2>
            <p className={`text-sm max-w-[260px] mx-auto ${isDark ? 'text-gray-400' : 'text-[#5f6368]'}`}>{t(lang, 'chatAskAnything')}</p>
          </div>
          <div className="flex flex-col gap-3 w-full max-w-[320px] mt-4">
            {[
              { text: t(lang, 'chatSuggestion1'), icon: <Palette size={14} /> },
              { text: t(lang, 'chatSuggestion2'), icon: <Palette size={14} /> },
              { text: t(lang, 'chatSuggestion3'), icon: <Palette size={14} /> },
            ].map(s => (
              <button key={s.text} onClick={() => onSuggestion(s.text)}
                className={`text-left px-5 py-4 rounded-2xl border backdrop-blur-md 
                           text-sm hover:scale-[1.02] active:scale-[0.98]
                           transition-all flex items-center gap-3 shadow-sm ${isDark
                    ? 'border-white/10 bg-white/5 text-gray-200 hover:bg-white/10'
                    : 'border-white/60 bg-white/30 text-[#3c4043] hover:bg-white/60 shadow-black/5'}`}>
                <span className="p-1.5 rounded-lg bg-purple-500/10 text-[#9b72cb]">{s.icon}</span>
                {s.text}
              </button>
            ))}
          </div>
        </div>
      )}

      {messages.map((msg, i) => (
        <div key={i} className={`flex gap-3 sm:gap-4 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
          {msg.role === 'assistant' && (
            <div className={`w-9 h-9 rounded-xl shadow-md flex items-center justify-center shrink-0 border mt-1 ${isDark ? 'bg-white/10 border-white/10' : 'bg-white border-gray-100'}`}>
              <img src="./logoGT.png" alt="Logo" className="w-6 h-6" />
            </div>
          )}
          <div className={`max-w-[88%] sm:max-w-[80%] flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
            <div className={`px-4 sm:px-5 py-3 sm:py-4 text-sm leading-relaxed shadow-sm transition-all duration-300 ${msg.role === 'user'
              ? 'bg-[#1a73e8] text-white rounded-2xl rounded-tr-none shadow-blue-500/20'
              : `backdrop-blur-lg rounded-2xl rounded-tl-none border ${isDark ? 'bg-white/10 border-white/10 text-white' : 'bg-white/70 border-white/60 text-[#1f1f1f]'}`
              }`}>
              {msg.image && <div className="rounded-xl overflow-hidden mb-3 border border-white/20 shadow-lg"><img src={msg.image} alt="Captured" className="max-h-48 w-auto object-contain" /></div>}
              {msg.attachedFile && (
                <div className={`flex items-center gap-2 px-3 py-2 rounded-xl mb-3 text-xs font-medium w-fit max-w-full ${msg.role === 'user' ? 'bg-white/15' : isDark ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30' : 'bg-blue-50 text-blue-600 border border-blue-100'}`}>
                  <FileText size={14} className="shrink-0" />
                  <span className="truncate max-w-[200px]">{msg.attachedFile.name}</span>
                </div>
              )}
              <div className={`prose prose-sm max-w-none ${isDark ? 'prose-invert' : ''}`}>
                <MarkdownContent text={msg.text} isUser={msg.role === 'user'} isDark={isDark} />
              </div>
              {msg.role === 'assistant' && msg.isGeneratingImage && <ImageGeneratingSkeleton isDark={isDark} />}
              {msg.role === 'assistant' && msg.generatedImage && !msg.isGeneratingImage && (
                <GeneratedImageCard
                  imageBase64={msg.generatedImage}
                  mimeType={msg.generatedImageMime || 'image/png'}
                  caption={msg.imageCaption}
                  isDark={isDark}
                />
              )}
            </div>
            <div className={`flex items-center gap-2 mt-2 px-1 flex-wrap ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
              {msg.source === 'voice' && (
                <span className={`text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 px-2 py-0.5 rounded ${isDark ? 'text-gray-400 bg-white/5' : 'text-[#9aa0a6] bg-gray-100/50'}`}><Mic size={10} /> {t(lang, 'chatVoiceMode')}</span>
              )}
              {msg.grounded && (
                <span className={`text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 px-2 py-0.5 rounded ${isDark ? 'text-green-400 bg-green-500/10' : 'text-[#1e8e3e] bg-green-50'}`}>
                  <Globe size={10} /> {t(lang, 'chatSearchMode')}
                </span>
              )}
              {msg.role === 'assistant' && !msg.generatedImage && !msg.isGeneratingImage && onVisualize && (
                <button
                  onClick={() => {
                    const q = messages.slice(0, i).reverse().find(m => m.role === 'user')?.text || msg.text;
                    onVisualize(q, i);
                  }}
                  className={`text-[10px] font-bold uppercase tracking-wider text-[#9b72cb] flex items-center gap-1
                             hover:scale-95 px-2 py-0.5 rounded-lg transition-all border ${isDark ? 'bg-purple-500/10 border-purple-500/20' : 'bg-purple-50/50 border-purple-100/50 hover:bg-purple-50'}`}>
                  <Palette size={10} /> {t(lang, 'chatVisualize')}
                </button>
              )}
            </div>
          </div>
        </div>
      ))}

      {liveTranscript && (
        <div className="flex gap-3 sm:gap-4 flex-row">
          <div className={`w-9 h-9 rounded-xl shadow-md flex items-center justify-center shrink-0 border mt-1 ${isDark ? 'bg-white/10 border-white/10' : 'bg-white border-gray-100'}`}>
            <img src="./logoGT.png" alt="Logo" className="w-6 h-6" />
          </div>
          <div className={`max-w-[88%] sm:max-w-[80%] px-4 sm:px-5 py-2.5 backdrop-blur-lg rounded-2xl rounded-tl-sm border text-sm italic ${isDark ? 'bg-white/10 border-white/10 text-gray-300' : 'bg-white/70 border-white/60 text-[#5f6368]'}`}>
            {liveTranscript}
            <span className="inline-block w-1 h-3.5 bg-blue-500 ml-1 animate-pulse rounded-sm" />
          </div>
        </div>
      )}

      {isSending && !liveTranscript && (
        <div className="flex gap-3 sm:gap-4">
          <div className={`w-9 h-9 rounded-xl shadow-md flex items-center justify-center shrink-0 border mt-1 ${isDark ? 'bg-white/10 border-white/10' : 'bg-white border-gray-100'}`}>
            <img src="./logoGT.png" alt="Logo" className="w-6 h-6" />
          </div>
          <div className={`backdrop-blur-lg border rounded-2xl rounded-tl-sm px-5 py-4 ${isDark ? 'bg-white/10 border-white/10' : 'bg-white/70 border-white/60'}`}>
            <div className="flex gap-1.5 items-center">
              {[0, 160, 320].map(d => (
                <span key={d} className={`w-2 h-2 rounded-full animate-bounce ${isDark ? 'bg-blue-400' : 'bg-blue-500'}`}
                  style={{ animationDelay: `${d}ms` }} />
              ))}
            </div>
          </div>
        </div>
      )}
      <div ref={chatEndRef} />
    </div>
  );
}

// ─── Desktop chat content (header + messages + input) ─────────────────────────

function DesktopChatContent({
  messages, liveTranscript, isSending, isCameraOn, chatInput, textareaRef, chatEndRef,
  onInputChange, onSend, onCapture, onSuggestion, onVisualize, generateVisual,
  uploadedFile, fileInputRef, onFileSelect, onFileClear, isDark, lang
}: {
  messages: ChatMessage[]; liveTranscript: string; isSending: boolean;
  isCameraOn: boolean; chatInput: string;
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
  chatEndRef: React.RefObject<HTMLDivElement | null>;
  onInputChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  onSend: () => void; onCapture: () => void; onSuggestion: (s: string) => void;
  onVisualize: (q: string, i: number) => void;
  generateVisual: (q: string, i: number) => void;
  uploadedFile: FileAttachment | null;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  onFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onFileClear: () => void;
  isDark: boolean;
  lang: Lang;
}) {
  const getFileIcon = (mimeType: string) => {
    if (mimeType.startsWith('image/')) return 'image';
    if (mimeType.startsWith('video/')) return 'video';
    if (mimeType === 'application/pdf') return 'pdf';
    return '📝';
  };

  return (
    <>
      <div className={`shrink-0 px-6 h-14 border-b flex items-center justify-between transition-all duration-500 ${isDark ? 'bg-black/20 border-white/10' : 'bg-white/20 border-white/40 backdrop-blur-sm'}`}>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]" />
          <span className={`text-[10px] font-black uppercase tracking-[0.2em] opacity-80 ${isDark ? 'text-gray-400' : 'text-[#1a1c1e]'}`}>Conversation Context</span>
        </div>
        <div className="flex items-center gap-2">
          {isCameraOn && (
            <div className={`flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-bold rounded-full border uppercase tracking-tight ${isDark ? 'text-blue-400 bg-blue-500/10 border-blue-500/20' : 'text-blue-600 bg-blue-100/50 border-blue-200/50'}`}>
              <Camera size={10} /> {t(lang, 'chatLensActive')}
            </div>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto relative custom-scrollbar">
        <ChatMessages
          messages={messages} liveTranscript={liveTranscript} isSending={isSending}
          chatEndRef={chatEndRef} onSuggestion={onSuggestion} onVisualize={onVisualize}
          isDark={isDark} lang={lang}
        />
      </div>

      <div className={`shrink-0 px-6 pb-6 pt-3 border-t transition-all duration-500 ${isDark ? 'bg-black/20 border-white/10' : 'bg-white/30 backdrop-blur-md border-white/40'}`}>
        {/* File preview badge */}
        {uploadedFile && (
          <div className="flex items-center gap-2 mb-3 px-1 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-2xl text-xs shadow-lg shadow-blue-500/20">
              <span className="text-base">{getFileIcon(uploadedFile.mimeType)}</span>
              <span className="truncate max-w-[220px] font-semibold">{uploadedFile.name}</span>
              <button onClick={onFileClear} className="ml-2 p-1 hover:bg-white/20 rounded-lg transition-colors">
                <X size={12} />
              </button>
            </div>
          </div>
        )}

        <div className={`relative rounded-[28px] border shadow-xl transition-all duration-300 group ${isDark ? 'bg-white/5 border-white/10 shadow-black/20 focus-within:bg-white/10' : 'bg-white/80 border-white shadow-black/5 focus-within:bg-white focus-within:shadow-2xl focus-within:shadow-blue-500/10'}`}>
          <textarea ref={textareaRef} value={chatInput}
            aria-label={lang === 'pt' ? 'Mensagem para o tutor' : 'Message to the tutor'}
            onChange={onInputChange}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); onSend(); } }}
            placeholder={uploadedFile ? t(lang, 'chatFilePlaceholder').replace('{fileName}', uploadedFile.name) : t(lang, 'chatInputPlaceholder')}
            rows={1} disabled={isSending}
            className={`w-full px-6 pt-5 pb-14 text-sm bg-transparent resize-none
                       outline-none placeholder:text-gray-400 leading-relaxed max-h-[180px]
                       disabled:opacity-60 font-medium ${isDark ? 'text-white' : 'text-[#1a1c1e]'}`}
          />
          <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between">
            <div className="flex items-center gap-1">
              <button onClick={() => fileInputRef.current?.click()} disabled={isSending}
                aria-label={lang === 'pt' ? 'Anexar ficheiro' : 'Attach file'}
                className={`w-10 h-10 rounded-2xl flex items-center justify-center transition-all active:scale-90
                           ${uploadedFile ? 'text-blue-600 bg-blue-50 border border-blue-100' : 'text-gray-500 hover:bg-gray-100'}`}>
                <Paperclip size={18} />
              </button>
              {isCameraOn && (
                <button onClick={onCapture} disabled={isSending}
                  className="w-10 h-10 rounded-2xl hover:bg-gray-100 flex items-center justify-center
                             transition-all text-gray-500 active:scale-90" title="Capture Frame">
                  <Camera size={18} />
                </button>
              )}
            </div>

            <div className="flex items-center gap-2">
              <span className={`text-[10px] font-bold uppercase tracking-widest opacity-0 group-focus-within:opacity-100 transition-opacity mr-2 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                {t(lang, 'chatPressEnter')}
              </span>
              <button onClick={onSend} disabled={isSending || (!chatInput.trim() && !uploadedFile)}
                aria-label={lang === 'pt' ? 'Enviar mensagem' : 'Send message'}
                className="w-11 h-11 rounded-2xl flex items-center justify-center transition-all
                           bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-500/30
                           disabled:bg-gray-200 disabled:text-gray-400 disabled:shadow-none disabled:cursor-not-allowed active:scale-95">
                <Send size={18} />
              </button>
            </div>
          </div>
        </div>
        <div className="mt-4 flex items-center justify-center gap-4 opacity-40">
          <div className={`h-[1px] flex-1 ${isDark ? 'bg-white/10' : 'bg-gray-300'}`} />
          <span className={`text-[9px] font-black uppercase tracking-[0.2em] ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>{t(lang, 'chatEnterprise')}</span>
          <div className={`h-[1px] flex-1 ${isDark ? 'bg-white/10' : 'bg-gray-300'}`} />
        </div>
      </div>
    </>
  );
}

// ─── Mobile chat messages wrapper ─────────────────────────────────────────────

function MobileChatMessages({
  messages, liveTranscript, isSending, chatEndRef, onSuggestion, onVisualize, isCameraOn,
  isDark, lang
}: {
  messages: ChatMessage[]; liveTranscript: string; isSending: boolean;
  chatEndRef: React.RefObject<HTMLDivElement | null>;
  onSuggestion: (s: string) => void;
  onVisualize: (q: string, i: number) => void;
  isCameraOn: boolean;
  isDark: boolean;
  lang: Lang;
}) {
  // When camera PiP is visible, add top padding so messages don't hide under it
  return (
    <ChatMessages
      messages={messages} liveTranscript={liveTranscript} isSending={isSending}
      chatEndRef={chatEndRef} onSuggestion={onSuggestion} onVisualize={onVisualize}
      extraTopPad={isCameraOn} isDark={isDark} lang={lang}
    />
  );
}

// ─── Tutor Screen ─────────────────────────────────────────────────────────────

export default function TutorScreen({ onBack }: { onBack: () => void }) {
  const { theme, c, isDark, toggleTheme } = useTheme();
  const [lang, setLang] = useState<Lang>(() => (localStorage.getItem('lp_lang') as Lang) || 'en');
  const [studentMemory, setStudentMemory] = useState<string>(() => localStorage.getItem('gt_student_memory') || 'No previous history.');
  const [isDeafMode, setIsDeafMode] = useState(false);
  const [isTILSActive, setIsTILSActive] = useState(false);
  const [whiteboardElements, setWhiteboardElements] = useState<WhiteboardElement[]>([]);
  const [isChatVisible, setIsChatVisible] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isCameraOn, setIsCameraOn] = useState(false);
  const [isModelSpeaking, setIsModelSpeaking] = useState(false);
  const [statusMessage, setStatusMessage] = useState('Ready to start');
  const [error, setError] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [liveTranscript, setLiveTranscript] = useState('');
  const [uploadedFile, setUploadedFile] = useState<FileAttachment | null>(null);
  const [showGuide, setShowGuide] = useState(() => localStorage.getItem('gt_hide_guide') !== 'true');
  const [guideStep, setGuideStep] = useState(0);
  const [camExpanded, setCamExpanded] = useState(false);
  const [isVisionAssist, setIsVisionAssist] = useState(false);

  // Telemetry, Terms & Offline Resilience States
  const [showTermsModal, setShowTermsModal] = useState(() => !getConsentPreferences().acceptedTerms);
  const [isOnline, setIsOnline] = useState(() => typeof navigator !== 'undefined' ? navigator.onLine : true);

  // Restore messages from local cache if empty
  useEffect(() => {
    const cached = getOfflineChatBackup();
    if (cached && cached.length > 0 && messages.length === 0) {
      setMessages(cached);
    }
  }, []);

  // Save messages to offline cache on change
  useEffect(() => {
    if (messages.length > 0) {
      saveOfflineChatBackup(messages);
    }
  }, [messages]);

  // Monitor network status
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Dynamically compute avatar gesture based on system state and keywords
  const avatarGesture = (() => {
    if (isConnecting) return 'thinking';
    if (isSending) return 'thinking';
    if (isModelSpeaking) {
      // Check last message for warning or confirmation keywords
      const lastMsg = messages[messages.length - 1];
      if (lastMsg && lastMsg.role === 'assistant') {
        const text = lastMsg.text.toLowerCase();
        if (/\b(cuidado|atenção|aviso|perigo|segurança)\b/.test(text)) return 'warning';
        if (/\b(certo|correto|excelente|parabéns|boa|exato|sim)\b/.test(text)) return 'confirming';
        if (/\b(explica|aponta|olha|vê|observa)\b/.test(text)) return 'pointing';
      }
      return 'explaining';
    }
    if (isConnected) return 'listening';
    return 'idle';
  })();

  // Compute the latest assistant message for TILS
  const lastAssistantMessage = (() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === 'assistant') return messages[i].text;
    }
    return '';
  })();

  // Update memory persistence
  useEffect(() => {
    localStorage.setItem('gt_student_memory', studentMemory);
  }, [studentMemory]);

  useEffect(() => {
    localStorage.setItem('lp_lang', lang);
  }, [lang]);


  // Monitor assistant messages for memory and whiteboard updates
  useEffect(() => {
    const lastMsg = messages[messages.length - 1];
    if (lastMsg?.role === 'assistant') {
      // Memory updates
      if (lastMsg.text.includes('[GT_MEMORY_UPDATE:')) {
        const match = lastMsg.text.match(/\[GT_MEMORY_UPDATE:\s*(.*?)\]/s);
        if (match && match[1]) setStudentMemory(match[1].trim());
      }
      // Whiteboard updates
      if (lastMsg.text.includes('[GT_WHITEBOARD_COMMAND:')) {
        const parsedElements: any[] = [];
        const parts = lastMsg.text.split('[GT_WHITEBOARD_COMMAND:');
        for (let i = 1; i < parts.length; i++) {
          const part = parts[i];
          const firstBrace = part.indexOf('{');
          if (firstBrace === -1) continue;
          let braceCount = 0;
          let lastBrace = -1;
          let inString = false;
          let escape = false;
          for (let j = firstBrace; j < part.length; j++) {
            const char = part[j];
            if (escape) { escape = false; continue; }
            if (char === '\\') { escape = true; continue; }
            if (char === '"') { inString = !inString; continue; }
            if (!inString) {
              if (char === '{') braceCount++;
              if (char === '}') braceCount--;
              if (braceCount === 0) {
                lastBrace = j;
                break;
              }
            }
          }
          if (lastBrace !== -1) {
            try {
              const rawStr = part.substring(firstBrace, lastBrace + 1);
              let repaired = rawStr.trim();
              repaired = repaired.replace(/'([^'\n]*)'/g, '"$1"');
              repaired = repaired.replace(/([{,]\s*)([a-zA-Z0-9_]+)\s*:/g, '$1"$2":');
              repaired = repaired.replace(/,\s*([\]}])/g, '$1');
              parsedElements.push(JSON.parse(repaired));
            } catch (e) { console.error('Whiteboard parse error', e); }
          }
        }
        if (parsedElements.length > 0) {
          setWhiteboardElements(prev => {
            const newElements = [...prev];
            let changed = false;
            for (const el of parsedElements) {
              const idx = newElements.findIndex(existing => existing.id === el.id);
              if (idx > -1) {
                newElements[idx] = el;
                changed = true;
              } else {
                newElements.push(el);
                changed = true;
              }
            }
            return changed ? newElements : prev;
          });
        }
      }
    }
  }, [messages]);

  useEffect(() => {
    localStorage.setItem('lp_lang', lang);
  }, [lang]);

  // ── Student context (in-session memory) ─────────────────────────────────

  // Monitor assistant messages for memory updates
  useEffect(() => {
    const lastMsg = messages[messages.length - 1];
    if (lastMsg?.role === 'assistant' && lastMsg.text.includes('[GT_MEMORY_UPDATE:')) {
      const match = lastMsg.text.match(/\[GT_MEMORY_UPDATE:\s*(.*?)\]/s);
      if (match && match[1]) {
        const newMemory = match[1].trim();
        setStudentMemory(newMemory);
        // We might want to strip the tag from the UI message, but for now we keep it simple
      }
    }
  }, [messages]);

  // Monitor assistant messages for student context updates
  useEffect(() => {
    const lastMsg = messages[messages.length - 1];
    if (lastMsg?.role === 'assistant' && lastMsg.text.includes('[GT_CONTEXT_UPDATE:')) {
      const match = lastMsg.text.match(/\[GT_CONTEXT_UPDATE:\s*(.*?)\]/s);
      if (match && match[1]) {
        try {
          const parsed = JSON.parse(match[1].trim());
          setStudentContext(prev => ({
            ...prev,
            level: parsed.level || prev.level,
            subjects: parsed.subjects || prev.subjects,
            learningStyle: parsed.learningStyle || prev.learningStyle,
            strengths: parsed.strengths || prev.strengths,
            struggles: parsed.struggles || prev.struggles,
            triageComplete: true
          }));
        } catch (e) {
          // If not valid JSON, try regex/key-value parsing as fallback
          const content = match[1].trim();
          const levelMatch = content.match(/level["']?\s*:\s*["']?(beginner|intermediate|advanced)["']?/i);
          const subjectsMatch = content.match(/subjects["']?\s*:\s*\[([^\]]+)\]/i);

          const updates: Partial<StudentContext> = {};
          if (levelMatch && levelMatch[1]) {
            updates.level = levelMatch[1].toLowerCase();
          }
          if (subjectsMatch && subjectsMatch[1]) {
            updates.subjects = subjectsMatch[1].split(',').map(s => s.replace(/['"]/g, '').trim());
          }

          if (Object.keys(updates).length > 0) {
            setStudentContext(prev => ({
              ...prev,
              ...updates,
              triageComplete: true
            }));
          }
        }
      }
    }
  }, [messages]);

  // ── Student context (in-session memory) ─────────────────────────────────
  const [studentContext, setStudentContext] = useState<StudentContext>(() => {
    const stored = sessionStorage.getItem('tutor_student_context');
    if (stored) { try { return JSON.parse(stored); } catch { } }
    return { ...EMPTY_STUDENT_CONTEXT };
  });
  useEffect(() => {
    sessionStorage.setItem('tutor_student_context', JSON.stringify(studentContext));
  }, [studentContext]);

  const [sessionId, setSessionId] = useState('');

  useEffect(() => {
    void bootstrapStudentSession().then(id => {
      if (id) setSessionId(id);
    });
    return startTelemetryHeartbeat();
  }, []);

  useEffect(() => {
    if (!sessionId) return;
    apiJson<{ messages?: ChatMessage[] }>(`/api/sessions/${sessionId}`)
      .then(d => { if (d?.messages?.length) setMessages(d.messages.map((m: any) => ({ role: m.role, text: m.text, source: m.source }))); })
      .catch(() => { });
  }, [sessionId]);

  // ── Refs ───────────────────────────────────────────────────────────────────
  const videoRef = useRef<HTMLVideoElement>(null);
  const sessionRef = useRef<any>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const sendIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isConnectedRef = useRef(false);
  const isTearingDownRef = useRef(false);
  const workletNodeRef = useRef<AudioWorkletNode | null>(null);
  const audioStreamRef = useRef<MediaStream | null>(null);
  const playbackCtxRef = useRef<AudioContext | null>(null);
  const nextPlayTimeRef = useRef<number>(0);
  const scheduledSourcesRef = useRef<AudioBufferSourceNode[]>([]);
  const isModelSpeakingRef = useRef(false);
  const messagesRef = useRef<ChatMessage[]>([]);
  const liveModelTranscriptRef = useRef('');
  const liveUserTranscriptRef = useRef('');
  const lastTranslatedIndexRef = useRef(0);
  const guideDialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => { messagesRef.current = messages; }, [messages]);
  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, liveTranscript]);
  useEffect(() => {
    if (!showGuide) return;
    guideDialogRef.current?.focus();
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setShowGuide(false);
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [showGuide]);

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

  // ── Image generation ───────────────────────────────────────────────────────
  // Called after text responses for visual topics, and also from the
  // "Visualize" button on any assistant message.
  const generateVisual = useCallback(async (concept: string, msgIndex: number) => {
    // Mark message as generating
    setMessages(prev => prev.map((m, i) => i === msgIndex ? { ...m, isGeneratingImage: true } : m));

    try {
      let imageBase64 = '';
      let mimeType = 'image/png';
      let caption = '';

      const data = await apiJson<{ imageBase64: string; mimeType?: string; caption?: string }>(
        '/api/generate-image',
        {
          method: 'POST',
          body: JSON.stringify({ concept, context: messagesRef.current[msgIndex]?.text?.slice(0, 300) }),
        },
      );
      imageBase64 = data.imageBase64;
      mimeType = data.mimeType || mimeType;
      caption = data.caption || '';

      setMessages(prev => prev.map((m, i) =>
        i === msgIndex
          ? { ...m, isGeneratingImage: false, generatedImage: imageBase64, generatedImageMime: mimeType, imageCaption: caption.trim() }
          : m
      ));
    } catch (err: any) {
      console.error('Image generation error:', err);
      setMessages(prev => prev.map((m, i) => i === msgIndex ? { ...m, isGeneratingImage: false } : m));
    }
  }, []);

  // ── Camera ─────────────────────────────────────────────────────────────────
  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
      setIsCameraOn(true);
    } catch {
      setError(
        lang === 'pt'
          ? 'Não foi possível aceder à câmara.  Por favor, verifique as permissões de acesso no seu navegador.'
          : 'Could not access camera. Please check browser access permissions.'
      );
    }
  }, [lang]);

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

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const TEXT_TYPES = ['text/plain', 'text/markdown', 'text/csv', 'application/json', 'text/html', 'text/xml'];
    const isText = TEXT_TYPES.some(t => file.type.startsWith(t)) || /\.(txt|md|csv|json|html|xml|py|js|ts|java|c|cpp|rs)$/i.test(file.name);
    const isSupportedBinary = ['application/pdf', 'image/png', 'image/jpeg', 'image/gif', 'image/webp'].includes(file.type);
    const maxBytes = 8 * 1024 * 1024;
    if (file.size === 0 || file.size > maxBytes || (!isText && !isSupportedBinary)) {
      setUploadedFile(null);
      setError(
        file.size > maxBytes
          ? (lang === 'pt' ? 'O ficheiro deve ter no máximo 8 MB.' : 'The file must be 8 MB or smaller.')
          : (lang === 'pt' ? 'Este tipo de ficheiro não é suportado.' : 'This file type is not supported.'),
      );
      e.target.value = '';
      return;
    }
    setError('');

    const reader = new FileReader();
    reader.onload = (ev) => {
      const result = ev.target?.result;
      if (!result) return;
      if (isText) {
        setUploadedFile({ name: file.name, mimeType: file.type || 'text/plain', data: result as string, isText: true });
      } else {
        // Binary file (PDF, image) — strip the data URL prefix to get raw base64
        const base64 = (result as string).split(',')[1] || '';
        setUploadedFile({ name: file.name, mimeType: file.type, data: base64, isText: false });
      }
    };
    reader.onerror = () => setError(lang === 'pt' ? 'Não foi possível ler o ficheiro.' : 'The file could not be read.');

    if (isText) {
      reader.readAsText(file);
    } else {
      reader.readAsDataURL(file);
    }

    // Reset input so the same file can be selected again
    e.target.value = '';
  }, [lang]);

  // ── Text Chat ──────────────────────────────────────────────────────────────
  const sendChatMessage = useCallback(async (includeImage = false) => {
    const text = chatInput.trim();
    if (!text && !includeImage && !uploadedFile) return;

    const frameDataUrl = includeImage ? captureFrame() : null;
    const frameBase64 = frameDataUrl?.split(',')[1];
    const currentFile = uploadedFile;

    const defaultText = currentFile
      ? `Analisa este ficheiro: ${currentFile.name}`
      : 'Please analyze this image and help me understand it.';

    const userMsg: ChatMessage = {
      role: 'user',
      text: text || defaultText,
      image: frameDataUrl || undefined,
      source: 'text',
      attachedFile: currentFile ? { name: currentFile.name, mimeType: currentFile.mimeType } : undefined,
    };

    setMessages(prev => [...prev, userMsg]);
    resetTextarea();
    setUploadedFile(null);
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

      const consent = getConsentPreferences();
      const geo = consent.locationConsent ? await detectClientGeo() : { country: 'Anônimo', city: 'Não partilhado' };
      const data = await apiJson<{
        sessionId?: string;
        response: string;
        grounded?: boolean;
        generatedImage?: string;
        generatedImageMime?: string;
        imageCaption?: string;
      }>('/api/chat', {
        method: 'POST',
        body: JSON.stringify({
          message: userMsg.text,
          image: frameBase64,
          fileData: currentFile || undefined,
          studentContext: {
            language: studentContext.language || undefined,
            level: studentContext.level === 'unknown' ? undefined : studentContext.level,
            subjects: studentContext.subjects,
            learningStyle: studentContext.learningStyle === 'unknown' ? undefined : studentContext.learningStyle,
            strengths: studentContext.strengths,
            struggles: studentContext.struggles,
            topicsCovered: studentContext.topicsCovered,
            isDeafMode,
            isVisionAssist,
            triageComplete: studentContext.triageComplete,
          },
          locationConsent: consent.locationConsent,
          cacheEnabled: consent.cacheEnabled,
          country: geo.country,
          city: geo.city,
        }),
      });
      rememberServerSessionId(data.sessionId);
      if (data.sessionId) setSessionId(data.sessionId);
      response = data.response;
      grounded = data.grounded ?? false;
      autoImage = data.generatedImage || null;
      autoImageMime = data.generatedImageMime || null;
      autoCaption = data.imageCaption || null;

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

      // Update student context with info from this exchange
      setStudentContext(prev => ({
        ...prev,
        language: prev.language || detectLanguage(userMsg.text),
        messageCount: prev.messageCount + 1,
        triageComplete: prev.triageComplete || prev.messageCount >= 1,
      }));

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
      const friendlyError = formatFriendlyError(err.message || 'Failed to send message', lang);
      setError(friendlyError);
      setMessages(prev => [...prev, { role: 'assistant', text: friendlyError, source: 'text' }]);
    } finally { setIsSending(false); }
  }, [chatInput, captureFrame, messages, sessionId, resetTextarea, generateVisual, uploadedFile, studentContext, isDeafMode, isVisionAssist, lang]);

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
      await apiJson('/api/save-voice', {
        method: 'POST',
        body: JSON.stringify({ messages: msgs }),
      });
    } catch { }
  }, []);

  // ── Live API: start ────────────────────────────────────────────────────────
  const startSession = async () => {
    const cameraWasOn = isCameraOn;
    isTearingDownRef.current = false;
    liveModelTranscriptRef.current = '';
    liveUserTranscriptRef.current = '';
    lastTranslatedIndexRef.current = 0;
    setIsConnecting(true);
    setError('');

    try {
      // Fail before requesting camera/microphone permissions when Live is
      // disabled or the backend is unreachable.
      await apiFetch('/api/live');
      setStatusMessage('Requesting camera & microphone...');
      if (!isCameraOn) await startCamera();
      const audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioStreamRef.current = audioStream;

      const audioCtx = new AudioContext({ sampleRate: 16000 });
      audioContextRef.current = audioCtx;

      const workletCode = `
        class PCMProcessor extends AudioWorkletProcessor {
          constructor() { super(); this._buf = new Float32Array(512); this._off = 0; }
          process(inputs) {
            const ch = inputs[0]?.[0];
            if (ch) {
              for (let i = 0; i < ch.length; i++) {
                this._buf[this._off++] = ch[i];
                if (this._off >= 512) {
                  const pcm = new Int16Array(512);
                  for (let j = 0; j < 512; j++) pcm[j] = Math.max(-32768, Math.min(32767, Math.round(this._buf[j] * 32767)));
                  this.port.postMessage(pcm.buffer, [pcm.buffer]);
                  this._buf = new Float32Array(512); this._off = 0;
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

      setStatusMessage('Connecting to live tutor...');
      const currentMessages = messagesRef.current;

      const session = await connectLiveSession({
        callbacks: {
          onopen: () => {
            isConnectedRef.current = true;
            setIsConnected(true);
            setIsConnecting(false);
            setStatusMessage(currentMessages.length > 0 ? `Resuming — ${currentMessages.length} messages in context` : 'Live — show me your homework!');
          },

          onmessage: (msg: any) => {
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
                lastTranslatedIndexRef.current = 0;
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

            // Audio chunks (stream directly with zero delay)
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
              const userText = liveUserTranscriptRef.current.trim();
              const modelText = liveModelTranscriptRef.current.trim();

              const newMessages: ChatMessage[] = [];
              if (userText) newMessages.push({ role: 'user', text: userText, source: 'voice' });
              if (modelText) newMessages.push({ role: 'assistant', text: modelText, source: 'voice' });

              if (newMessages.length) {
                setMessages(prev => {
                  const updated = [...prev, ...newMessages];
                  // Auto-generate visual illustration for the voice turn if topic warrants it
                  const shouldViz = VISUAL_TOPIC_RE.test(userText) || VISUAL_TOPIC_RE.test(modelText);
                  if (shouldViz) {
                    const assistantIdx = updated.length - 1;
                    setTimeout(() => generateVisual(userText || modelText, assistantIdx), 300);
                  }
                  return updated;
                });
                saveVoiceTurn(userText, modelText);

                // Update student context from voice exchange
                setStudentContext(prev => ({
                  ...prev,
                  language: prev.language || detectLanguage(userText),
                  messageCount: prev.messageCount + 1,
                  triageComplete: prev.triageComplete || prev.messageCount >= 1,
                }));
              }

              lastTranslatedIndexRef.current = 0;
              liveUserTranscriptRef.current = '';
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
            const friendly = formatFriendlyError(err?.message || 'Unknown error', lang);
            setError(friendly);
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
        context: studentContext,
        memory: studentMemory,
        history: currentMessages.slice(-12).map(message => ({
          role: message.role,
          text: message.text.slice(0, 2_000),
        })),
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
      isTearingDownRef.current = true;
      isConnectedRef.current = false;
      sessionRef.current = null;
      workletNodeRef.current?.port.close();
      workletNodeRef.current?.disconnect();
      workletNodeRef.current = null;
      audioStreamRef.current?.getTracks().forEach(track => track.stop());
      audioStreamRef.current = null;
      await audioContextRef.current?.close().catch(() => undefined);
      audioContextRef.current = null;
      if (!cameraWasOn) stopCamera();
      const friendly = formatFriendlyError(err?.message || 'Unknown error', lang);
      setError(friendly);
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

  // ─── Render ──────────────────────────────────────────────────────────────────
  //
  // Mobile  (<768px): full-screen chat, camera as floating PiP overlay,
  //                   Gemini-style bottom input + FAB voice bar.
  // Desktop (≥768px): side-by-side video + chat panel.

  return (
    <div className={`h-dvh flex flex-col overflow-hidden relative select-none md:select-auto transition-colors duration-500`}
      style={{
        paddingTop: 'env(safe-area-inset-top, 0px)',
        backgroundColor: isDark ? '#0a0b10' : '#fdfdff'
      }}>

      {/* Dynamic Mesh Background */}
      <div className="absolute inset-0 pointer-events-none opacity-40 overflow-hidden z-0">
        <div className={`absolute -top-[20%] -left-[10%] w-[60%] h-[60%] rounded-full blur-[120px] animate-pulse ${isDark ? 'bg-blue-900/20' : 'bg-blue-200/50'}`} />
        <div className={`absolute top-[40%] -right-[10%] w-[50%] h-[50%] rounded-full blur-[120px] ${isDark ? 'bg-purple-900/20' : 'bg-purple-200/50'}`} style={{ animationDelay: '2s' }} />
        <div className={`absolute -bottom-[10%] left-[20%] w-[40%] h-[40%] rounded-full blur-[100px] ${isDark ? 'bg-indigo-900/20' : 'bg-indigo-200/40'}`} />
      </div>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.txt,.md,.csv,.json,.png,.jpg,.jpeg,.gif,.webp,.py,.js,.ts,.java,.c,.cpp"
        className="hidden"
        onChange={handleFileSelect}
      />

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <header className={`shrink-0 flex items-center justify-between px-4 md:px-8 h-16 backdrop-blur-xl border-b z-10 shadow-sm shadow-black/5 transition-all duration-500 ${isDark ? 'bg-black/40 border-white/10' : 'bg-white/60 border-white/40'}`}
        style={{
          paddingLeft: 'max(1rem, env(safe-area-inset-left))',
          paddingRight: 'max(1rem, env(safe-area-inset-right))'
        }}>
        <button onClick={onBack}
          className={`flex items-center gap-3 hover:opacity-80 transition-all active:scale-95 group ${isDark ? 'text-white' : 'text-[#202124]'}`}>
          <div className={`w-10 h-10 rounded-2xl shadow-sm border flex items-center justify-center group-hover:shadow-md transition-shadow ${isDark ? 'bg-white/10 border-white/20' : 'bg-white border-gray-100'}`}>
            <img src="./logoGT.png" alt="Logo" className="w-7 h-7" />
          </div>
          <div className="flex flex-col items-start leading-tight">
            <span className="text-base font-bold tracking-tight">{t(lang, 'chatTutor')}</span>
            <span className={`text-[10px] font-medium uppercase tracking-wider opacity-60 ${isDark ? 'text-gray-300' : 'text-[#5f6368]'}`}>{t(lang, 'chatStudyEngine')}</span>
          </div>
        </button>

        <div className="flex items-center gap-3">
          {/* Theme Toggle */}
          <button aria-label={isDark ? 'Use light theme' : 'Use dark theme'} onClick={toggleTheme} className={`p-2 rounded-xl border transition-all active:scale-90 ${isDark ? 'bg-white/5 border-white/10 text-amber-400' : 'bg-white border-gray-200 text-gray-500'}`}>
            {isDark ? <Sun size={18} /> : <Moon size={18} />}
          </button>

          {/* Language Toggle */}
          <button onClick={() => setLang(prev => prev === 'en' ? 'pt' : 'en')} className={`px-3 py-2 rounded-xl border transition-all active:scale-90 flex items-center gap-2 text-[11px] font-bold ${isDark ? 'bg-white/5 border-white/10 text-white' : 'bg-white border-gray-200 text-gray-700'}`}>
            <span className="text-base">{lang === 'en' ? '🇺🇸' : '🇦🇴'}</span>
            {lang.toUpperCase()}
          </button>

          {/* Vision Assist Toggle */}
          <button onClick={() => setIsVisionAssist(!isVisionAssist)} className={`px-3 py-2 rounded-xl border transition-all active:scale-90 flex items-center gap-2 text-[11px] font-bold ${isVisionAssist ? 'bg-amber-600 text-white border-amber-500 shadow-lg shadow-amber-500/20' : isDark ? 'bg-white/5 border-white/10 text-white' : 'bg-white border-gray-200 text-gray-700'}`}>
            <Eye size={14} />
            {isVisionAssist ? 'VISION ON' : 'VISION OFF'}
          </button>

          {/* Messages Toggle */}
          <button onClick={() => setIsChatVisible(!isChatVisible)} className={`px-3 py-2 rounded-xl border transition-all active:scale-90 flex items-center gap-2 text-[11px] font-bold ${isChatVisible ? 'bg-blue-600 text-white border-blue-500 shadow-lg shadow-blue-500/20' : isDark ? 'bg-white/5 border-white/10 text-white' : 'bg-white border-gray-200 text-gray-700'}`}>
            <MessageSquare size={14} />
            {isChatVisible ? `${t(lang, 'chatMessages').toUpperCase()} ON` : `${t(lang, 'chatMessages').toUpperCase()} OFF`}
          </button>

          {/* Guide Toggle */}
          <button onClick={() => { setGuideStep(0); setShowGuide(true); }} className={`px-3 py-2 rounded-xl border transition-all active:scale-90 flex items-center gap-2 text-[11px] font-bold ${isDark ? 'bg-white/5 border-white/10 text-white hover:bg-white/10' : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'}`}>
            <BookOpen size={14} className="text-blue-500" />
            {t(lang, 'guideOpenBtn').toUpperCase()}
          </button>

          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-[11px] font-bold tracking-wide border transition-all duration-500 ${isConnected ? 'bg-green-500/10 text-green-500 border-green-500/30'
            : isConnecting ? 'bg-amber-500/10 text-amber-500 border-amber-500/30'
              : isDark ? 'bg-white/5 text-gray-400 border-white/10' : 'bg-gray-100 text-gray-500 border-gray-200'
            }`}>
            <span className={`w-2 h-2 rounded-full shrink-0 ${isConnected ? 'bg-green-500 animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.6)]'
              : isConnecting ? 'bg-amber-500 animate-pulse'
                : 'bg-gray-400'
              }`} />
            <span className="hidden sm:inline">{isConnected ? t(lang, 'chatLiveSession') : isConnecting ? t(lang, 'chatConnecting') : t(lang, 'chatDisconnected')}</span>
          </div>
        </div>
      </header>

      {/* Offline Resilience & Network Stability Banner */}
      {!isOnline && (
        <div className="mx-4 md:mx-8 mt-3 p-3 rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-700 dark:text-amber-300 flex items-center justify-between text-xs font-semibold z-20 backdrop-blur-md">
          <div className="flex items-center gap-2">
            <WifiOff size={16} className="shrink-0 animate-pulse text-amber-500" />
            <span>Instabilidade de Conexão Detectada • Modo Cache Local Ativo: seu histórico e anotações estão seguros.</span>
          </div>
          <div className="flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-lg bg-amber-500/20 font-bold">
            <HardDrive size={13} />
            <span>Cache Offline Ativo</span>
          </div>
        </div>
      )}

      {/* ── DESKTOP: side-by-side ────────────────────────────────────────────── */}
      <main className="hidden md:flex flex-1 flex-col md:flex-row gap-4 md:gap-6 px-4 md:px-8 pb-4 md:pb-8 pt-4 overflow-hidden relative z-10"
        style={{
          paddingLeft: 'max(1rem, env(safe-area-inset-left))',
          paddingRight: 'max(1rem, env(safe-area-inset-right))'
        }}>

        {/* Left Sidebar — Camera, Avatar & Session Controls */}
        <div className="hidden md:flex flex-col gap-4 shrink-0 h-full overflow-y-auto custom-scrollbar w-[320px] lg:w-[400px]">
          {/* Camera Feed */}
          <div className={`relative rounded-3xl overflow-hidden border shadow-sm transition-all duration-500 h-[240px] lg:h-[300px] ${isDark ? 'bg-black/40 border-white/10' : 'bg-white/40 border-white border-white/60 shadow-black/5'}`}>
            <video ref={videoRef} autoPlay playsInline muted
              className={`w-full h-full object-cover ${isCameraOn ? '' : 'hidden'}`} />
            {!isCameraOn && (
              <div className="w-full h-full flex flex-col items-center justify-center text-[#9aa0a6] gap-2">
                <div className="w-16 h-16 rounded-full bg-black/5 flex items-center justify-center">
                  <Camera size={32} strokeWidth={1.5} />
                </div>
                <p className="text-xs font-bold uppercase tracking-widest opacity-40">Camera is off</p>
              </div>
            )}
            {isConnected && (
              <div className="absolute top-4 left-4 flex items-center gap-2 px-3 py-1.5
                              bg-black/55 backdrop-blur-md rounded-full border border-white/10">
                <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse shadow-[0_0_8px_rgba(244,63,94,0.8)]" />
                <span className="text-white text-[10px] font-bold tracking-widest uppercase">Live Session</span>
              </div>
            )}
            {isModelSpeaking && (
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2
                              px-4 py-2 bg-black/65 backdrop-blur-md rounded-full border border-white/10">
                {[0, 140, 280].map(d => (
                  <span key={d} className="w-1.5 rounded-full bg-blue-500 animate-bounce"
                    style={{ height: '14px', animationDelay: `${d}ms` }} />
                ))}
                <span className="text-white text-[10px] font-bold uppercase tracking-wider">Tutor Speaking</span>
              </div>
            )}

            {/* Camera Toggle Button Overlay */}
            <div className="absolute bottom-4 right-4">
              <button onClick={isCameraOn ? stopCamera : startCamera}
                className={`w-10 h-10 rounded-2xl flex items-center justify-center transition-all shadow-lg active:scale-90 ${isCameraOn
                  ? 'bg-white text-slate-700 hover:scale-105'
                  : 'bg-black/40 text-white hover:bg-black/60 border border-white/20'
                  }`}>
                {isCameraOn ? <Camera size={18} /> : <CameraOff size={18} />}
              </button>
            </div>
          </div>

          {/* Avatar (if active) */}
          {isDeafMode && (
            <div className="h-[300px] lg:h-[350px] animate-in fade-in zoom-in duration-700 shadow-2xl rounded-3xl overflow-hidden border border-indigo-500/30 bg-black/40 backdrop-blur-md relative shrink-0">
              <div className="bg-indigo-600/20 backdrop-blur-md px-4 py-2 flex items-center justify-between border-b border-indigo-500/20">
                <div className="flex items-center gap-2">
                  <Eye size={14} className="text-indigo-400" />
                  <span className="text-[10px] font-black text-indigo-400 uppercase tracking-tighter">Sign Language Avatar</span>
                </div>
              </div>
              <div className="h-[calc(100%-36px)]">
                <Suspense fallback={<div className="h-full grid place-items-center text-xs text-gray-400">Loading avatar…</div>}>
                  <SignLanguageAvatar gesture={avatarGesture} />
                </Suspense>
              </div>
            </div>
          )}

          {!isDeafMode && isVisionAssist && (
            <div className="p-5 rounded-3xl bg-amber-500/10 border border-amber-500/30 animate-pulse">
              <h4 className="text-[11px] font-black text-amber-600 uppercase mb-2 flex items-center gap-2">
                <Search size={14} /> Digital Eyes Active
              </h4>
              <p className="text-[10px] text-amber-700/80 leading-relaxed font-medium">Ngola is narrating your environment and watching for safety/fatigue.</p>
            </div>
          )}

          <div className="mt-auto space-y-4">
            {error && (
              <div role="alert" aria-live="assertive" className="text-sm text-red-500">
                {error}
              </div>
            )}

            <div className="flex flex-col gap-3">
              <button onClick={isConnected ? stopSession : startSession} disabled={isConnecting}
                className={`w-full py-4 rounded-2xl flex items-center justify-center gap-3 font-bold text-sm
                            transition-all shadow-xl active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed ${isConnected ? 'bg-rose-500 hover:bg-rose-600 text-white shadow-rose-500/25' : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white shadow-blue-500/25'
                  }`}>
                {isConnected ? <><MicOff size={18} /> Interromper sessão</>
                  : isConnecting ? <><svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg> Connecting...</>
                    : <><Mic size={18} /> Iniciar Mentoria</>}
              </button>

              {isVisionAssist && isConnected && (
                <button onClick={() => {
                  setChatInput("Describe my surroundings in detail, including object positions and any safety concerns.");
                  sendChatMessage(false);
                }} className="w-full py-3.5 rounded-2xl flex items-center justify-center gap-2 font-bold text-sm bg-amber-500 hover:bg-amber-600 text-white shadow-xl shadow-amber-500/20 transition-all active:scale-95">
                  <Search size={18} /> Scan Workspace
                </button>
              )}
            </div>

            <p aria-live="polite" className="text-[10px] font-bold uppercase tracking-widest text-center opacity-40">{statusMessage}</p>
          </div>
        </div>

        {/* Central Area — The Whiteboard Stage */}
        <div className="flex-1 flex flex-col h-full overflow-hidden relative z-10">
          <div className="flex-1 flex flex-col bg-white/5 rounded-3xl border border-white/10 shadow-inner overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="bg-indigo-600/10 px-6 h-14 flex items-center justify-between border-b border-white/5">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.5)]" />
                <span className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.2em]">Interactive Learning Workspace</span>
              </div>
              <div className="flex items-center gap-4">
                <button onClick={() => setWhiteboardElements([])} className="text-[10px] uppercase font-bold text-gray-500 hover:text-red-400 transition-colors flex items-center gap-1.5">
                  <X size={12} /> Clear Workspace
                </button>
              </div>
            </div>
            <div className="flex-1 relative">
              <Suspense fallback={<div className="h-full grid place-items-center text-sm text-gray-400">Loading whiteboard…</div>}>
                <Whiteboard elements={whiteboardElements} isDark={isDark} />
              </Suspense>
            </div>
          </div>
        </div>

        {/* Right Sidebar — Chat (Toggled by Messages button) */}
        {isChatVisible && (
          <div className="hidden md:flex flex-col shrink-0 h-full overflow-hidden w-[350px] lg:w-[450px] animate-in slide-in-from-right-4 duration-500">
            <div className="flex-1 flex flex-col bg-white/40 backdrop-blur-md rounded-3xl shadow-sm border border-white/40 overflow-hidden relative" style={{ borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(232, 234, 237, 1)' }}>
              <DesktopChatContent
                messages={messages} liveTranscript={liveTranscript} isSending={isSending}
                isCameraOn={isCameraOn} chatInput={chatInput} textareaRef={textareaRef}
                chatEndRef={chatEndRef}
                onInputChange={handleInputChange}
                onSend={() => sendChatMessage(false)}
                onCapture={() => sendChatMessage(true)}
                onSuggestion={(s) => { setChatInput(s); textareaRef.current?.focus(); }}
                onVisualize={(q, i) => generateVisual(q, i)}
                generateVisual={generateVisual}
                uploadedFile={uploadedFile}
                fileInputRef={fileInputRef}
                onFileSelect={handleFileSelect}
                onFileClear={() => setUploadedFile(null)}
                isDark={isDark} lang={lang}
              />
            </div>
          </div>
        )}
      </main>

      {/* ── MOBILE: full-screen chat + PiP overlay ──────────────────────────── */}
      <div className="md:hidden flex-1 flex flex-col overflow-hidden relative">

        {/* Avatar overlay for mobile */}
        {isDeafMode && (
          <div className="absolute top-4 left-4 z-50 w-32 h-44 shadow-2xl animate-in slide-in-from-left-4 duration-500">
            <Suspense fallback={<div className="h-full grid place-items-center text-xs text-gray-400">Loading avatar…</div>}>
              <SignLanguageAvatar gesture={avatarGesture} />
            </Suspense>
          </div>
        )}

        {/* Camera PiP overlay — top-right, tappable to expand */}
        {isCameraOn && (
          <div
            className={`absolute z-20 top-3 right-3 overflow-hidden shadow-xl cursor-pointer
                        transition-all duration-300 rounded-2xl border-2 border-white/30
                        ${camExpanded
                ? 'left-0 right-0 top-0 rounded-none border-0 w-full h-[45vw] max-h-[280px]'
                : 'w-28 h-20'
              }`}
            onClick={() => setCamExpanded(e => !e)}>
            <MobileCamPreview stream={streamRef.current} />
            {/* LIVE badge */}
            {isConnected && (
              <div className="absolute top-1.5 left-1.5 flex items-center gap-1 px-1.5 py-0.5
                              bg-black/60 backdrop-blur-sm rounded-full">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
                <span className="text-white text-[8px] font-bold tracking-widest">LIVE</span>
              </div>
            )}
            {/* Speaking animation */}
            {isModelSpeaking && (
              <div className="absolute bottom-1.5 left-1/2 -translate-x-1/2 flex items-center gap-1
                              px-2 py-1 bg-black/60 backdrop-blur-sm rounded-full">
                {[0, 120, 240].map(d => (
                  <span key={d} className="w-1 rounded-full bg-blue-500 animate-bounce"
                    style={{ height: '10px', animationDelay: `${d}ms` }} />
                ))}
              </div>
            )}
            {/* Expand / collapse hint */}
            <div className="absolute bottom-1 right-1.5 text-[8px] text-white/60">
              {camExpanded ? '▲' : '▼'}
            </div>
          </div>
        )}

        {/* Error banner */}
        {error && (
          <div role="alert" aria-live="assertive" className="absolute top-3 left-3 right-3 z-30 px-3 py-2 bg-[#fce8e6] border border-[#f5c6c2]
                          rounded-xl text-[#c5221f] text-xs text-center shadow-sm">
            {error}
          </div>
        )}

        {/* Messages scroll area */}
        <div className="flex-1 overflow-y-auto"
          style={{
            paddingLeft: 'env(safe-area-inset-left, 0px)',
            paddingRight: 'env(safe-area-inset-right, 0px)'
          }}>
          <MobileChatMessages
            messages={messages} liveTranscript={liveTranscript} isSending={isSending}
            chatEndRef={chatEndRef}
            onSuggestion={(s) => { setChatInput(s); textareaRef.current?.focus(); }}
            onVisualize={(q, i) => generateVisual(q, i)}
            isCameraOn={isCameraOn}
            isDark={isDark} lang={lang}
          />
        </div>

        {/* ── Mobile input bar ─────────────────────────────────────────────── */}
        <div className={`shrink-0 border-t transition-all duration-500 ${isDark ? 'bg-black/60 border-white/10' : 'bg-white border-[#e8eaed]'}`}
          style={{
            paddingBottom: 'env(safe-area-inset-bottom, 0px)',
            paddingLeft: 'env(safe-area-inset-left, 0px)',
            paddingRight: 'env(safe-area-inset-right, 0px)'
          }}>

          {/* Status pill */}
          {isConnected && (
            <div className="hidden sm:flex justify-center pt-1.5">
              <span className={`inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full text-[10px] font-medium transition-colors ${isModelSpeaking
                ? (isDark ? 'text-blue-400 bg-blue-500/20' : 'text-[#1a73e8] bg-[#e8f0fe]')
                : (isDark ? 'text-gray-400 bg-white/5' : 'text-[#9aa0a6] bg-[#f1f3f4]')
                }`}>
                {isModelSpeaking
                  ? <><span className="w-1.5 h-1.5 rounded-full bg-[#1a73e8] animate-pulse" /> {t(lang, 'chatSpeaking')}</>
                  : <><span className="w-1.5 h-1.5 rounded-full bg-[#34a853] animate-pulse" /> {t(lang, 'chatListening')}</>
                }
              </span>
            </div>
          )}

          {/* Gemini-style input pill */}
          <div className="px-4 pt-3 pb-3">
            {/* File preview badge */}
            {uploadedFile && (
              <div className="flex items-center gap-2 mb-3 px-1 animate-in fade-in slide-in-from-bottom-2">
                <div className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-2xl text-xs shadow-lg shadow-blue-500/20 font-bold">
                  <span>{uploadedFile.mimeType.startsWith('image/') ? '🖼️' : uploadedFile.mimeType === 'application/pdf' ? '📄' : '📝'}</span>
                  <span className="truncate max-w-[180px]">{uploadedFile.name}</span>
                  <button onClick={() => setUploadedFile(null)} className="ml-1 p-1 bg-white/20 rounded-lg">
                    <X size={12} />
                  </button>
                </div>
              </div>
            )}
            <div className={`flex items-end gap-2 backdrop-blur-md rounded-[28px] px-2.5 py-2.5
                            border transition-all duration-300 ${isDark
                ? 'bg-white/5 border-white/10 shadow-black/20 focus-within:bg-white/10'
                : 'bg-white/80 border-white shadow-xl shadow-black/5 focus-within:bg-white focus-within:shadow-2xl focus-within:shadow-blue-500/10'}`}>

              {/* Camera button — left of input */}
              <button
                onClick={isCameraOn ? stopCamera : startCamera}
                disabled={isSending}
                className={`shrink-0 w-10 h-10 rounded-2xl flex items-center justify-center
                            transition-all active:scale-90 mb-0.5 ${isCameraOn
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20'
                    : isDark ? 'text-gray-400 hover:bg-white/5' : 'text-gray-500 hover:bg-gray-100'
                  }`}
                title={isCameraOn ? 'Camera on' : 'Turn on camera'}
              >
                {isCameraOn ? <Camera size={18} /> : <CameraOff size={18} />}
              </button>

              <button onClick={() => fileInputRef.current?.click()} disabled={isSending}
                aria-label={lang === 'pt' ? 'Anexar ficheiro' : 'Attach file'}
                className={`shrink-0 w-10 h-10 rounded-2xl flex items-center justify-center
                            transition-all active:scale-90 mb-0.5 ${uploadedFile
                    ? (isDark ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' : 'bg-blue-50 text-blue-600 border border-blue-100')
                    : isDark ? 'text-gray-400 hover:bg-white/5' : 'text-gray-500 hover:bg-gray-100'
                  }`}>
                <Paperclip size={18} />
              </button>

              <textarea
                ref={textareaRef} value={chatInput}
                aria-label={lang === 'pt' ? 'Mensagem para o tutor' : 'Message to the tutor'}
                onChange={handleInputChange}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendChatMessage(false); } }}
                placeholder={uploadedFile ? t(lang, 'chatFilePlaceholder').replace('{fileName}', uploadedFile.name) : t(lang, 'chatInputPlaceholder')}
                rows={1} disabled={isSending}
                className={`flex-1 bg-transparent text-[15px] resize-none outline-none
                           placeholder:text-gray-400 leading-relaxed py-2 max-h-[140px]
                           disabled:opacity-60 min-h-[40px] font-medium ${isDark ? 'text-white' : 'text-[#1a1c1e]'}`}
              />

              {/* Right side — send or mic */}
              {(chatInput.trim() || uploadedFile) && (
                <button onClick={() => sendChatMessage(false)} disabled={isSending}
                  aria-label={lang === 'pt' ? 'Enviar mensagem' : 'Send message'}
                  className="shrink-0 w-10 h-10 rounded-2xl bg-blue-600 hover:bg-blue-700
                             text-white flex items-center justify-center transition-all
                             active:scale-90 disabled:opacity-50 mb-0.5 shadow-lg shadow-blue-500/30">
                  <Send size={18} />
                </button>
              )}
            </div>

            {/* Bottom action row: interrupt | voice FAB | spacer */}
            <div className="flex items-center justify-between mt-4 px-2">
              {/* Left: interrupt when speaking */}
              <div className="w-[72px] flex justify-start">
                {isConnected && isModelSpeaking && (
                  <button onClick={interruptAgent}
                    className={`flex items-center gap-2 px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest
                               active:scale-95 transition-all animate-pulse min-h-[38px] shadow-sm ${isDark ? 'bg-amber-900/30 text-amber-400 border-amber-500/30' : 'bg-amber-100 text-amber-700 border-amber-200'}`}>
                    <StopCircle size={14} /> <span className="hidden sm:inline">{t(lang, 'chatInterrupt')}</span>
                  </button>
                )}
              </div>

              {/* Centre: big voice FAB with GLOW */}
              {isVisionAssist && isConnected && (
                <button onClick={() => {
                  setChatInput("Describe my surroundings in detail, including object positions and any safety concerns.");
                  sendChatMessage(false);
                }} className="w-16 h-16 rounded-[24px] flex items-center justify-center transition-all active:scale-90 shadow-2xl bg-amber-500 text-white mr-4">
                  <Search size={28} />
                </button>
              )}
              <button onClick={isConnected ? stopSession : startSession} disabled={isConnecting}
                className={`w-16 h-16 rounded-[24px] flex items-center justify-center
                            transition-all active:scale-90 shadow-2xl disabled:opacity-50
                            disabled:shadow-none relative overflow-hidden group ${isConnected
                    ? 'bg-red-500 text-white'
                    : 'bg-blue-600 text-white'
                  }`}
                style={{
                  boxShadow: isConnected
                    ? '0 10px 25px -5px rgba(239,67,53,0.5)'
                    : '0 10px 25px -5px rgba(26,115,232,0.5)'
                }}>
                {/* Animated Glow when speaking */}
                {isModelSpeaking && (
                  <div className="absolute inset-0 bg-gradient-to-t from-white/20 to-transparent animate-pulse" />
                )}

                {isConnected
                  ? <MicOff size={28} />
                  : isConnecting
                    ? <svg className="animate-spin h-8 w-8" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    : <Mic size={28} />
                }
              </button>

              {/* Right: spacer (symmetric) */}
              <div className="w-[72px]" />
            </div>
          </div>
        </div>
      </div>
      {/* ── TILS — Tradutor e Intérprete de Libras ── */}
      <LibrasInterpreter
        isActive={isTILSActive}
        onToggle={() => setIsTILSActive(prev => !prev)}
        lastAssistantMessage={lastAssistantMessage}
        isDark={isDark}
      />

      {/* ── INTERACTIVE ONBOARDING GUIDE MODAL ── */}
      {showGuide && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-4 animate-in fade-in duration-300">
          <div ref={guideDialogRef} role="dialog" aria-modal="true" aria-labelledby="guide-title" tabIndex={-1} className={`relative w-full max-w-xl rounded-3xl p-6 md:p-8 border shadow-2xl transition-all duration-300 overflow-hidden ${isDark ? 'bg-slate-900/90 border-white/10 text-white' : 'bg-white/95 border-gray-200 text-gray-800'}`}>

            {/* Background glow effects */}
            <div className="absolute inset-0 pointer-events-none opacity-20 z-0">
              <div className="absolute -top-[20%] -left-[20%] w-[60%] h-[60%] rounded-full blur-[80px] bg-blue-500" />
              <div className="absolute -bottom-[20%] -right-[20%] w-[60%] h-[60%] rounded-full blur-[80px] bg-purple-500" />
            </div>

            <div className="relative z-10 flex flex-col h-full">
              {/* Header */}
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h3 id="guide-title" className="text-xl font-bold flex items-center gap-2">
                    <span className="p-2 rounded-xl bg-blue-500/10 text-blue-500">
                      <BookOpen size={20} />
                    </span>
                    {t(lang, 'guideTitle')}
                  </h3>
                  <p className={`text-xs mt-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                    {t(lang, 'guideSubtitle')}
                  </p>
                </div>
                <button
                  aria-label="Close onboarding guide"
                  onClick={() => { setShowGuide(false); localStorage.setItem('gt_hide_guide', 'true'); }}
                  className={`p-1.5 rounded-xl border transition-all hover:bg-red-500/10 hover:text-red-500 ${isDark ? 'border-white/10 text-gray-400' : 'border-gray-200 text-gray-500'}`}
                >
                  <X size={16} />
                </button>
              </div>

              {/* Progress bar */}
              <div className="flex gap-1.5 mb-8">
                {[0, 1, 2, 3, 4].map((stepIdx) => (
                  <button
                    key={stepIdx}
                    onClick={() => setGuideStep(stepIdx)}
                    className={`h-1.5 flex-1 rounded-full transition-all duration-300 ${guideStep === stepIdx
                        ? 'bg-blue-600'
                        : guideStep > stepIdx
                          ? 'bg-blue-600/40'
                          : isDark ? 'bg-white/10' : 'bg-gray-200'
                      }`}
                  />
                ))}
              </div>

              {/* Content */}
              <div className="min-h-[220px] flex flex-col justify-between mb-8">
                <div className="animate-in fade-in slide-in-from-right-4 duration-300">
                  {guideStep === 0 && (
                    <div className="space-y-4">
                      <div className="w-12 h-12 rounded-2xl text-blue-500 flex items-center justify-center mb-4">
                        <MessageSquare size={24} />
                      </div>
                      <h4 className="text-lg font-bold">{t(lang, 'guideStep1Title')}</h4>
                      <p className={`text-sm leading-relaxed ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
                        {t(lang, 'guideStep1Desc')}
                      </p>
                      <div className={`p-3 rounded-2xl border text-xs flex items-center gap-3 ${isDark ? 'bg-white/5 border-white/5 text-gray-400' : 'bg-gray-50 border-gray-100 text-gray-500'}`}>
                        <span>{lang === 'pt' ? 'Podes clicar nos botões de sugestões para começar logo a testar!' : 'You can click suggestion buttons to start testing right away!'}</span>
                      </div>
                    </div>
                  )}

                  {guideStep === 1 && (
                    <div className="space-y-4">
                      <div className="w-12 h-12 rounded-2xl text-red-500 flex items-center justify-center mb-4 animate-pulse">
                        <Mic size={24} />
                      </div>
                      <h4 className="text-lg font-bold">{t(lang, 'guideStep2Title')}</h4>
                      <p className={`text-sm leading-relaxed ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
                        {t(lang, 'guideStep2Desc')}
                      </p>
                      <div className={`p-3 rounded-2xl border text-xs flex items-center gap-3 ${isDark ? 'bg-white/5 border-white/5 text-gray-400' : 'bg-gray-50 border-gray-100 text-gray-500'}`}>
                        <span>{lang === 'pt' ? 'O microfone flutuante ativa a comunicação mãos-livres por voz!' : 'The floating microphone activates hands-free voice communication!'}</span>
                      </div>
                    </div>
                  )}

                  {guideStep === 2 && (
                    <div className="space-y-4">
                      <div className="w-12 h-12 rounded-2xl text-indigo-500 flex items-center justify-center mb-4">
                        <Palette size={24} />
                      </div>
                      <h4 className="text-lg font-bold">{t(lang, 'guideStep3Title')}</h4>
                      <p className={`text-sm leading-relaxed ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
                        {t(lang, 'guideStep3Desc')}
                      </p>
                      <div className={`p-3 rounded-2xl border text-xs flex items-center gap-3 ${isDark ? 'bg-white/5 border-white/5 text-gray-400' : 'bg-gray-50 border-gray-100 text-gray-500'}`}>
                        <span>{lang === 'pt' ? 'Carrega em "Visualizar" nas respostas para gerar ilustrações.' : 'Click "Visualize" on replies to generate illustrations.'}</span>
                      </div>
                    </div>
                  )}

                  {guideStep === 3 && (
                    <div className="space-y-4">
                      <div className="flex gap-2 mb-4">
                        <div className="w-12 h-12 rounded-2xl bg-green text-green-500 flex items-center justify-center">
                          <Camera size={24} />
                        </div>
                        <div className="w-12 h-12 rounded-2xl text-blue-500 flex items-center justify-center">
                          <Paperclip size={24} />
                        </div>
                      </div>
                      <h4 className="text-lg font-bold">{t(lang, 'guideStep4Title')}</h4>
                      <p className={`text-sm leading-relaxed ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
                        {t(lang, 'guideStep4Desc')}
                      </p>
                      <div className={`p-3 rounded-2xl border text-xs flex items-center gap-3 ${isDark ? 'bg-white/5 border-white/5 text-gray-400' : 'bg-gray-50 border-gray-100 text-gray-500'}`}>
                        <span>{lang === 'pt' ? 'Tira foto ou carrega PDFs para resolver exercícios diretamente.' : 'Take a photo or upload PDFs to solve exercises directly.'}</span>
                      </div>
                    </div>
                  )}

                  {guideStep === 4 && (
                    <div className="space-y-4">
                      <div className="flex gap-2 mb-4">
                        <div className="w-12 h-12 rounded-2xl text-purple-500 flex items-center justify-center">
                          <Volume2 size={24} />
                        </div>
                        <div className="w-12 h-12 rounded-2xl text-amber-500 flex items-center justify-center">
                          <Eye size={24} />
                        </div>
                      </div>
                      <h4 className="text-lg font-bold">{t(lang, 'guideStep5Title')}</h4>
                      <p className={`text-sm leading-relaxed ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
                        {t(lang, 'guideStep5Desc')}
                      </p>
                      <div className={`p-3 rounded-2xl border text-xs flex items-center gap-3 ${isDark ? 'bg-white/5 border-white/5 text-gray-400' : 'bg-gray-50 border-gray-100 text-gray-500'}`}>
                        <span>{lang === 'pt' ? 'Ideal para acessibilidade (libras e facilidades visuais/auditivas).' : 'Ideal for accessibility (libras and visual/auditory aids).'}</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Footer actions */}
              <div className="flex justify-between items-center border-t border-white/10 pt-4 mt-auto">
                <button
                  onClick={() => setGuideStep(p => Math.max(0, p - 1))}
                  disabled={guideStep === 0}
                  className={`px-4 py-2 text-xs font-bold uppercase tracking-wider rounded-xl transition-all border ${guideStep === 0
                      ? 'opacity-30 cursor-not-allowed border-transparent'
                      : isDark ? 'border-white/10 text-white hover:bg-white/5' : 'border-gray-200 text-gray-700 hover:bg-gray-50'
                    }`}
                >
                  {t(lang, 'guidePrev')}
                </button>

                {guideStep < 4 ? (
                  <button
                    onClick={() => setGuideStep(p => p + 1)}
                    className="px-5 py-2.5 text-xs font-bold uppercase tracking-wider bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-lg shadow-blue-500/25 transition-all"
                  >
                    {t(lang, 'guideNext')}
                  </button>
                ) : (
                  <button
                    onClick={() => { setShowGuide(false); localStorage.setItem('gt_hide_guide', 'true'); }}
                    className="px-6 py-3 text-xs font-black uppercase tracking-widest bg-green-600 hover:bg-green-700 text-white rounded-xl shadow-lg shadow-green-500/25 transition-all"
                  >
                    {t(lang, 'guideClose')}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Terms, Telemetry Notice & Cache Permission Modal */}
      <TermsAndPrivacyModal
        isOpen={showTermsModal}
        onClose={() => setShowTermsModal(false)}
      />

    </div>
  );
}