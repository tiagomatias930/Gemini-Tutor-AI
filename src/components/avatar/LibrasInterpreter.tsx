import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Hand, X, Minimize2, Maximize2 } from 'lucide-react';

declare global {
  interface Window {
    VLibras: any;
  }
}

interface LibrasInterpreterProps {
  isActive: boolean;
  onToggle: () => void;
  lastAssistantMessage: string;
  isDark: boolean;
}

// Strip internal agent tags from message text
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
  const [vlibrasLoaded, setVlibrasLoaded] = useState(false);
  const [currentText, setCurrentText] = useState('');
  const [isTranslating, setIsTranslating] = useState(false);
  const translationRef = useRef<HTMLDivElement>(null);
  const vlibrasContainerRef = useRef<HTMLDivElement>(null);

  // Load VLibras script
  useEffect(() => {
    if (!isActive) return;
    
    // Check if already loaded
    if (window.VLibras) {
      setVlibrasLoaded(true);
      return;
    }

    // Add VLibras CSS to hide default button
    const style = document.createElement('style');
    style.id = 'vlibras-custom-styles';
    style.textContent = `
      [vw-access-button] {
        display: none !important;
      }
      .vw-plugin-wrapper {
        position: relative !important;
        z-index: auto !important;
      }
      .vw-plugin-wrapper .vw-plugin-top-wrapper {
        position: relative !important;
        width: 100% !important;
        height: 100% !important;
      }
      div[vw] {
        position: relative !important;
        z-index: auto !important;
      }
    `;
    document.head.appendChild(style);

    // Create VLibras DOM structure
    const vwDiv = document.createElement('div');
    vwDiv.setAttribute('vw', '');
    vwDiv.className = 'enabled';

    const accessBtn = document.createElement('div');
    accessBtn.setAttribute('vw-access-button', '');
    accessBtn.className = 'active';

    const pluginWrapper = document.createElement('div');
    pluginWrapper.setAttribute('vw-plugin-wrapper', '');

    const topWrapper = document.createElement('div');
    topWrapper.className = 'vw-plugin-top-wrapper';

    pluginWrapper.appendChild(topWrapper);
    vwDiv.appendChild(accessBtn);
    vwDiv.appendChild(pluginWrapper);

    // Append to our container if available, otherwise to body
    if (vlibrasContainerRef.current) {
      vlibrasContainerRef.current.appendChild(vwDiv);
    } else {
      document.body.appendChild(vwDiv);
    }

    // Load script
    const script = document.createElement('script');
    script.src = 'https://vlibras.gov.br/app/vlibras-plugin.js';
    script.async = true;
    script.onload = () => {
      try {
        new window.VLibras.Widget({ rootPath: 'https://vlibras.gov.br/app/' });
        setVlibrasLoaded(true);
      } catch (err) {
        console.error('VLibras initialization error:', err);
      }
    };
    script.onerror = () => {
      console.error('Failed to load VLibras script');
    };
    document.head.appendChild(script);

    return () => {
      // Cleanup on unmount
      const existingStyle = document.getElementById('vlibras-custom-styles');
      if (existingStyle) existingStyle.remove();
    };
  }, [isActive]);

  // Handle message translation
  useEffect(() => {
    if (!isActive || !lastAssistantMessage) return;

    const cleanText = cleanMessageText(lastAssistantMessage);
    if (!cleanText || cleanText === currentText) return;

    setCurrentText(cleanText);
    setIsTranslating(true);

    // Use VLibras text selection method to trigger translation
    if (translationRef.current && vlibrasLoaded) {
      translationRef.current.textContent = cleanText;

      // Programmatically select the text to trigger VLibras
      setTimeout(() => {
        try {
          const range = document.createRange();
          const selection = window.getSelection();
          if (translationRef.current && selection) {
            range.selectNodeContents(translationRef.current);
            selection.removeAllRanges();
            selection.addRange(range);

            // Trigger VLibras translation via simulated mouseup event
            const mouseupEvent = new MouseEvent('mouseup', {
              bubbles: true,
              cancelable: true,
              view: window,
            });
            translationRef.current.dispatchEvent(mouseupEvent);

            // Clear selection after a moment
            setTimeout(() => {
              selection.removeAllRanges();
              setIsTranslating(false);
            }, 500);
          }
        } catch (err) {
          console.error('VLibras translation trigger error:', err);
          setIsTranslating(false);
        }
      }, 300);
    }
  }, [isActive, lastAssistantMessage, vlibrasLoaded]);

  return (
    <>
      {/* Hidden div for VLibras text selection translation */}
      <div
        ref={translationRef}
        aria-hidden="true"
        style={{
          position: 'fixed',
          left: '-9999px',
          top: '-9999px',
          opacity: 0,
          pointerEvents: 'none',
          fontSize: '16px',
          userSelect: 'text',
          WebkitUserSelect: 'text',
        }}
      />

      {/* VLibras Panel */}
      <AnimatePresence>
        {isActive && !isMinimized && (
          <motion.div
            initial={{ opacity: 0, y: 40, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 40, scale: 0.9 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className={`fixed bottom-24 left-6 z-50 rounded-3xl overflow-hidden border shadow-2xl
                        w-[220px] h-[280px] md:w-[280px] md:h-[320px]
                        ${isDark
                ? 'bg-slate-900/90 border-indigo-500/30 shadow-indigo-500/10'
                : 'bg-white/90 border-indigo-200 shadow-indigo-200/30'
              } backdrop-blur-xl`}
          >
            {/* Header */}
            <div className={`flex items-center justify-between px-3 py-2 border-b
                            ${isDark ? 'bg-indigo-600/20 border-indigo-500/20' : 'bg-indigo-50 border-indigo-100'}`}>
              <div className="flex items-center gap-2">
                <div className="relative">
                  <Hand size={14} className="text-indigo-500" />
                  {isTranslating && (
                    <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-green-500 rounded-full animate-ping" />
                  )}
                </div>
                <span className={`text-[10px] font-black uppercase tracking-tight
                                ${isDark ? 'text-indigo-400' : 'text-indigo-600'}`}>
                  Intérprete de Libras
                </span>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setIsMinimized(true)}
                  className={`p-1 rounded-lg transition-all hover:scale-110
                              ${isDark ? 'hover:bg-white/10 text-gray-400' : 'hover:bg-indigo-100 text-gray-500'}`}
                >
                  <Minimize2 size={12} />
                </button>
                <button
                  onClick={onToggle}
                  className={`p-1 rounded-lg transition-all hover:scale-110
                              ${isDark ? 'hover:bg-red-500/20 text-gray-400 hover:text-red-400' : 'hover:bg-red-50 text-gray-500 hover:text-red-500'}`}
                >
                  <X size={12} />
                </button>
              </div>
            </div>

            {/* VLibras Widget Container */}
            <div
              ref={vlibrasContainerRef}
              className="flex-1 w-full h-[calc(100%-70px)] relative overflow-hidden"
            >
              {!vlibrasLoaded && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
                  <div className="relative">
                    <div className="w-12 h-12 rounded-full border-2 border-indigo-500/30 border-t-indigo-500 animate-spin" />
                    <Hand size={20} className="absolute inset-0 m-auto text-indigo-500" />
                  </div>
                  <span className={`text-[10px] font-bold ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                    Carregando VLibras...
                  </span>
                </div>
              )}
            </div>

            {/* Current Translation Ticker */}
            {currentText && (
              <div className={`px-3 py-1.5 border-t overflow-hidden
                              ${isDark ? 'bg-black/30 border-white/5' : 'bg-indigo-50/50 border-indigo-100'}`}>
                <p className={`text-[9px] leading-tight font-medium truncate
                              ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                  {currentText.length > 80 ? currentText.slice(0, 80) + '...' : currentText}
                </p>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Minimized Restore Button */}
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
                ? 'bg-slate-900/80 border-indigo-500/30 text-indigo-400'
                : 'bg-white/90 border-indigo-200 text-indigo-600'
              } backdrop-blur-xl`}
          >
            <Maximize2 size={16} />
          </motion.button>
        )}
      </AnimatePresence>

      {/* Floating Toggle Button */}
      <motion.button
        onClick={onToggle}
        whileHover={{ scale: 1.08 }}
        whileTap={{ scale: 0.92 }}
        className={`fixed bottom-6 left-6 z-50 w-14 h-14 rounded-full flex items-center justify-center
                    border-2 transition-all duration-300 shadow-xl group
                    ${isActive
            ? 'bg-indigo-600 border-indigo-400 shadow-indigo-500/40 text-white'
            : isDark
              ? 'bg-white/10 border-white/20 text-white/70 hover:bg-white/20 hover:text-white backdrop-blur-md'
              : 'bg-white/80 border-gray-200 text-gray-500 hover:bg-white hover:text-indigo-600 backdrop-blur-md shadow-gray-200/50'
          }`}
      >
        {/* Pulse ring when active */}
        {isActive && (
          <span className="absolute inset-0 rounded-full border-2 border-indigo-400 animate-ping opacity-30" />
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
      <div className="fixed bottom-1 left-6 z-50 w-14 flex justify-center pointer-events-none">
        <span className={`text-[8px] font-black uppercase tracking-widest
                         ${isActive
            ? 'text-indigo-500'
            : isDark ? 'text-white/30' : 'text-gray-400'
          }`}>
          LIBRAS
        </span>
      </div>
    </>
  );
};
