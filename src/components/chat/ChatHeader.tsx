import React from 'react';
import { Globe, Sun, Moon, Settings, MoreVertical } from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';
import { motion } from 'framer-motion';

interface ChatHeaderProps {
  isConnected: boolean;
  isConnecting: boolean;
  statusMessage: string;
}

export const ChatHeader: React.FC<ChatHeaderProps> = ({ isConnected, isConnecting, statusMessage }) => {
  const { c, isDark, toggleTheme } = useTheme();

  return (
    <header 
      className="shrink-0 flex items-center justify-between px-4 md:px-6 h-16 border-b z-20 backdrop-blur-md transition-colors duration-300"
      style={{ backgroundColor: `${c.navBg}`, borderColor: c.border }}
    >
      <div className="flex items-center gap-3">
        <div className="md:hidden w-8 h-8 flex items-center justify-center">
          <img src="./logoGT.png" alt="Logo" className="w-full h-full object-contain" />
        </div>
        <div className="flex flex-col">
          <span className="text-sm font-bold" style={{ color: c.text }}>Ngola Tutor</span>
          <div className="flex items-center gap-1.5">
            <div className={`w-1.5 h-1.5 rounded-full ${isConnected ? 'bg-green-500 animate-pulse' : isConnecting ? 'bg-yellow-500 animate-pulse' : 'bg-gray-400'}`} />
            <span className="text-[10px] font-medium" style={{ color: c.textSubtle }}>
              {isConnected ? 'Live Session' : isConnecting ? 'Connecting...' : 'Offline'}
            </span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2">
        {isConnected && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="hidden sm:flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold border"
            style={{ backgroundColor: 'rgba(52, 168, 83, 0.1)', color: '#34a853', borderColor: 'rgba(52, 168, 83, 0.2)' }}
          >
            <Globe size={10} /> SEARCH ACTIVE
          </motion.div>
        )}
        
        <button 
          onClick={toggleTheme}
          className="p-2 rounded-lg transition-colors hover:bg-black/5 dark:hover:bg-white/5"
          style={{ color: c.textMuted }}
        >
          {isDark ? <Sun size={18} /> : <Moon size={18} />}
        </button>
        
        <button 
          className="p-2 rounded-lg transition-colors hover:bg-black/5 dark:hover:bg-white/5"
          style={{ color: c.textMuted }}
        >
          <Settings size={18} />
        </button>
      </div>
    </header>
  );
};
