import React from 'react';
import { BookOpen, History, Settings, LogOut, MessageSquare, Plus, Star } from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';
import { motion } from 'framer-motion';

interface ChatSidebarProps {
  onNewChat: () => void;
  onBack: () => void;
  sessions: any[];
}

export const ChatSidebar: React.FC<ChatSidebarProps> = ({ onNewChat, onBack, sessions }) => {
  const { c, isDark } = useTheme();

  return (
    <motion.aside 
      initial={{ x: -20, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      className="hidden md:flex flex-col w-64 border-r overflow-hidden transition-colors duration-300"
      style={{ backgroundColor: c.bgAlt, borderColor: c.border }}
    >
      <div className="p-4">
        <button 
          onClick={onNewChat}
          className="w-full flex items-center gap-2 px-4 py-3 rounded-xl text-white font-medium transition-all hover:scale-[1.02] active:scale-[0.98] shadow-lg shadow-blue-500/20"
          style={{ background: `linear-gradient(135deg, ${c.accent}, ${isDark ? '#3b82f6' : '#2563eb'})` }}
        >
          <Plus size={18} />
          <span>New Session</span>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1">
        <div className="px-3 py-2 text-[10px] font-bold uppercase tracking-wider" style={{ color: c.textSubtle }}>
          Recent Sessions
        </div>
        
        {sessions.length === 0 ? (
          <div className="px-3 py-8 text-center space-y-2">
            <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center mx-auto">
              <MessageSquare size={16} className="text-blue-500" />
            </div>
            <p className="text-xs" style={{ color: c.textMuted }}>No history yet</p>
          </div>
        ) : (
          sessions.map((session, i) => (
            <button 
              key={i}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors hover:bg-black/5 dark:hover:bg-white/5 group"
              style={{ color: c.textMuted }}
            >
              <MessageSquare size={14} className="shrink-0" />
              <span className="truncate flex-1 text-left">{session.title || `Session ${i + 1}`}</span>
            </button>
          ))
        )}
      </div>

      <div className="p-4 border-t space-y-1" style={{ borderColor: c.border }}>
        <button 
          className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors hover:bg-black/5 dark:hover:bg-white/5"
          style={{ color: c.textMuted }}
        >
          <Star size={16} />
          <span>Saved Materials</span>
        </button>
        <button 
          className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors hover:bg-black/5 dark:hover:bg-white/5"
          style={{ color: c.textMuted }}
        >
          <Settings size={16} />
          <span>Settings</span>
        </button>
        <button 
          onClick={onBack}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-red-500 transition-colors hover:bg-red-500/10"
        >
          <LogOut size={16} />
          <span>Exit Tutor</span>
        </button>
      </div>
    </motion.aside>
  );
};
