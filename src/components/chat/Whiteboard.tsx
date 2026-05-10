import React, { useEffect, useState, memo } from 'react';
import { Excalidraw } from "@excalidraw/excalidraw";
import "@excalidraw/excalidraw/index.css";
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

export const Whiteboard: React.FC<WhiteboardProps> = memo(({ elements, isDark }) => {
  const { c } = useTheme();
  const [excalidrawAPI, setExcalidrawAPI] = useState<any>(null);

  useEffect(() => {
    if (!excalidrawAPI) return;

    if (elements.length === 0) {
      excalidrawAPI.updateScene({ elements: [] });
      return;
    }

    const exElements = elements.map((el) => {
      const color = el.color || (isDark ? '#4285f4' : '#1a73e8');
      const common = {
        id: el.id,
        x: el.x,
        y: el.y,
        strokeColor: color,
        backgroundColor: "transparent",
        strokeWidth: 2,
        roughness: 1,
        seed: Math.floor(Math.random() * 100000),
        version: 1,
        versionNonce: Math.floor(Math.random() * 100000),
        isDeleted: false,
        groupIds: [],
        frameId: null,
        boundElements: null,
        updated: Date.now(),
        link: null,
        locked: false,
      };

      switch (el.type) {
        case 'circle':
          return {
            ...common,
            type: "ellipse",
            width: el.width || 100,
            height: el.width || 100,
          };
        case 'square':
          return {
            ...common,
            type: "rectangle",
            width: el.width || 100,
            height: el.height || 100,
          };
        case 'text':
          return {
            ...common,
            type: "text",
            text: el.content || "",
            fontSize: 20,
            fontFamily: 1,
            textAlign: "center" as const,
            verticalAlign: "middle" as const,
            width: (el.content?.length || 10) * 12,
            height: 30,
          };
        case 'arrow':
          return {
            ...common,
            type: "arrow",
            width: el.width || 100,
            height: el.height || 100,
            points: [[0, 0], [el.width || 100, el.height || 100]],
            startArrowhead: null,
            endArrowhead: "arrow",
          };
        case 'line':
          return {
            ...common,
            type: "line",
            width: el.width || 100,
            height: el.height || 100,
            points: [[0, 0], [el.width || 100, el.height || 100]],
          };
        default:
          return null;
      }
    }).filter(Boolean);

    excalidrawAPI.updateScene({
      elements: exElements,
      appState: {
        theme: isDark ? "dark" : "light",
      }
    });
  }, [elements, excalidrawAPI, isDark]);

  return (
    <div 
      className="w-full h-full bg-white dark:bg-[#121212] rounded-3xl overflow-hidden border shadow-inner relative" 
      style={{ borderColor: c.border }}
    >
      <div className="absolute top-4 left-4 z-10 flex items-center gap-2 px-3 py-1.5 bg-black/5 dark:bg-white/5 rounded-full backdrop-blur-sm border" style={{ borderColor: c.border }}>
        <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
        <span className="text-[10px] font-bold uppercase tracking-widest opacity-60">Excalidraw Whiteboard</span>
      </div>

      <div className="w-full h-full">
        <Excalidraw
          theme={isDark ? "dark" : "light"}
          excalidrawAPI={(api) => setExcalidrawAPI(api)}
          UIOptions={{
            canvasActions: {
              loadScene: false,
              saveToActiveFile: false,
              toggleTheme: false,
              export: false,
            }
          }}
        />
      </div>
    </div>
  );
});

Whiteboard.displayName = 'Whiteboard';
