import React, { useRef, useEffect } from 'react';
import { useTheme } from '../../contexts/ThemeContext';
import { ChatSidebar } from './ChatSidebar';
import { ChatHeader } from './ChatHeader';
import { ChatMessage } from './ChatMessage';
import { ChatInput } from './ChatInput';
import { Camera, CameraOff, Palette } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { MarkdownContent, GeneratedImageCard, ImageGeneratingSkeleton } from './ChatComponents';

interface ChatInterfaceProps {
  messages: any[];
  liveTranscript: string;
  isSending: boolean;
  isConnected: boolean;
  isConnecting: boolean;
  statusMessage: string;
  error: string;
  onBack: () => void;
  // Camera
  isCameraOn: boolean;
  startCamera: () => void;
  stopCamera: () => void;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  // Voice
  isModelSpeaking: boolean;
  startSession: () => void;
  stopSession: () => void;
  interruptAgent: () => void;
  // Chat actions
  chatInput: string;
  setChatInput: (v: string) => void;
  sendChatMessage: (capture: boolean) => void;
  generateVisual: (q: string, i: number) => void;
  // File
  uploadedFile: any;
  onFileClick: () => void;
  onFileClear: () => void;
  // Utils
  renderInline: (text: string) => React.ReactNode[];
  chatEndRef: React.RefObject<HTMLDivElement | null>;
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
}

