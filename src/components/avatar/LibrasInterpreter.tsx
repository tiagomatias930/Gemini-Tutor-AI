import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Hand, X, Minimize2, Maximize2 } from 'lucide-react';

interface LibrasInterpreterProps {
  isActive: boolean;
  onToggle: () => void;
  lastAssistantMessage: string;
  isDark: boolean;
}

// Strip internal agent tags & markdown from message text
function cleanMessageText(text: string): string {
  return text
    .replace(/\[GT_MEMORY_UPDATE:[^\]]*\]/g, '')
    .replace(/\[GT_WHITEBOARD_COMMAND:[^\]]*\]/g, '')
    .replace(/\[GT_CONTEXT_UPDATE:[^\]]*\]/g, '')
    .replace(/```[\s\S]*?```/g, '') // Remove code blocks
    .replace(/[#*_~`>]/g, '') // Remove markdown formatting
    .trim();
}

export const LibrasInterpreter: React.FC<LibrasInterpreterProps> = ({
  isActive,
  onToggle,
  lastAssistantMessage,
  isDark,
}) => {
  const [isMinimized, setIsMinimized] = useState(false);
  const [currentText, setCurrentText] = useState('');
  const [isTranslating, setIsTranslating] = useState(false);
  const lastTranslatedTextRef = useRef('');

  // Handle opening / closing VLibras widget when active state toggles
  useEffect(() => {
    try {
      const accessBtn = document.querySelector('[vw-access-button]') as HTMLElement;
      if (isActive) {
        if (accessBtn && !accessBtn.classList.contains('active')) {
          accessBtn.click();
        }
      }
    } catch (err) {
      console.warn('VLibras toggle notice:', err);
    }
  }, [isActive]);

  // Translate assistant messages safely when TILS is active
  useEffect(() => {
    if (!isActive || !lastAssistantMessage) return;

    const clean = cleanMessageText(lastAssistantMessage);
    if (!clean || clean === lastTranslatedTextRef.current) return;

    lastTranslatedTextRef.current = clean;
    setCurrentText(clean);
    setIsTranslating(true);

    const win = window as any;
    if (win.plugin && typeof win.plugin.translate === 'function') {
      try {
        win.plugin.translate(clean);
      } catch (err) {
        console.warn('VLibras translate notice:', err);
      }
    }

    const timer = setTimeout(() => {
      setIsTranslating(false);
    }, 3000);

    return () => clearTimeout(timer);
  }, [isActive, lastAssistantMessage]);

  return (
    <>
      {/* Floating Panel (shown when active and not minimized) */}
      <AnimatePresence>
        {isActive && !isMinimized && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className={`fixed bottom-24 left-6 z-50 rounded-2xl border shadow-xl p-3
                        w-[240px] md:w-[280px]
                        ${isDark
                ? 'bg-slate-900/95 border-indigo-500/30 text-white shadow-indigo-500/10'
                : 'bg-white/95 border-indigo-200 text-slate-800 shadow-indigo-200/30'
              } backdrop-blur-xl`}
          >
            {/* Header */}
            <div className="flex items-center justify-between pb-2 border-b border-indigo-500/10">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-lg bg-indigo-500/10 flex items-center justify-center text-indigo-500">
                  <Hand size={14} />
                </div>
                <span className="text-xs font-bold text-indigo-500">
                  TILS • Intérprete Libras
                </span>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setIsMinimized(true)}
                  className="p-1 rounded text-slate-400 hover:text-slate-200 transition-colors"
                  title="Minimizar"
                >
                  <Minimize2 size={13} />
                </button>
                <button
                  onClick={onToggle}
                  className="p-1 rounded text-slate-400 hover:text-red-400 transition-colors"
                  title="Desativar"
                >
                  <X size={13} />
                </button>
              </div>
            </div>

            {/* Status & Current Text */}
            <div className="mt-2 space-y-1.5">
              <div className="flex items-center justify-between text-[10px] text-slate-400">
                <span>Status:</span>
                <span className={`font-bold flex items-center gap-1 ${isTranslating ? 'text-indigo-400' : 'text-emerald-400'}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${isTranslating ? 'bg-indigo-400 animate-pulse' : 'bg-emerald-400'}`} />
                  {isTranslating ? 'Traduzindo fala...' : 'Ativo e Pronto'}
                </span>
              </div>

              {currentText ? (
                <div className={`p-2 rounded-xl text-[11px] font-medium leading-tight max-h-20 overflow-y-auto ${isDark ? 'bg-black/40 text-slate-300' : 'bg-slate-100 text-slate-700'}`}>
                  {currentText.length > 140 ? currentText.slice(0, 140) + '...' : currentText}
                </div>
              ) : (
                <p className="text-[10px] text-slate-400 italic">
                  O intérprete traduzirá automaticamente a fala e as respostas do tutor.
                </p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Minimized Float */}
      <AnimatePresence>
        {isActive && isMinimized && (
          <motion.button
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            onClick={() => setIsMinimized(false)}
            className={`fixed bottom-24 left-6 z-50 p-2.5 rounded-2xl border shadow-lg
                        transition-all hover:scale-105 active:scale-95
                        ${isDark
                ? 'bg-slate-900/90 border-indigo-500/30 text-indigo-400'
                : 'bg-white/90 border-indigo-200 text-indigo-600'
              } backdrop-blur-xl`}
            title="Maximizar TILS"
          >
            <Maximize2 size={16} />
          </motion.button>
        )}
      </AnimatePresence>

      {/* Floating Toggle Button (Bottom-Left Corner) */}
      <motion.button
        onClick={onToggle}
        whileHover={{ scale: 1.06 }}
        whileTap={{ scale: 0.94 }}
        className={`fixed bottom-6 left-6 z-50 w-13 h-13 sm:w-14 sm:h-14 rounded-2xl flex items-center justify-center
                    border-2 transition-all duration-300 shadow-xl group
                    ${isActive
            ? 'bg-gradient-to-br from-indigo-600 to-purple-600 border-indigo-400 text-white shadow-indigo-500/40'
            : isDark
              ? 'bg-slate-900/90 border-white/10 text-white/70 hover:bg-slate-800 hover:text-white backdrop-blur-md'
              : 'bg-white/90 border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-indigo-600 backdrop-blur-md shadow-slate-200/50'
          }`}
        title={isActive ? 'Desativar Tradutor Libras (TILS)' : 'Ativar Tradutor Libras (TILS)'}
      >
        {/* Pulse ring when active */}
        {isActive && (
          <span className="absolute inset-0 rounded-2xl border-2 border-indigo-400 animate-ping opacity-25 pointer-events-none" />
        )}

        {/* Hand/Libras SVG Icon */}
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="w-6 h-6"
        >
          <path d="M18 11V6a2 2 0 0 0-2-2a2 2 0 0 0-2 2" />
          <path d="M14 10V4a2 2 0 0 0-2-2a2 2 0 0 0-2 2v2" />
          <path d="M10 10.5V6a2 2 0 0 0-2-2a2 2 0 0 0-2 2v8" />
          <path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15" />
        </svg>
      </motion.button>

      {/* Label badge below button */}
      <div className="fixed bottom-1 left-6 z-50 w-13 sm:w-14 flex justify-center pointer-events-none">
        <span className={`text-[8px] font-black uppercase tracking-widest
                         ${isActive
            ? 'text-indigo-400 font-bold'
            : isDark ? 'text-white/30' : 'text-slate-400'
          }`}>
          LIBRAS
        </span>
      </div>
    </>
  );
};
