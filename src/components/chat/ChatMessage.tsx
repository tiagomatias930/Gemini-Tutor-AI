import React from 'react';
import { motion } from 'framer-motion';
import { Mic, Globe, Palette, FileText } from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';

interface ChatMessageProps {
  msg: any;
  isUser: boolean;
  onVisualize?: (q: string) => void;
  renderMarkdown: (text: string, isUser: boolean) => React.ReactNode;
  renderGeneratedImage?: (msg: any) => React.ReactNode;
}

export const ChatMessage: React.FC<ChatMessageProps> = ({ 
  msg, isUser, onVisualize, renderMarkdown, renderGeneratedImage 
}) => {
  const { c, isDark } = useTheme();

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.3 }}
      className={`flex gap-3 mb-6 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}
    >
      {!isUser && (
        <div className="w-8 h-8 flex-shrink-0 flex items-center justify-center overflow-hidden">
          <img src="./logoGT.png" alt="AI" className="w-6 h-6 object-contain" />
        </div>
      )}

      <div className={`max-w-[85%] md:max-w-[70%] flex flex-col ${isUser ? 'items-end' : 'items-start'}`}>
        <div 
          className={`relative px-4 py-3 rounded-2xl text-sm leading-relaxed shadow-sm transition-colors duration-300 ${
            isUser 
              ? 'bg-blue-600 text-white rounded-tr-none' 
              : 'rounded-tl-none border'
          }`}
          style={!isUser ? { 
            backgroundColor: isDark ? 'rgba(30, 41, 59, 0.5)' : 'rgba(255, 255, 255, 0.8)',
            borderColor: c.border,
            backdropFilter: 'blur(8px)',
            color: c.text
          } : {}}
        >
          {msg.image && (
            <div className="mb-2 rounded-lg overflow-hidden border border-white/20">
              <img src={msg.image} alt="Captured" className="max-h-48 w-auto object-contain" />
            </div>
          )}
          
          {msg.attachedFile && (
            <div 
              className="flex items-center gap-2 px-3 py-2 rounded-xl mb-2 text-xs font-medium w-fit max-w-full"
              style={{ backgroundColor: isUser ? 'rgba(255,255,255,0.15)' : 'rgba(66, 133, 244, 0.1)', color: isUser ? 'white' : '#1a73e8' }}
            >
              <FileText size={14} className="shrink-0" />
              <span className="truncate">{msg.attachedFile.name}</span>
            </div>
          )}

          <div className="prose prose-sm dark:prose-invert max-w-none">
            {renderMarkdown(msg.text, isUser)}
          </div>

          {msg.role === 'assistant' && renderGeneratedImage && renderGeneratedImage(msg)}
        </div>

        <div className={`flex items-center gap-2 mt-1.5 px-1 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
          {msg.source === 'voice' && (
            <span className="text-[9px] font-bold uppercase tracking-wider flex items-center gap-1" style={{ color: c.textSubtle }}>
              <Mic size={10} /> Voice
            </span>
          )}
          {msg.grounded && (
            <span className="text-[9px] font-bold uppercase tracking-wider flex items-center gap-1 text-green-500 bg-green-500/10 px-1.5 py-0.5 rounded">
              <Globe size={10} /> Search
            </span>
          )}
          {!isUser && !msg.generatedImage && !msg.isGeneratingImage && onVisualize && (
            <button
              onClick={() => onVisualize(msg.text)}
              className="text-[9px] font-bold uppercase tracking-wider flex items-center gap-1 px-1.5 py-0.5 rounded transition-colors hover:bg-purple-500/10 text-purple-500"
            >
              <Palette size={10} /> Visualize
            </button>
          )}
        </div>
      </div>
    </motion.div>
  );
};
