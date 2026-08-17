import React from 'react';
import { motion } from 'framer-motion';
import { Mic, Globe, Palette, FileText, Sparkles } from 'lucide-react';
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
      initial={{ opacity: 0, y: 8, scale: 0.99 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.25 }}
      className={`flex gap-3 mb-5 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}
    >
      {!isUser && (
        <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 p-0.5 shrink-0 shadow-sm flex items-center justify-center">
          <div className="w-full h-full rounded-[10px] bg-slate-900 flex items-center justify-center">
            <Sparkles size={14} className="text-blue-400" />
          </div>
        </div>
      )}

      <div className={`max-w-[85%] md:max-w-[72%] flex flex-col ${isUser ? 'items-end' : 'items-start'}`}>
        <div 
          className={`relative px-4 py-3 rounded-2xl text-sm leading-relaxed shadow-sm transition-all duration-200 ${
            isUser 
              ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-tr-none shadow-md shadow-blue-500/15' 
              : 'rounded-tl-none border'
          }`}
          style={!isUser ? { 
            backgroundColor: isDark ? 'rgba(19, 28, 49, 0.75)' : '#FFFFFF',
            borderColor: c.border,
            backdropFilter: 'blur(12px)',
            color: c.text,
            boxShadow: isDark ? '0 4px 20px rgba(0,0,0,0.25)' : '0 2px 10px rgba(0,0,0,0.04)'
          } : {}}
        >
          {msg.image && (
            <div className="mb-2.5 rounded-xl overflow-hidden border border-white/20 shadow-inner">
              <img src={msg.image} alt="Captured" className="max-h-48 w-auto object-contain" />
            </div>
          )}
          
          {msg.attachedFile && (
            <div 
              className="flex items-center gap-2 px-3 py-2 rounded-xl mb-2 text-xs font-semibold w-fit max-w-full"
              style={{ backgroundColor: isUser ? 'rgba(255,255,255,0.18)' : 'rgba(59, 130, 246, 0.1)', color: isUser ? 'white' : '#2563EB' }}
            >
              <FileText size={14} className="shrink-0" />
              <span className="truncate">{msg.attachedFile.name}</span>
            </div>
          )}

          <div className="prose prose-sm dark:prose-invert max-w-none font-sans">
            {renderMarkdown(msg.text, isUser)}
          </div>

          {msg.role === 'assistant' && renderGeneratedImage && renderGeneratedImage(msg)}
        </div>

        <div className={`flex items-center gap-2 mt-1.5 px-1 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
          {msg.source === 'voice' && (
            <span className="text-[9px] font-bold uppercase tracking-wider flex items-center gap-1" style={{ color: c.textSubtle }}>
              <Mic size={10} className="text-rose-500" /> Voz
            </span>
          )}
          {msg.grounded && (
            <span className="text-[9px] font-bold uppercase tracking-wider flex items-center gap-1 text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
              <Globe size={10} /> Pesquisa Web
            </span>
          )}
          {!isUser && !msg.generatedImage && !msg.isGeneratingImage && onVisualize && (
            <button
              onClick={() => onVisualize(msg.text)}
              className="text-[9px] font-bold uppercase tracking-wider flex items-center gap-1 px-2 py-0.5 rounded-full transition-all bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20"
            >
              <Palette size={10} /> Visualizar
            </button>
          )}
        </div>
      </div>
    </motion.div>
  );
};
