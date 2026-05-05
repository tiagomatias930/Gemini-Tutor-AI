import React, { useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTheme } from '../../contexts/ThemeContext';

export interface WhiteboardElement {
  id: string;
  type: 'text' | 'circle' | 'square' | 'arrow' | 'line';
  x: number;
  y: number;
  content?: string;
  width?: number;
  height?: number;
  color?: string;
}

interface WhiteboardProps {
  elements: WhiteboardElement[];
  isDark: boolean;
}

export const Whiteboard: React.FC<WhiteboardProps> = ({ elements, isDark }) => {
  const { c } = useTheme();

  return (
    <div className="w-full h-full min-h-[300px] bg-white dark:bg-slate-900 rounded-3xl overflow-hidden border shadow-inner relative" style={{ borderColor: c.border }}>
      <div className="absolute top-4 left-4 flex items-center gap-2 px-3 py-1.5 bg-black/5 dark:bg-white/5 rounded-full backdrop-blur-sm border" style={{ borderColor: c.border }}>
        <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
        <span className="text-[10px] font-bold uppercase tracking-widest opacity-60">Interactive Whiteboard</span>
      </div>

      <svg viewBox="0 0 500 500" className="w-full h-full p-8">
        <defs>
          <marker
            id="arrowhead"
            markerWidth="10"
            markerHeight="7"
            refX="9"
            refY="3.5"
            orient="auto"
          >
            <polygon points="0 0, 10 3.5, 0 7" fill={isDark ? '#4285f4' : '#1a73e8'} />
          </marker>
        </defs>

        <AnimatePresence>
          {elements.map((cmd) => {
            const color = cmd.color || (isDark ? '#4285f4' : '#1a73e8');
            
            switch (cmd.type) {
              case 'circle':
                return (
                  <motion.circle
                    key={cmd.id}
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0, opacity: 0 }}
                    cx={cmd.x}
                    cy={cmd.y}
                    r={cmd.width ? cmd.width / 2 : 25}
                    fill="none"
                    stroke={color}
                    strokeWidth="2"
                  />
                );
              case 'square':
                return (
                  <motion.rect
                    key={cmd.id}
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0, opacity: 0 }}
                    x={cmd.x - (cmd.width || 50) / 2}
                    y={cmd.y - (cmd.height || 50) / 2}
                    width={cmd.width || 50}
                    height={cmd.height || 50}
                    fill="none"
                    stroke={color}
                    strokeWidth="2"
                    rx="4"
                  />
                );
              case 'text':
                return (
                  <motion.text
                    key={cmd.id}
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: 20, opacity: 0 }}
                    x={cmd.x}
                    y={cmd.y}
                    fill={isDark ? 'white' : 'black'}
                    fontSize="14"
                    fontWeight="bold"
                    textAnchor="middle"
                  >
                    {cmd.content}
                  </motion.text>
                );
              case 'line':
              case 'arrow':
                return (
                  <motion.line
                    key={cmd.id}
                    initial={{ pathLength: 0, opacity: 0 }}
                    animate={{ pathLength: 1, opacity: 1 }}
                    exit={{ pathLength: 0, opacity: 0 }}
                    x1={cmd.x}
                    y1={cmd.y}
                    x2={cmd.x + (cmd.width || 50)}
                    y2={cmd.y + (cmd.height || 50)}
                    stroke={color}
                    strokeWidth="2"
                    markerEnd={cmd.type === 'arrow' ? 'url(#arrowhead)' : ''}
                  />
                );
              default:
                return null;
            }
          })}
        </AnimatePresence>
      </svg>
    </div>
  );
};
