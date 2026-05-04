import React, { useState, useRef, useEffect, useCallback } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality } from '@google/genai';
import {
  Mic, MicOff, Sparkles, Camera, CameraOff,
  BookOpen, ArrowRight, Volume2, MessageSquare,
  StopCircle, Send, Globe, CornerDownLeft, Palette, X, ZoomIn, Paperclip, FileText,
} from 'lucide-react';
import { LandingPage } from './LandingPage';

// ─── Constants ────────────────────────────────────────────────────────────────

const TUTOR_SYSTEM_INSTRUCTION = `You are a friendly, patient AI tutor named "Gemini Tutor".

## LANGUAGE RULES (HIGHEST PRIORITY)
- DETECT the language of the student's FIRST message and use THAT language for ALL your responses.
- If the student writes/speaks in Portuguese, respond in Portuguese pt-PT. If in English, respond in English en-GB. If in French, respond in French fr-FR. Match ANY language.
- NEVER default to Spanish unless the student explicitly writes or speaks in Spanish.
- If Portuguese and Spanish seem ambiguous, ALWAYS prefer Portuguese.
- If the student switches languages mid-conversation, switch with them immediately.
- For voice/audio sessions: if you cannot clearly detect the language, default to Portuguese, NOT Spanish.

## SESSION START — TRIAGE & ONBOARDING
When the conversation begins (first exchange), introduce yourself briefly and gather key information by asking:
1. What subject or topic they want to study today
2. Their comfort level with the topic (beginner, intermediate, or advanced)
3. What specific help they need (homework, exam prep, understanding a concept, etc.)

Keep the triage natural and conversational — NOT a formal questionnaire. Weave the questions into a warm greeting.
If the student jumps straight into a question, answer it first, then gently ask follow-up questions to understand their level and needs.

## IN-SESSION STUDENT MODEL
As the conversation progresses, build and maintain a mental model of this student:
- **Language**: Which language they communicate in
- **Level**: Beginner, intermediate, or advanced — adjust based on their responses
- **Subject/Topics**: What they are studying in this session
- **Learning style**: Do they respond better to examples, visual descriptions, step-by-step breakdowns, analogies, or formal definitions? Adapt accordingly.
- **Strengths**: What they understand well
- **Struggles**: What concepts they find difficult — revisit these with different approaches
- **Progress**: What has been covered and resolved vs. what is still unclear

Use this mental model to:
- Avoid re-explaining things the student already understands
- Revisit weak areas using different teaching methods
- Gradually increase complexity as the student demonstrates understanding
- Reference earlier parts of the conversation ("Earlier you mentioned...", "Building on what we discussed about...")

## TEACHING METHODOLOGY
- Help students understand problems step-by-step
- Never give direct answers; guide them to discover solutions through questions and hints
- Encourage and motivate them — celebrate when they get something right
- Explain concepts clearly using simple language appropriate to their level
- Ask follow-up questions to check understanding
- If a student is stuck after 2-3 attempts, provide a more direct hint while still encouraging them to think
- If you can see their homework (via an image), describe it and offer specific help
- If you receive a document or file (PDF, text, book, study material), read it carefully and become a pedagogical guide: summarize key concepts, highlight important points, ask questions to check understanding, and help the student navigate the content progressively
- Use the googleSearch tool to answer factual or current-events questions accurately

## FORMATTING
Keep responses concise but helpful. Use markdown (bold, lists, code blocks) where it aids clarity.`;

// Criterion 1: Gemini models  |  Criterion 2: Google GenAI SDK
const TEXT_MODEL = 'gemini-2.5-flash';
const IMAGE_MODEL = 'gemini-3.1-flash-image-preview';
const LIVE_MODEL = 'gemini-2.5-flash-native-audio-preview-12-2025';

