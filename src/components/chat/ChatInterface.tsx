import React, { useRef, useEffect } from 'react';
import { useTheme } from '../../contexts/ThemeContext';
import { ChatSidebar } from './ChatSidebar';
import { ChatHeader } from './ChatHeader';
import { ChatMessage } from './ChatMessage';
import { ChatInput } from './ChatInput';
import { Whiteboard } from './Whiteboard';
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
  // Whiteboard
  isWhiteboardVisible: boolean;
  whiteboardElements: any[];
  setIsWhiteboardVisible: (v: boolean) => void;
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

        <div className="flex-1 flex flex-col lg:flex-row overflow-hidden relative">
          
          {/* Main Educational Content Area (Whiteboard & Video) */}
          <div className="hidden lg:flex flex-1 flex-col overflow-hidden relative" style={{ backgroundColor: c.bg }}>
            {props.isWhiteboardVisible || props.isCameraOn ? (
              <div className="flex-1 flex flex-col p-6 gap-6">
                {props.isCameraOn && (
                  <motion.div 
                    initial={{ y: -20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    className="relative aspect-video max-h-[300px] rounded-3xl overflow-hidden bg-black shadow-2xl border-2 border-white/10 self-center"
                  >
                    <video ref={props.videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
                    <div className="absolute top-4 left-4 flex items-center gap-2 px-3 py-1.5 bg-black/60 backdrop-blur-md rounded-full border border-white/10">
                      <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                      <span className="text-[10px] font-bold text-white tracking-widest uppercase">Visual Context Active</span>
                    </div>
                    <button 
                      onClick={props.stopCamera}
                      className="absolute bottom-4 right-4 p-2.5 rounded-xl bg-red-500/80 hover:bg-red-500 text-white backdrop-blur-md transition-all border border-red-400/20"
                    >
                      <CameraOff size={18} />
                    </button>
                  </motion.div>
                )}

                {props.isWhiteboardVisible && (
                  <motion.div 
                    initial={{ scale: 0.95, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="flex-1 flex flex-col bg-white/5 rounded-[2rem] border border-white/10 shadow-inner overflow-hidden"
                  >
                    <div className="flex-1 relative">
                      <Whiteboard elements={props.whiteboardElements} isDark={isDark} />
                    </div>
                    <div className="p-4 border-t border-white/5 flex justify-between items-center bg-black/20">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-blue-500" />
                        <span className="text-[10px] font-bold uppercase tracking-wider opacity-60">Interactive Whiteboard</span>
                      </div>
                      <button 
                        onClick={() => props.setIsWhiteboardVisible(false)}
                        className="px-4 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wider transition-all hover:bg-white/10 border border-white/10"
                      >
                        Close Board
                      </button>
                    </div>
                  </motion.div>
                )}
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center p-12 text-center">
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="space-y-8 max-w-lg"
                >
                  <div className="relative inline-block">
                    <div className="absolute inset-0 blur-3xl bg-blue-500/20 rounded-full" />
                    <img src="./logoGT.png" alt="Logo" className="w-24 h-24 relative opacity-20 grayscale" />
                  </div>
                  <div className="space-y-3">
                    <h2 className="text-2xl font-bold tracking-tight opacity-20">Educational Workspace</h2>
                    <p className="text-sm opacity-30 leading-relaxed">
                      Ask Ngola Tutor to visualize a concept, solve a math problem, or explain a diagram to activate this board.
                    </p>
                  </div>
                </motion.div>
              </div>
            )}
          </div>

          {/* Chat Sidebar Area (Messages & Input) */}
          <div className="flex-1 lg:w-[400px] lg:flex-none flex flex-col border-l relative z-10" style={{ backgroundColor: c.bgAlt, borderColor: c.border }}>
            <div className="flex-1 overflow-y-auto px-4 py-6">
              <div className="w-full">
                <AnimatePresence initial={false}>
                  {props.messages.length === 0 && !props.liveTranscript && (
                    <motion.div 
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="flex flex-col items-center justify-center py-12 text-center space-y-6"
                    >
                      <div className="w-16 h-16 flex items-center justify-center rounded-2xl bg-blue-500/10 mb-2">
                        <img src="./logoGT.png" alt="Logo" className="w-10 h-10" />
                      </div>
                      
                      <div className="flex flex-col gap-2 w-full max-w-[280px] mt-4">
                        {[
                          'Explain photosynthesis',
                          'DNA structure diagram',
                          'Solve this math problem'
                        ].map((s, i) => (
                          <button 
                            key={i}
                            onClick={() => { props.setChatInput(s); props.textareaRef.current?.focus(); }}
                            className="w-full px-4 py-2.5 rounded-xl text-[11px] font-medium border transition-all hover:bg-blue-500/5 text-left flex items-center gap-2"
                            style={{ backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : 'white', borderColor: c.border, color: c.textMuted }}
                          >
                            <div className="w-1 h-1 rounded-full bg-blue-500" />
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
        </div>
      </main>
    </div>
  );
};
