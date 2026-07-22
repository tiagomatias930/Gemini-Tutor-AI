import React from 'react';
import { Send, Paperclip, Camera, Mic, MicOff, StopCircle, CornerDownLeft, X } from 'lucide-react';
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
    <div className="p-4 md:p-6 border-t backdrop-blur-md transition-colors duration-300" style={{ backgroundColor: `${c.bg}CC`, borderColor: c.border }}>
      <div className="max-w-4xl mx-auto flex flex-col gap-3">
        
        {/* File Preview */}
        <AnimatePresence>
          {uploadedFile && (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium w-fit border"
              style={{ backgroundColor: 'rgba(66, 133, 244, 0.1)', color: '#1a73e8', borderColor: 'rgba(66, 133, 244, 0.2)' }}
            >
              <Paperclip size={14} />
              <span className="truncate max-w-[200px]">{uploadedFile.name}</span>
              <button onClick={onFileClear} className="hover:text-red-500 transition-colors">
                <X size={14} />
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
              placeholder={uploadedFile ? "Ask about this file..." : "Ask Ngola Tutor anything..."}
              rows={1}
              disabled={isSending}
              className="w-full pl-5 pr-12 py-3.5 rounded-2xl text-sm transition-all resize-none outline-none border focus:ring-2 disabled:opacity-60 max-h-32"
              style={{ 
                backgroundColor: isDark ? 'rgba(30, 41, 59, 0.5)' : '#f1f3f4',
                borderColor: c.border,
                color: c.text,
                boxShadow: isDark ? 'none' : 'inset 0 1px 2px rgba(0,0,0,0.05)'
              }}
            />
            
            <div className="absolute bottom-2.5 right-3 flex items-center gap-1">
              <button 
                onClick={onFileClick}
                disabled={isSending}
                className="p-1.5 rounded-lg text-gray-500 hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
              >
                <Paperclip size={18} />
              </button>
              {isCameraOn && (
                <button 
                  onClick={onCapture}
                  disabled={isSending}
                  className="p-1.5 rounded-lg text-gray-500 hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
                >
                  <Camera size={18} />
                </button>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 mb-0.5">
            {/* Voice Control Button */}
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={isConnected ? stopSession : startSession}
              disabled={isConnecting}
              className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all shadow-lg ${
                isConnected 
                  ? 'bg-red-500 text-white shadow-red-500/25' 
                  : 'bg-blue-600 text-white shadow-blue-600/25'
              }`}
            >
              {isConnecting ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : isConnected ? (
                <MicOff size={22} />
              ) : (
                <Mic size={22} />
              )}
            </motion.button>

            {/* Send Button */}
            {(chatInput.trim() || uploadedFile) && (
              <motion.button
                initial={{ opacity: 0, scale: 0.5 }}
                animate={{ opacity: 1, scale: 1 }}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={onSend}
                disabled={isSending}
                className="w-12 h-12 rounded-2xl bg-blue-600 text-white flex items-center justify-center shadow-lg shadow-blue-600/25 active:scale-95"
              >
                <Send size={20} />
              </motion.button>
            )}

            {/* Stop Speaking Button */}
            {isConnected && isModelSpeaking && (
              <motion.button
                initial={{ opacity: 0, scale: 0.5 }}
                animate={{ opacity: 1, scale: 1 }}
                onClick={interruptAgent}
                className="w-12 h-12 rounded-2xl bg-amber-500 text-white flex items-center justify-center shadow-lg shadow-amber-500/25"
              >
                <StopCircle size={22} />
              </motion.button>
            )}
          </div>
        </div>
        
        <div className="hidden md:flex justify-between px-2">
          <p className="text-[10px] text-gray-400 font-medium">
            Shift + Enter for new line
          </p>
          <p className="text-[10px] text-gray-400 font-medium hidden md:block">
            Ngola Tutor · Advanced Learning Engine
          </p>
        </div>
      </div>
    </div>
  );
};