// Topics where generating a visual diagram is highly beneficial
const VISUAL_TOPIC_RE = /\b(explain|how does|how do|what is|describe|show|draw|diagram|illustrate|visualize|cycle|process|system|structure|anatomy|cell|molecule|atom|circuit|photosynthesis|mitosis|meiosis|krebs|dna|protein|evolution|ecosystem|solar system|water cycle|carbon cycle|nitrogen cycle|food chain|neural network|algorithm|data structure|sorting|equation|geometry|triangle|function|derivative|integral|wave|gravity|quantum|thermodynamics|osmosis|diffusion|respiration|digestion|heart|brain|lung|skeleton|muscle|revolution|empire|civilization|volcano|earthquake|plate tectonic|weather|ocean|atmosphere|electromagnetic)\b/i;

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
}

const EMPTY_STUDENT_CONTEXT: StudentContext = {
  language: '', level: 'unknown', subjects: [], learningStyle: 'unknown',
  strengths: [], struggles: [], topicsCovered: [],
  triageComplete: false, messageCount: 0,
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
    if (line.startsWith('## ')) { nodes.push(<h2 key={i} className="text-base font-bold mt-3 mb-1 text-[#202124]">{renderInline(line.slice(3))}</h2>); i++; continue; }
    if (line.startsWith('# ')) { nodes.push(<h1 key={i} className="text-lg font-bold mt-4 mb-2 text-[#202124]">{renderInline(line.slice(2))}</h1>); i++; continue; }
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
  extraTopPad = false,
}: {
  messages: ChatMessage[];
  liveTranscript: string;
  isSending: boolean;
  chatEndRef: React.RefObject<HTMLDivElement | null>;
  onSuggestion: (s: string) => void;
  onVisualize: (q: string, i: number) => void;
  extraTopPad?: boolean;
}) {
  return (
    <div className={`px-3 sm:px-4 py-6 space-y-6 ${extraTopPad ? 'pt-[140px]' : ''}`}>
      {messages.length === 0 && !liveTranscript && (
        <div className="flex flex-col items-center justify-center gap-6 pt-16 pb-8 px-4">
          <div className="w-20 h-20 rounded-3xl bg-white/40 backdrop-blur-xl border border-white/40 flex items-center justify-center mb-2 shadow-2xl shadow-blue-500/10">
            <img src="./logoGT.png" alt="Logo" className="w-12 h-12" />
          </div>
          <div className="text-center space-y-2">
            <h2 className="text-2xl font-bold text-[#1a1c1e] tracking-tight">How can I help you study?</h2>
            <p className="text-sm text-[#5f6368] max-w-[260px] mx-auto">Ask anything — visual topics get an AI illustration automatically.</p>
          </div>
          <div className="flex flex-col gap-3 w-full max-w-[320px] mt-4">
            {[
              { text: 'Explain how photosynthesis works', icon: <Palette size={14} /> },
              { text: 'Describe the Krebs cycle', icon: <Palette size={14} /> },
              { text: 'How does DNA replication work?', icon: <Palette size={14} /> },
            ].map(s => (
              <button key={s.text} onClick={() => onSuggestion(s.text)}
                className="text-left px-5 py-4 rounded-2xl border border-white/60 bg-white/30 backdrop-blur-md 
                           text-sm text-[#3c4043] hover:bg-white/60 hover:scale-[1.02] active:scale-[0.98]
                           transition-all flex items-center gap-3 shadow-sm shadow-black/5">
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
            <div className="w-9 h-9 rounded-xl bg-white shadow-md flex items-center justify-center shrink-0 border border-gray-100 mt-1">
              <img src="./logoGT.png" alt="Logo" className="w-6 h-6" />
            </div>
          )}
          <div className={`max-w-[88%] sm:max-w-[80%] flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
            <div className={`px-4 sm:px-5 py-3 sm:py-4 text-sm leading-relaxed shadow-sm transition-all duration-300 ${msg.role === 'user'
              ? 'bg-[#1a73e8] text-white rounded-2xl rounded-tr-none shadow-blue-500/20'
              : 'bg-white/70 backdrop-blur-lg text-[#1f1f1f] rounded-2xl rounded-tl-none border border-white/60'
              }`}>
              {msg.image && <div className="rounded-xl overflow-hidden mb-3 border border-white/20 shadow-lg"><img src={msg.image} alt="Captured" className="max-h-48 w-auto object-contain" /></div>}
              {msg.attachedFile && (
                <div className={`flex items-center gap-2 px-3 py-2 rounded-xl mb-3 text-xs font-medium w-fit max-w-full ${msg.role === 'user' ? 'bg-white/15' : 'bg-blue-50 text-blue-600 border border-blue-100'}`}>
                  <FileText size={14} className="shrink-0" />
                  <span className="truncate max-w-[200px]">{msg.attachedFile.name}</span>
                </div>
              )}
              <div className="prose prose-sm max-w-none">
                <MarkdownContent text={msg.text} isUser={msg.role === 'user'} />
              </div>
              {msg.role === 'assistant' && msg.isGeneratingImage && <ImageGeneratingSkeleton />}
              {msg.role === 'assistant' && msg.generatedImage && !msg.isGeneratingImage && (
                <GeneratedImageCard
                  imageBase64={msg.generatedImage}
                  mimeType={msg.generatedImageMime || 'image/png'}
                  caption={msg.imageCaption}
                  onRegenerate={() => {
                    const q = messages.slice(0, i).reverse().find(m => m.role === 'user')?.text || msg.text;
                    onVisualize(q, i);
                  }}
                  isRegenerating={false}
                />
              )}
            </div>
            <div className={`flex items-center gap-2 mt-2 px-1 flex-wrap ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
              {msg.source === 'voice' && (
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#9aa0a6] flex items-center gap-1 bg-gray-100/50 px-2 py-0.5 rounded"><Mic size={10} /> Voice</span>
              )}
              {msg.grounded && (
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#1e8e3e] flex items-center gap-1 bg-green-50 px-2 py-0.5 rounded">
                  <Globe size={10} /> Search
                </span>
              )}
              {msg.role === 'assistant' && !msg.generatedImage && !msg.isGeneratingImage && (
                <button
                  onClick={() => {
                    const q = messages.slice(0, i).reverse().find(m => m.role === 'user')?.text || msg.text;
                    onVisualize(q, i);
                  }}
                  className="text-[10px] font-bold uppercase tracking-wider text-[#9b72cb] flex items-center gap-1
                             hover:bg-purple-50 active:scale-95 px-2 py-0.5 rounded-lg
                             transition-all bg-purple-50/50 border border-purple-100/50">
                  <Palette size={10} /> Visualize
                </button>
              )}
            </div>
          </div>
        </div>
      ))}

      {liveTranscript && (
        <div className="flex gap-2 sm:gap-2.5 flex-row">
          <div className="w-14 h-14 sm:w-15 sm:h-15 rounded-2xl flex items-center justify-center mb-2 sm:mb-2">
          <img src="./logoGT.png" alt="Logo" />
        </div>
          <div className="max-w-[88%] sm:max-w-[82%] px-3.5 sm:px-4 py-2.5 bg-[#f8f9fa] border
                          border-[#e8eaed] rounded-2xl rounded-tl-sm text-sm text-[#5f6368] italic">
            {liveTranscript}
            <span className="inline-block w-1 h-3.5 bg-[#4285f4] ml-0.5 animate-pulse rounded-sm" />
          </div>
        </div>
      )}

      {isSending && !liveTranscript && (
        <div className="flex gap-2 sm:gap-2.5">
          <div className="w-14 h-14 sm:w-15 sm:h-15 rounded-2xl flex items-center justify-center mb-2 sm:mb-2">
          <img src="./logoGT.png" alt="Logo" />
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
  );
}

// ─── Desktop chat content (header + messages + input) ─────────────────────────

function DesktopChatContent({
  messages, liveTranscript, isSending, isCameraOn, chatInput, textareaRef, chatEndRef,
  onInputChange, onSend, onCapture, onSuggestion, onVisualize, generateVisual,
  uploadedFile, fileInputRef, onFileSelect, onFileClear,
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
}) {
  const getFileIcon = (mimeType: string) => {
    if (mimeType.startsWith('image/')) return '🖼️';
    if (mimeType === 'application/pdf') return '📄';
    return '📝';
  };

  return (
    <>
      <div className="shrink-0 px-6 py-4 border-b border-white/40 flex items-center justify-between bg-white/20 backdrop-blur-sm">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]" />
          <span className="text-xs font-bold text-[#1a1c1e] uppercase tracking-widest opacity-80">Conversation Context</span>
        </div>
        <div className="flex items-center gap-2">
          {isCameraOn && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-bold text-blue-600 bg-blue-100/50 rounded-full border border-blue-200/50 uppercase tracking-tight">
              <Camera size={10} /> Lens Active
            </div>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto relative custom-scrollbar">
        <ChatMessages
          messages={messages} liveTranscript={liveTranscript} isSending={isSending}
          chatEndRef={chatEndRef} onSuggestion={onSuggestion} onVisualize={onVisualize}
        />
      </div>

      <div className="shrink-0 px-6 pb-6 pt-3 bg-white/30 backdrop-blur-md border-t border-white/40">
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

        <div className="relative rounded-[28px] bg-white/80 border border-white shadow-xl shadow-black/5 
                        focus-within:bg-white focus-within:shadow-2xl focus-within:shadow-blue-500/10 transition-all duration-300 group">
          <textarea ref={textareaRef} value={chatInput}
            onChange={onInputChange}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); onSend(); } }}
            placeholder={uploadedFile ? `What should I do with ${uploadedFile.name}?` : 'Ask Gemini Tutor anything...'}
            rows={1} disabled={isSending}
            className="w-full px-6 pt-5 pb-14 text-sm text-[#1a1c1e] bg-transparent resize-none
                       outline-none placeholder:text-gray-400 leading-relaxed max-h-[180px]
                       disabled:opacity-60 font-medium"
          />
          <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between">
            <div className="flex items-center gap-1">
              <button onClick={() => fileInputRef.current?.click()} disabled={isSending}
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
              <span className="text-[10px] text-gray-400 font-bold uppercase tracking-widest opacity-0 group-focus-within:opacity-100 transition-opacity mr-2">
                Press Enter to Send
              </span>
              <button onClick={onSend} disabled={isSending || (!chatInput.trim() && !uploadedFile)}
                className="w-11 h-11 rounded-2xl flex items-center justify-center transition-all
                           bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-500/30
                           disabled:bg-gray-200 disabled:text-gray-400 disabled:shadow-none disabled:cursor-not-allowed active:scale-95">
                <Send size={18} />
              </button>
            </div>
          </div>
        </div>
        <div className="mt-4 flex items-center justify-center gap-4 opacity-40">
           <div className="h-[1px] flex-1 bg-gray-300" />
           <span className="text-[9px] font-black uppercase tracking-[0.2em] text-gray-600">Enterprise AI Tutor</span>
           <div className="h-[1px] flex-1 bg-gray-300" />
        </div>
      </div>
    </>
  );
}

// ─── Mobile chat messages wrapper ─────────────────────────────────────────────

function MobileChatMessages({
  messages, liveTranscript, isSending, chatEndRef, onSuggestion, onVisualize, isCameraOn,
}: {
  messages: ChatMessage[]; liveTranscript: string; isSending: boolean;
  chatEndRef: React.RefObject<HTMLDivElement | null>;
  onSuggestion: (s: string) => void;
  onVisualize: (q: string, i: number) => void;
  isCameraOn: boolean;
}) {
  // When camera PiP is visible, add top padding so messages don't hide under it
  return (
    <ChatMessages
      messages={messages} liveTranscript={liveTranscript} isSending={isSending}
      chatEndRef={chatEndRef} onSuggestion={onSuggestion} onVisualize={onVisualize}
      extraTopPad={isCameraOn}
    />
  );
}

// ─── Tutor Screen ─────────────────────────────────────────────────────────────

function TutorScreen({ apiKey, onBack }: { apiKey: string; onBack: () => void }) {
  // ── UI state ──────────────────────────────────────────────────────────────
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

  // ── Student context (in-session memory) ─────────────────────────────────
  const [studentContext, setStudentContext] = useState<StudentContext>(() => {
    const stored = sessionStorage.getItem('tutor_student_context');
    if (stored) { try { return JSON.parse(stored); } catch { } }
    return { ...EMPTY_STUDENT_CONTEXT };
  });
  useEffect(() => {
    sessionStorage.setItem('tutor_student_context', JSON.stringify(studentContext));
  }, [studentContext]);

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

  const buildSystemInstruction = useCallback((msgs: ChatMessage[], ctx?: StudentContext) => {
    let instruction = TUTOR_SYSTEM_INSTRUCTION;

    // Append student profile if we have any context
    if (ctx && (ctx.language || ctx.level !== 'unknown' || ctx.subjects.length > 0)) {
      const lines: string[] = ['\n\n--- Student Profile (this session) ---'];
      if (ctx.language) lines.push(`Language: ${ctx.language}`);
      if (ctx.level !== 'unknown') lines.push(`Level: ${ctx.level}`);
      if (ctx.subjects.length) lines.push(`Subjects: ${ctx.subjects.join(', ')}`);
      if (ctx.learningStyle !== 'unknown') lines.push(`Learning style: ${ctx.learningStyle}`);
      if (ctx.strengths.length) lines.push(`Strengths: ${ctx.strengths.join(', ')}`);
      if (ctx.struggles.length) lines.push(`Struggles: ${ctx.struggles.join(', ')}`);
      if (ctx.topicsCovered.length) lines.push(`Topics covered: ${ctx.topicsCovered.join(', ')}`);
      lines.push('--- End Student Profile ---');
      instruction += lines.join('\n');
    } else if (ctx && !ctx.triageComplete) {
      instruction += '\n\nNote: This is the START of the session. Begin with the triage/onboarding as described above.';
    }

    // Append conversation history (for Live API which needs it in system instruction)
    if (msgs.length) {
      const summary = msgs.slice(-12).map(m => `${m.role === 'user' ? 'Student' : 'Tutor'}: ${m.text.slice(0, 200)}`).join('\n');
      instruction += `\n\n--- Conversation history (remember, do NOT repeat) ---\n${summary}\n--- End ---`;
    }

    return instruction;
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
        mimeType = data.mimeType;
        caption = data.caption;
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
            mimeType = (part as any).inlineData.mimeType;
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

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const TEXT_TYPES = ['text/plain', 'text/markdown', 'text/csv', 'application/json', 'text/html', 'text/xml'];
    const isText = TEXT_TYPES.some(t => file.type.startsWith(t)) || /\.(txt|md|csv|json|html|xml|py|js|ts|java|c|cpp|rs)$/i.test(file.name);

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

    if (isText) {
      reader.readAsText(file);
    } else {
      reader.readAsDataURL(file);
    }

    // Reset input so the same file can be selected again
    e.target.value = '';
  }, []);

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

      try {
        const res = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: userMsg.text,
            image: frameBase64,
            fileData: currentFile || undefined,
            sessionId,
            history: messages.slice(-12).map(m => ({ role: m.role, text: m.text })),
            generateImage: shouldVisualise,
            studentContext,
          }),
        });
        if (!res.ok) throw new Error(`Backend ${res.status}`);
        const data = await res.json();
        response = data.response;
        grounded = data.grounded ?? false;
        autoImage = data.generatedImage || null;
        autoImageMime = data.generatedImageMime || null;
        autoCaption = data.imageCaption || null;
      } catch {
        // Client-side fallback with Google Search
        if (!apiKey) throw new Error('Backend unavailable and no API key provided.');
        const ai = new GoogleGenAI({ apiKey });
        const parts: any[] = [];
        if (frameBase64) parts.push({ inlineData: { data: frameBase64, mimeType: 'image/jpeg' } });
        if (currentFile && !currentFile.isText) {
          parts.push({ inlineData: { data: currentFile.data, mimeType: currentFile.mimeType } });
        }
        let msgText = userMsg.text;
        if (currentFile?.isText) {
          msgText = `[Arquivo: ${currentFile.name}]\n\n${currentFile.data}\n\n---\n\n${msgText}`;
        }
        parts.push({ text: msgText });
        const histContents = messages.slice(-12).map(m => ({ role: m.role === 'user' ? 'user' : 'model', parts: [{ text: m.text }] }));
        histContents.push({ role: 'user', parts });
        const result = await ai.models.generateContent({
          model: TEXT_MODEL,
          contents: histContents,
          config: { systemInstruction: buildSystemInstruction(messages, studentContext), tools: [{ googleSearch: {} }] },
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
      setError(err.message || 'Failed to send message');
      setMessages(prev => [...prev, { role: 'assistant', text: `Sorry, something went wrong: ${err.message}`, source: 'text' }]);
    } finally { setIsSending(false); }
  }, [chatInput, captureFrame, messages, apiKey, sessionId, resetTextarea, generateVisual, uploadedFile]);

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
                    // Defer so state has settled
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
          systemInstruction: buildSystemInstruction(currentMessages, studentContext),
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

  // ─── Render ──────────────────────────────────────────────────────────────────
  //
  // Mobile  (<768px): full-screen chat, camera as floating PiP overlay,
  //                   Gemini-style bottom input + FAB voice bar.
  // Desktop (≥768px): side-by-side video + chat panel.

  const [camExpanded, setCamExpanded] = useState(false);

  return (
    <div className="h-dvh bg-[#fdfdff] flex flex-col overflow-hidden relative select-none md:select-auto"
      style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}>
      
      {/* Dynamic Mesh Background */}
      <div className="absolute inset-0 pointer-events-none opacity-40 overflow-hidden z-0">
        <div className="absolute -top-[20%] -left-[10%] w-[60%] h-[60%] bg-blue-200/50 rounded-full blur-[120px] animate-pulse" />
        <div className="absolute top-[40%] -right-[10%] w-[50%] h-[50%] bg-purple-200/50 rounded-full blur-[120px]" style={{ animationDelay: '2s' }} />
        <div className="absolute -bottom-[10%] left-[20%] w-[40%] h-[40%] bg-indigo-200/40 rounded-full blur-[100px]" />
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
      <header className="shrink-0 flex items-center justify-between px-4 md:px-8 h-16
                         bg-white/60 backdrop-blur-xl border-b border-white/40 z-10 shadow-sm shadow-black/5"
        style={{
          paddingLeft: 'max(1rem, env(safe-area-inset-left))',
          paddingRight: 'max(1rem, env(safe-area-inset-right))'
        }}>
        <button onClick={onBack}
          className="flex items-center gap-3 text-[#202124] hover:opacity-80 transition-all active:scale-95 group">
          <div className="w-10 h-10 bg-white rounded-2xl shadow-sm border border-gray-100 flex items-center justify-center group-hover:shadow-md transition-shadow">
            <img src="./logoGT.png" alt="Logo" className="w-7 h-7" />
          </div>
          <div className="flex flex-col items-start leading-tight">
            <span className="text-base font-bold tracking-tight">Gemini Tutor</span>
            <span className="text-[10px] text-[#5f6368] font-medium uppercase tracking-wider opacity-60">AI Study Engine</span>
          </div>
        </button>

        <div className="flex items-center gap-3">
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-[11px] font-bold tracking-wide border transition-all duration-500 ${isConnected ? 'bg-green-50 text-green-700 border-green-200 shadow-sm shadow-green-200/20'
            : isConnecting ? 'bg-amber-50 text-amber-700 border-amber-200'
              : 'bg-gray-100 text-gray-500 border-gray-200'
            }`}>
            <span className={`w-2 h-2 rounded-full shrink-0 ${isConnected ? 'bg-green-500 animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.6)]'
              : isConnecting ? 'bg-amber-500 animate-pulse'
                : 'bg-gray-400'
              }`} />
            {isConnected ? 'LIVE SESSION' : isConnecting ? 'CONNECTING…' : 'DISCONNECTED'}
          </div>
        </div>
      </header>

      {/* ── DESKTOP: side-by-side ────────────────────────────────────────────── */}
      <div className="hidden md:flex flex-1 gap-3 p-3 lg:p-4 overflow-hidden max-w-7xl mx-auto w-full">

        {/* Desktop left — video + controls */}
        <div className="flex flex-col gap-3 w-[42%] lg:w-[44%] shrink-0">
          <div className="relative bg-[#1c1c1e] rounded-2xl overflow-hidden aspect-video shadow-sm flex-1">
            <video ref={videoRef} autoPlay playsInline muted
              className={`w-full h-full object-cover ${isCameraOn ? '' : 'hidden'}`} />
            {!isCameraOn && (
              <div className="w-full h-full flex flex-col items-center justify-center text-[#9aa0a6] gap-2">
                <Camera size={36} strokeWidth={1.5} />
                <p className="text-xs">Camera is off</p>
              </div>
            )}
            {/* Note: on mobile the videoRef is used by the PiP overlay above.
                The desktop panel is hidden on mobile so only one element uses the ref. */}
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

          <p className="text-[11px] text-[#9aa0a6] text-center">{statusMessage}</p>
          {error && (
            <div className="px-3 py-2 bg-[#fce8e6] border border-[#f5c6c2] rounded-xl text-[#c5221f] text-xs text-center">
              {error}
            </div>
          )}

          <div className="flex items-center gap-2.5 justify-center flex-wrap">
            <button onClick={isCameraOn ? stopCamera : startCamera}
              className={`w-11 h-11 rounded-full flex items-center justify-center transition-all shadow-sm ${isCameraOn
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
                          transition-all shadow-sm hover:shadow disabled:opacity-50 disabled:cursor-not-allowed ${isConnected ? 'bg-[#ea4335] text-white hover:bg-[#d93025]' : 'bg-[#1a73e8] text-white hover:bg-[#1765cc]'
                }`}>
              {isConnected ? <><MicOff size={17} /> Stop Voice</>
                : isConnecting ? <><svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>Connecting...</>
                  : <><Mic size={17} /> Start Voice</>}
            </button>
          </div>
        </div>

        {/* Desktop right — chat */}
        <div className="flex-1 flex flex-col bg-white rounded-2xl shadow-sm border border-[#e8eaed] overflow-hidden">
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
          />
        </div>
      </div>

      {/* ── MOBILE: full-screen chat + PiP overlay ──────────────────────────── */}
      <div className="md:hidden flex-1 flex flex-col overflow-hidden relative">

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
                <span className="w-1.5 h-1.5 rounded-full bg-[#ea4335] animate-pulse" />
                <span className="text-white text-[8px] font-bold tracking-widest">LIVE</span>
              </div>
            )}
            {/* Speaking animation */}
            {isModelSpeaking && (
              <div className="absolute bottom-1.5 left-1/2 -translate-x-1/2 flex items-center gap-1
                              px-2 py-1 bg-black/60 backdrop-blur-sm rounded-full">
                {[0, 120, 240].map(d => (
                  <span key={d} className="w-1 rounded-full bg-[#4285f4] animate-bounce"
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
          <div className="absolute top-3 left-3 right-3 z-30 px-3 py-2 bg-[#fce8e6] border border-[#f5c6c2]
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
          />
        </div>

        {/* ── Mobile input bar ─────────────────────────────────────────────── */}
        <div className="shrink-0 bg-white border-t border-[#e8eaed]"
          style={{
            paddingBottom: 'env(safe-area-inset-bottom, 0px)',
            paddingLeft: 'env(safe-area-inset-left, 0px)',
            paddingRight: 'env(safe-area-inset-right, 0px)'
          }}>

          {/* Status pill */}
          {isConnected && (
            <div className="flex justify-center pt-1.5">
              <span className={`inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full text-[10px] font-medium ${isModelSpeaking ? 'text-[#1a73e8] bg-[#e8f0fe]'
                : 'text-[#9aa0a6] bg-[#f1f3f4]'
                }`}>
                {isModelSpeaking
                  ? <><span className="w-1.5 h-1.5 rounded-full bg-[#1a73e8] animate-pulse" /> Speaking…</>
                  : <><span className="w-1.5 h-1.5 rounded-full bg-[#34a853] animate-pulse" /> Listening</>
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
            <div className="flex items-end gap-2 bg-white/80 backdrop-blur-md rounded-[28px] px-2.5 py-2.5
                            border border-white shadow-xl shadow-black/5 focus-within:bg-white
                            focus-within:shadow-2xl focus-within:shadow-blue-500/10 transition-all">

              {/* Camera button — left of input */}
              <button onClick={isCameraOn ? () => { stopCamera(); setCamExpanded(false); } : startCamera}
                className={`shrink-0 w-10 h-10 rounded-2xl flex items-center justify-center
                            transition-all active:scale-90 mb-0.5 ${isCameraOn
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20'
                    : 'text-gray-500 hover:bg-gray-100'
                  }`}
                title={isCameraOn ? 'Camera on' : 'Turn on camera'}>
                {isCameraOn ? <Camera size={18} /> : <CameraOff size={18} />}
              </button>

              {/* File upload button */}
              <button onClick={() => fileInputRef.current?.click()} disabled={isSending}
                className={`shrink-0 w-10 h-10 rounded-2xl flex items-center justify-center
                            transition-all active:scale-90 mb-0.5 ${uploadedFile
                    ? 'bg-blue-50 text-blue-600 border border-blue-100'
                    : 'text-gray-500 hover:bg-gray-100'
                  }`}>
                <Paperclip size={18} />
              </button>

              {/* Text area */}
              <textarea
                ref={textareaRef} value={chatInput}
                onChange={handleInputChange}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendChatMessage(false); } }}
                placeholder={uploadedFile ? `Analyze this...` : isConnected ? 'Speak or type...' : 'Ask me anything...'}
                rows={1} disabled={isSending}
                className="flex-1 bg-transparent text-[15px] text-[#1a1c1e] resize-none outline-none
                           placeholder:text-gray-400 leading-relaxed py-2 max-h-[140px]
                           disabled:opacity-60 min-h-[40px] font-medium"
              />

              {/* Right side — send or mic */}
              {(chatInput.trim() || uploadedFile) && (
                <button onClick={() => sendChatMessage(false)} disabled={isSending}
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
                    className="flex items-center gap-2 px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest
                               bg-amber-100 text-amber-700 border border-amber-200 active:scale-95
                               transition-all animate-pulse min-h-[38px] shadow-sm">
                    <StopCircle size={14} /> Stop
                  </button>
                )}
              </div>

              {/* Centre: big voice FAB with GLOW */}
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
    </div>
  );
}

// ─── App Root ─────────────────────────────────────────────────────────────────

export default function App() {
  const [screen, setScreen] = useState<'landing' | 'tutor'>('landing');
  const apiKey = process.env.GEMINI_API_KEY || '';

  if (screen === 'landing') {
    return <LandingPage onStartLearning={() => setScreen('tutor')} />;
  }

  return <TutorScreen apiKey={apiKey} onBack={() => setScreen('landing')} />;
}
