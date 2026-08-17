import React from 'react';
import { Send, Paperclip, Camera, Mic, MicOff, StopCircle, CornerDownLeft, X, Sparkles } from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';
import { motion, AnimatePresence } from 'framer-motion';

interface ChatInputProps {
  chatInput: string;
  setChatInput: (v: string) => void;
  onSend: () => void;
  onCapture: () => void;
  onFileClick: () => void;
  isSending: boolean;
  isConnected: boolean;
  isConnecting: boolean;
  isCameraOn: boolean;
  isModelSpeaking: boolean;
  startSession: () => void;
  stopSession: () => void;
  interruptAgent: () => void;
  uploadedFile: any;
  onFileClear: () => void;
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
}

export const ChatInput: React.FC<ChatInputProps> = ({
  chatInput, setChatInput, onSend, onCapture, onFileClick,
  isSending, isConnected, isConnecting, isCameraOn, isModelSpeaking,
  startSession, stopSession, interruptAgent, uploadedFile, onFileClear,
  textareaRef
}) => {
  const { c, isDark } = useTheme();

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onSend();
    }
  };

  return (
    <div 
      className="p-4 md:p-5 border-t backdrop-blur-xl transition-colors duration-300" 
      style={{ 
        backgroundColor: isDark ? 'rgba(8, 12, 20, 0.9)' : 'rgba(255, 255, 255, 0.9)', 
        borderColor: c.border 
      }}
    >
      <div className="max-w-4xl mx-auto flex flex-col gap-3">
        
        {/* File Preview */}
        <AnimatePresence>
          {uploadedFile && (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold w-fit border shadow-sm"
              style={{ backgroundColor: isDark ? 'rgba(59, 130, 246, 0.15)' : '#EFF6FF', color: '#2563EB', borderColor: 'rgba(59, 130, 246, 0.3)' }}
            >
              <Paperclip size={13} />
              <span className="truncate max-w-[200px]">{uploadedFile.name}</span>
              <button onClick={onFileClear} className="hover:text-red-500 transition-colors p-0.5">
                <X size={13} />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex items-end gap-3">
          <div className="flex-1 relative group">
            <textarea
              ref={textareaRef}
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={uploadedFile ? "Pergunte algo sobre este arquivo..." : "Pergunte ao Ngola Tutor..."}
              rows={1}
              disabled={isSending}
              className="w-full pl-5 pr-20 py-3.5 rounded-2xl text-sm transition-all resize-none outline-none border focus:ring-2 focus:ring-blue-500/20 disabled:opacity-60 max-h-32 font-sans"
              style={{ 
                backgroundColor: isDark ? 'rgba(19, 28, 49, 0.6)' : '#F8FAFC',
                borderColor: c.border,
                color: c.text,
              }}
            />
            
            <div className="absolute bottom-2.5 right-3 flex items-center gap-1">
              <button 
                onClick={onFileClick}
                disabled={isSending}
                title="Anexar arquivo"
                className="p-2 rounded-xl text-slate-400 hover:text-blue-500 hover:bg-blue-500/10 transition-colors"
              >
                <Paperclip size={17} />
              </button>
              {isCameraOn && (
                <button 
                  onClick={onCapture}
                  disabled={isSending}
                  title="Capturar foto do caderno"
                  className="p-2 rounded-xl text-slate-400 hover:text-emerald-500 hover:bg-emerald-500/10 transition-colors"
                >
                  <Camera size={17} />
                </button>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 mb-0.5">
            {/* Voice Control Button */}
            <motion.button
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.96 }}
              onClick={isConnected ? stopSession : startSession}
              disabled={isConnecting}
              title={isConnected ? "Pausar sessão de voz" : "Iniciar conversa por voz"}
              className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all shadow-lg ${
                isConnected 
                  ? 'bg-rose-500 hover:bg-rose-600 text-white shadow-rose-500/25' 
                  : 'bg-gradient-to-tr from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white shadow-blue-500/25'
              }`}
            >
              {isConnecting ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : isConnected ? (
                <MicOff size={20} />
              ) : (
                <Mic size={20} />
              )}
            </motion.button>

            {/* Send Button */}
            {(chatInput.trim() || uploadedFile) && (
              <motion.button
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                whileHover={{ scale: 1.04 }}
                whileTap={{ scale: 0.96 }}
                onClick={onSend}
                disabled={isSending}
                className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center shadow-lg shadow-blue-500/25 active:scale-95"
              >
                <Send size={18} />
              </motion.button>
            )}

            {/* Stop Speaking Button */}
            {isConnected && isModelSpeaking && (
              <motion.button
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                onClick={interruptAgent}
                title="Interromper fala do tutor"
                className="w-12 h-12 rounded-2xl bg-amber-500 hover:bg-amber-600 text-white flex items-center justify-center shadow-lg shadow-amber-500/25"
              >
                <StopCircle size={20} />
              </motion.button>
            )}
          </div>
        </div>
        
        <div className="hidden md:flex justify-between px-2 text-[11px] font-medium" style={{ color: c.textSubtle }}>
          <span>Pressione Enter para enviar, Shift + Enter para nova linha</span>
          <span className="flex items-center gap-1">
            <Sparkles size={11} className="text-blue-500" /> Ngola Tutor AI • Acessibilidade Universal
          </span>
        </div>
      </div>
    </div>
  );
};