export const ChatInterface: React.FC<ChatInterfaceProps> = (props) => {
  const { c, isDark } = useTheme();

  useEffect(() => {
    props.chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [props.messages, props.liveTranscript]);

  return (
    <div className="flex h-dvh w-full overflow-hidden transition-colors duration-300" style={{ backgroundColor: c.bg }}>
      {/* Desktop Sidebar */}
      <ChatSidebar 
        onNewChat={() => window.location.reload()} 
        onBack={props.onBack}
        sessions={[]} 
      />

      <main className="flex-1 flex flex-col min-w-0 relative">
        <ChatHeader 
          isConnected={props.isConnected}
          isConnecting={props.isConnecting}
          statusMessage={props.statusMessage}
        />

        <div className="flex-1 flex flex-col md:flex-row overflow-hidden relative">
          
          {/* Chat Area */}
          <div className="flex-1 flex flex-col overflow-hidden relative z-10">
            <div className="flex-1 overflow-y-auto px-4 py-6 md:px-8">
              <div className="max-w-3xl mx-auto">
                <AnimatePresence initial={false}>
                  {props.messages.length === 0 && !props.liveTranscript && (
                    <motion.div 
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="flex flex-col items-center justify-center py-20 text-center space-y-6"
                    >
                      <div className="w-20 h-20 rounded-3xl bg-blue-500/10 flex items-center justify-center">
                        <img src="./logoGT.png" alt="Logo" className="w-12 h-12" />
                      </div>
                      <div className="space-y-2">
                        <h2 className="text-xl font-bold" style={{ color: c.text }}>How can I help your studies?</h2>
                        <p className="text-sm max-w-sm mx-auto" style={{ color: c.textMuted }}>
                          I can explain complex topics, analyze images of your homework, or even generate diagrams to help you learn.
                        </p>
                      </div>
                      
                      <div className="flex flex-wrap justify-center gap-3 mt-4">
                        {[
                          'Explain how photosynthesis works',
                          'Describe the DNA structure',
                          'Solve a math problem from my image'
                        ].map((s, i) => (
                          <button 
                            key={i}
                            onClick={() => { props.setChatInput(s); props.textareaRef.current?.focus(); }}
                            className="px-4 py-2.5 rounded-xl text-xs font-medium border transition-all hover:scale-105 active:scale-95"
                            style={{ backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'white', borderColor: c.border, color: c.textMuted }}
                          >
                            {s}
                          </button>
                        ))}
                      </div>
                    </motion.div>
                  )}

                  {props.messages.map((msg, i) => (
                    <ChatMessage 
                      key={i}
                      msg={msg}
                      isUser={msg.role === 'user'}
                      onVisualize={(q) => props.generateVisual(q, i)}
                      renderMarkdown={(t, isUser) => <MarkdownContent text={t} isUser={isUser} renderInline={props.renderInline} />}
                      renderGeneratedImage={(m) => (
                        <>
                          {m.isGeneratingImage && <ImageGeneratingSkeleton />}
                          {m.generatedImage && !m.isGeneratingImage && (
                            <GeneratedImageCard 
                              imageBase64={m.generatedImage}
                              mimeType={m.generatedImageMime || 'image/png'}
                              caption={m.imageCaption}
                              onRegenerate={() => props.generateVisual(m.text, i)}
                            />
                          )}
                        </>
                      )}
                    />
                  ))}

                  {props.liveTranscript && (
                    <ChatMessage 
                      msg={{ role: 'assistant', text: props.liveTranscript, source: 'voice' }}
                      isUser={false}
                      renderMarkdown={(t) => (
                        <div className="italic opacity-80 flex items-center gap-2">
                          {t}
                          <span className="w-1 h-4 bg-blue-500 animate-pulse rounded-full" />
                        </div>
                      )}
                    />
                  )}

                  {props.isSending && !props.liveTranscript && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex gap-3 mb-6">
                       <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center animate-pulse">
                         <img src="./logoGT.png" alt="AI" className="w-6 h-6 opacity-50" />
                       </div>
                       <div className="flex gap-1 items-center px-4 py-3 rounded-2xl bg-black/5 dark:bg-white/5">
                          {[0, 150, 300].map(d => (
                            <span key={d} className="w-1.5 h-1.5 bg-blue-500/40 rounded-full animate-bounce" style={{ animationDelay: `${d}ms` }} />
                          ))}
                       </div>
                    </motion.div>
                  )}
                </AnimatePresence>
                <div ref={props.chatEndRef} className="h-4" />
              </div>
            </div>

            <ChatInput 
              chatInput={props.chatInput}
              setChatInput={props.setChatInput}
              onSend={() => props.sendChatMessage(false)}
              onCapture={() => props.sendChatMessage(true)}
              onFileClick={props.onFileClick}
              isSending={props.isSending}
              isConnected={props.isConnected}
              isConnecting={props.isConnecting}
              isCameraOn={props.isCameraOn}
              isModelSpeaking={props.isModelSpeaking}
              startSession={props.startSession}
              stopSession={props.stopSession}
              interruptAgent={props.interruptAgent}
              uploadedFile={props.uploadedFile}
              onFileClear={props.onFileClear}
              textareaRef={props.textareaRef}
            />
          </div>

          {/* Video Sidebar (Desktop) */}
          {props.isCameraOn && (
            <motion.div 
              initial={{ x: 300, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              className="hidden lg:flex flex-col w-80 p-4 border-l overflow-hidden"
              style={{ backgroundColor: c.bgAlt, borderColor: c.border }}
            >
              <div className="relative aspect-video rounded-2xl overflow-hidden bg-black shadow-2xl border-2 border-white/10">
                <video ref={props.videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
                <div className="absolute top-2 left-2 flex items-center gap-1.5 px-2 py-1 bg-black/60 backdrop-blur-md rounded-full">
                  <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                  <span className="text-[8px] font-bold text-white tracking-widest uppercase">Visual Input Active</span>
                </div>
              </div>
              <div className="mt-4 p-4 rounded-2xl border bg-black/5 dark:bg-white/5" style={{ borderColor: c.border }}>
                 <p className="text-xs font-bold uppercase tracking-wider opacity-40 mb-2">Visual Context</p>
                 <p className="text-[11px]" style={{ color: c.textMuted }}>Gemini is watching and can see what you show to the camera.</p>
              </div>
              <button 
                onClick={props.stopCamera}
                className="mt-auto w-full py-3 rounded-xl border flex items-center justify-center gap-2 text-sm font-medium transition-all hover:bg-red-500/10 text-red-500"
                style={{ borderColor: 'rgba(239, 68, 68, 0.2)' }}
              >
                <CameraOff size={16} /> Stop Camera
              </button>
            </motion.div>
          )}
        </div>
      </main>
    </div>
  );
};
