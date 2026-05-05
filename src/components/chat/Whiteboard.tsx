import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

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
  return (
    <div className={`w-full h-full min-h-[300px] rounded-3xl border shadow-inner relative overflow-hidden transition-colors duration-500 ${isDark ? 'bg-[#0f1115] border-white/10' : 'bg-[#fcfcfd] border-gray-200'}`}>
      {/* Background Grid */}
      <div className="absolute inset-0 opacity-[0.03]" 
           style={{ backgroundImage: `radial-gradient(${isDark ? 'white' : 'black'} 1px, transparent 1px)`, backgroundSize: '24px 24px' }} 
      />

      <svg className="w-full h-full" viewBox="0 0 800 600" preserveAspectRatio="xMidYMid meet">
        <AnimatePresence>
          {elements.map((el) => (
            <motion.g
              key={el.id}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              transition={{ duration: 0.5, type: 'spring' }}
            >
              {el.type === 'text' && (
                <text
                  x={el.x}
                  y={el.y}
                  fill={el.color || (isDark ? '#fff' : '#1a1c1e')}
                  className="text-lg font-medium font-serif italic select-none"
                >
                  {el.content}
                </text>
              )}

              {el.type === 'circle' && (
                <circle
                  cx={el.x}
                  cy={el.y}
                  r={el.width || 40}
                  fill="none"
                  stroke={el.color || '#4285f4'}
                  strokeWidth="2"
                  strokeDasharray="200"
                  style={{ strokeDashoffset: 0 }}
                />
              )}

              {el.type === 'square' && (
                <rect
                  x={el.x}
                  y={el.y}
                  width={el.width || 80}
                  height={el.height || 80}
                  fill="none"
                  stroke={el.color || '#ea4335'}
                  strokeWidth="2"
                  rx="8"
                />
              )}

              {el.type === 'arrow' && (
                <g>
                  <line
                    x1={el.x}
                    y1={el.y}
                    x2={el.x + (el.width || 100)}
                    y2={el.y + (el.height || 0)}
                    stroke={el.color || (isDark ? '#9aa0a6' : '#5f6368')}
                    strokeWidth="2"
                    markerEnd="url(#arrowhead)"
                  />
                  <defs>
                    <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="0" refY="3.5" orient="auto">
                      <polygon points="0 0, 10 3.5, 0 7" fill={el.color || (isDark ? '#9aa0a6' : '#5f6368')} />
                    </marker>
                  </defs>
                </g>
              )}
            </motion.g>
          ))}
        </AnimatePresence>
      </svg>

      {/* Whiteboard Label */}
      <div className="absolute top-4 right-4 flex items-center gap-2 px-3 py-1 bg-blue-500/10 rounded-full border border-blue-500/20">
        <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
        <span className="text-[9px] font-black uppercase tracking-widest text-blue-500/80">Interactive Board</span>
      </div>
    </div>
  );
};
